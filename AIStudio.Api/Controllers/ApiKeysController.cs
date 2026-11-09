using System;
using System.Linq;
using System.Threading.Tasks;
using AIStudio.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AIStudio.Api.Controllers
{
    /// <summary>Admin-only management of client API keys.</summary>
    [ApiController]
    [Route("api/admin/api-keys")]
    [RequireAdmin]
    public class ApiKeysController : ControllerBase
    {
        private readonly ApiKeyService _keys;
        private readonly DatabaseService _db;

        public ApiKeysController(ApiKeyService keys, DatabaseService db)
        {
            _keys = keys;
            _db = db;
        }

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var rows = await _keys.ListAsync();
            return Ok(rows);
        }

        public class CreateApiKeyDto
        {
            public string? name { get; set; }
            public string? scope { get; set; }   // "app" (default) or "worker"
            public string? app_id { get; set; }  // required for scope "app"
            public DateTimeOffset? expires_at { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateApiKeyDto dto)
        {
            string name = (dto.name ?? string.Empty).Trim();
            if (name.Length == 0 || name.Length > 150)
                return BadRequest(new { success = false, error = "Name is required (max 150 characters)" });

            string scope = string.IsNullOrWhiteSpace(dto.scope) ? "app" : dto.scope.Trim().ToLowerInvariant();
            if (scope != "app" && scope != "worker")
                return BadRequest(new { success = false, error = "scope must be 'app' or 'worker'" });

            string? appId = null;
            if (scope == "app")
            {
                appId = (dto.app_id ?? string.Empty).Trim();
                if (appId.Length == 0)
                    return BadRequest(new { success = false, error = "app_id is required for app keys" });

                var apps = await _db.GetAppsAsync();
                if (!apps.Any(a => string.Equals(a.AppId, appId, StringComparison.Ordinal)))
                    return BadRequest(new { success = false, error = $"Unknown app_id '{appId}'" });
            }

            if (dto.expires_at.HasValue && dto.expires_at.Value <= DateTimeOffset.UtcNow)
                return BadRequest(new { success = false, error = "expires_at must be in the future" });

            // The response contains the plain key. Do not let proxies or browsers cache it.
            Response.Headers["Cache-Control"] = "no-store";

            var created = await _keys.CreateAsync(name, scope, appId, dto.expires_at);
            return Ok(created);
        }

        [HttpPost("{id:int}/revoke")]
        public async Task<IActionResult> Revoke(int id)
        {
            bool ok = await _keys.RevokeAsync(id);
            if (!ok) return NotFound(new { success = false, error = "API key not found" });
            return Ok(new { success = true, id });
        }
    }
}
