using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Configuration;

namespace AIStudio.Api.Services
{
    /// <summary>
    /// Verifies the server-signed JWT issued by AuthController.
    /// Checks the signature, issuer, audience and expiry. Fails closed if no secret is configured.
    /// Never trust claims from a token that did not pass this check.
    /// </summary>
    public static class AdminTokenValidator
    {
        public static bool TryGetAdmin(HttpRequest request, IConfiguration config, out string? userId)
        {
            return TryGetVerifiedUser(request, config, out userId, out bool isAdmin) && isAdmin;
        }

        public static bool TryGetVerifiedUser(HttpRequest request, IConfiguration config, out string? userId, out bool isAdmin)
        {
            userId = null;
            isAdmin = false;
            if (!TryGetVerifiedToken(request, config, out var jwt) || jwt == null) return false;

            isAdmin =
                jwt.Claims.Any(c => c.Type == "is_admin" && c.Value.Equals("true", StringComparison.OrdinalIgnoreCase))
                || jwt.Claims.Any(c => (c.Type == ClaimTypes.Role || c.Type == "role") && c.Value.Equals("admin", StringComparison.OrdinalIgnoreCase));
            userId = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier || c.Type == "sub")?.Value;
            return true;
        }

        /// <summary>Returns the verified token (header or cookie), or false when missing or invalid.</summary>
        public static bool TryGetVerifiedToken(HttpRequest request, IConfiguration config, out JwtSecurityToken? jwt)
        {
            jwt = null;

            string? secret = config["Jwt:Secret"];
            if (string.IsNullOrWhiteSpace(secret)) return false;

            string? token = null;
            string authHeader = request.Headers["Authorization"].ToString();
            if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                token = authHeader.Substring("Bearer ".Length).Trim();
            }
            else if (request.Cookies.TryGetValue("aistudio_jwt", out var cookie))
            {
                token = cookie;
            }
            if (string.IsNullOrWhiteSpace(token)) return false;

            var parameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
                ValidateIssuer = true,
                ValidIssuer = config["Jwt:Issuer"] ?? "AIStudioBackend",
                ValidateAudience = true,
                ValidAudience = config["Jwt:Audience"] ?? "AIStudioClients",
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(1),
                ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 }
            };

            try
            {
                var handler = new JwtSecurityTokenHandler();
                handler.ValidateToken(token, parameters, out var validated);
                jwt = (JwtSecurityToken)validated;
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
