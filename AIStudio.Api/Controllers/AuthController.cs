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
        }

        public class SignupRequest
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
            public string Role { get; set; } = "customer"; // "customer", "app", or "admin"
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return BadRequest(new { error = "Email aur password dono zaroori hain." });

            var user = await _db.AuthenticateUserAsync(req.Email, req.Password);
            if (user == null)
                return Unauthorized(new { error = "Email ya password galat hai." });

            bool isAdmin = user.Role == "admin" || await _db.IsAdminAsync(user.Id);
            string effectiveRole = isAdmin ? "admin" : (string.IsNullOrWhiteSpace(user.Role) ? "customer" : user.Role);
            string token = GenerateJwtToken(user, isAdmin);

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

            var handler = new JwtSecurityTokenHandler();
            if (!handler.CanReadToken(tokenStr))
                return Unauthorized(new { error = "Invalid token format" });

            var jwt = handler.ReadJwtToken(tokenStr);
            if (jwt.ValidTo < DateTime.UtcNow)
                return Unauthorized(new { error = "Token has expired" });

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
                string desiredRole = string.IsNullOrWhiteSpace(req.Role) ? "customer" : req.Role.Trim().ToLowerInvariant();
                var user = await _db.RegisterUserAsync(req.Email, req.Password, desiredRole);
                bool isAdmin = desiredRole == "admin";
                string token = GenerateJwtToken(user, isAdmin);

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
            catch (Exception ex)
            {
                return BadRequest(new { error = "Account nahi ban saka: " + ex.Message });
            }
        }

        [HttpGet("is-admin")]
        public async Task<IActionResult> CheckIsAdmin([FromQuery] string? userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
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

                if (!string.IsNullOrEmpty(tokenStr))
                {
                    var handler = new JwtSecurityTokenHandler();
                    if (handler.CanReadToken(tokenStr))
                    {
                        var jwt = handler.ReadJwtToken(tokenStr);
                        var adminClaim = jwt.Claims.FirstOrDefault(c => c.Type == "is_admin" || c.Type == ClaimTypes.Role);
                        if (adminClaim != null && (adminClaim.Value.Equals("true", StringComparison.OrdinalIgnoreCase) || adminClaim.Value.Equals("admin", StringComparison.OrdinalIgnoreCase)))
                        {
                            return Ok(new { is_admin = true });
                        }
                        userId = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier || c.Type == "sub")?.Value;
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(userId))
                return Ok(new { is_admin = false });

            bool isAdmin = await _db.IsAdminAsync(userId);
            return Ok(new { is_admin = isAdmin });
        }

        private string GenerateJwtToken(User user, bool isAdmin)
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
