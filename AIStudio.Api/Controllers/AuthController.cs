using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using AIStudio.Api.Models;
using AIStudio.Api.Services;
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
            string token = GenerateJwtToken(user, isAdmin);

            return Ok(new
            {
                access_token = token,
                token_type = "bearer",
                user = new
                {
                    id = user.Id,
                    email = user.Email,
                    role = isAdmin ? "admin" : "customer",
                    is_admin = isAdmin
                }
            });
        }

        [HttpPost("signup")]
        public async Task<IActionResult> Signup([FromBody] SignupRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                return BadRequest(new { error = "Email aur password dono zaroori hain." });

            try
            {
                var user = await _db.RegisterUserAsync(req.Email, req.Password, "customer");
                string token = GenerateJwtToken(user, false);

                return Ok(new
                {
                    access_token = token,
                    token_type = "bearer",
                    user = new
                    {
                        id = user.Id,
                        email = user.Email,
                        role = "customer",
                        is_admin = false
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
                var authHeader = Request.Headers["Authorization"].ToString();
                if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
                {
                    var tokenStr = authHeader.Substring("Bearer ".Length).Trim();
                    var handler = new JwtSecurityTokenHandler();
                    if (handler.CanReadToken(tokenStr))
                    {
                        var jwt = handler.ReadJwtToken(tokenStr);
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

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, isAdmin ? "admin" : "customer"),
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
