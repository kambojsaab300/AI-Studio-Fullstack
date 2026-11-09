using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using AIStudio.Api.Models;
using AIStudio.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace AIStudio.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly DatabaseService _db;
        private readonly IConfiguration _config;

        public AuthController(DatabaseService db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        public class LoginRequest
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
            public string? AppId { get; set; }   // customer portal: the app this login works for
        }

        public class SignupRequest
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
            public string Role { get; set; } = "customer"; // "customer", "app", or "admin"
            public string? AppId { get; set; }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return BadRequest(new { error = "Email aur password dono zaroori hain." });

            if (!string.IsNullOrWhiteSpace(req.AppId) && !await _db.IsAppEnabledAsync(req.AppId.Trim()))
                return BadRequest(new { error = "App nahi mili ya band hai." });

            var user = await _db.AuthenticateUserAsync(req.Email, req.Password);
            if (user == null)
                return Unauthorized(new { error = "Email ya password galat hai." });

            bool isAdmin = user.Role == "admin" || await _db.IsAdminAsync(user.Id);
            string effectiveRole = isAdmin ? "admin" : (string.IsNullOrWhiteSpace(user.Role) ? "customer" : user.Role);
            string token = GenerateJwtToken(user, isAdmin, string.IsNullOrWhiteSpace(req.AppId) ? null : req.AppId.Trim());

            // Set secure HttpOnly cookie for automatic browser persistence across refreshes
            var cookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = true, // HTTPS on MonsterASP
                SameSite = SameSiteMode.Lax,
                Expires = DateTimeOffset.UtcNow.AddDays(30),
                Path = "/"
            };
            Response.Cookies.Append("aistudio_jwt", token, cookieOptions);

            return Ok(new
            {
                access_token = token,
                token_type = "bearer",
                user = new
                {
                    id = user.Id,
                    email = user.Email,
                    role = effectiveRole,
                    is_admin = isAdmin
                }
            });
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            Response.Cookies.Delete("aistudio_jwt", new CookieOptions
            {
                Path = "/",
                Secure = true,
                SameSite = SameSiteMode.Lax
            });
            return Ok(new { success = true, message = "Logged out successfully." });
        }

        [HttpGet("me")]
        [HttpGet("user")]
        public async Task<IActionResult> GetCurrentUser()
        {
            string? tokenStr = null;
            var authHeader = Request.Headers["Authorization"].ToString();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                tokenStr = authHeader.Substring("Bearer ".Length).Trim();
            }
            else if (Request.Cookies.TryGetValue("aistudio_jwt", out var cToken) && !string.IsNullOrEmpty(cToken))
            {
                tokenStr = cToken;
            }

            if (string.IsNullOrWhiteSpace(tokenStr))
                return Unauthorized(new { error = "Not authenticated" });

            if (!AdminTokenValidator.TryGetVerifiedToken(Request, _config, out var jwt) || jwt == null)
                return Unauthorized(new { error = "Invalid or expired token" });

            var userId = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier || c.Type == "sub")?.Value;
            var email = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Email || c.Type == "email")?.Value ?? "";
            var roleClaim = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role")?.Value ?? "customer";
            var adminClaim = jwt.Claims.FirstOrDefault(c => c.Type == "is_admin")?.Value;

            bool isAdmin = (adminClaim != null && adminClaim.Equals("true", StringComparison.OrdinalIgnoreCase))
                || roleClaim.Equals("admin", StringComparison.OrdinalIgnoreCase);

            if (!isAdmin && !string.IsNullOrEmpty(userId))
            {
                isAdmin = await _db.IsAdminAsync(userId);
            }

            return Ok(new
            {
                id = userId,
                email = email,
                role = isAdmin ? "admin" : roleClaim,
                is_admin = isAdmin,
                access_token = tokenStr
            });
        }

        [HttpPost("signup")]
        public async Task<IActionResult> Signup([FromBody] SignupRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return BadRequest(new { error = "Email aur password dono zaroori hain." });

            try
            {
                // Public signup can never create an admin. Admins are granted server-side only.
                string desiredRole = string.IsNullOrWhiteSpace(req.Role) ? "customer" : req.Role.Trim().ToLowerInvariant();
                if (desiredRole != "customer" && desiredRole != "app")
                    return StatusCode(403, new { error = "Is role se account nahi ban sakta." });

                string? signupApp = string.IsNullOrWhiteSpace(req.AppId) ? null : req.AppId.Trim();
                if (signupApp is not null && !await _db.IsAppEnabledAsync(signupApp))
                    return BadRequest(new { error = "App nahi mili ya band hai." });

                var user = await _db.RegisterUserAsync(req.Email, req.Password, desiredRole);
                bool isAdmin = false;
                string token = GenerateJwtToken(user, isAdmin, signupApp);

                Response.Cookies.Append("aistudio_jwt", token, new CookieOptions
                {
                    HttpOnly = true,
                    Secure = true,
                    SameSite = SameSiteMode.Lax,
                    Expires = DateTimeOffset.UtcNow.AddDays(30),
                    Path = "/"
                });

                return Ok(new
                {
                    access_token = token,
                    token_type = "bearer",
                    user = new
                    {
                        id = user.Id,
                        email = user.Email,
                        role = user.Role,
                        is_admin = isAdmin
                    }
                });
            }
            catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601)
            {
                // Unique key on email: the account already exists. Don't echo the SQL text to the user.
                return Conflict(new { error = "Is email se account pehle se bana hua hai. Login karo." });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Signup failed: {ex}");
                return StatusCode(500, new { error = "Account abhi nahi ban saka. Thodi der baad try karo." });
            }
        }

        [HttpGet("is-admin")]
        public async Task<IActionResult> CheckIsAdmin([FromQuery] string? userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
            {
                if (AdminTokenValidator.TryGetVerifiedUser(Request, _config, out var verifiedId, out bool tokenIsAdmin))
                {
                    if (tokenIsAdmin) return Ok(new { is_admin = true });
                    userId = verifiedId;
                }
            }

            if (string.IsNullOrWhiteSpace(userId))
                return Ok(new { is_admin = false });

            bool isAdmin = await _db.IsAdminAsync(userId);
            return Ok(new { is_admin = isAdmin });
        }

        private string GenerateJwtToken(User user, bool isAdmin, string? appId = null)
        {
            var secret = _config["Jwt:Secret"] ?? "AIStudioSuperSecretSecurityKey20261102!#*9988";
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            string effectiveRole = isAdmin ? "admin" : (string.IsNullOrWhiteSpace(user.Role) ? "customer" : user.Role);
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, effectiveRole),
                new Claim("is_admin", isAdmin ? "true" : "false")
            };
            if (!string.IsNullOrEmpty(appId)) claims = claims.Append(new Claim("app_id", appId)).ToArray();

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"] ?? "AIStudioBackend",
                audience: _config["Jwt:Audience"] ?? "AIStudioClients",
                claims: claims,
                expires: DateTime.UtcNow.AddDays(30),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
