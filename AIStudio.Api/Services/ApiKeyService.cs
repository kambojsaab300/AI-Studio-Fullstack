using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using AIStudio.Api.Models;
using Dapper;

namespace AIStudio.Api.Services
{
    /// <summary>
    /// Creates, validates and revokes API keys used by client web apps.
    /// Only the SHA-256 hash of a key is stored, so a leaked database
    /// does not expose usable keys.
    /// </summary>
    public class ApiKeyService
    {
        public const string Prefix = "aist_";

        private readonly DatabaseService _db;

        public ApiKeyService(DatabaseService db)
        {
            _db = db;
        }

        public static string GenerateKey()
        {
            // 256 bits of randomness, URL-safe base64 body.
            var raw = RandomNumberGenerator.GetBytes(32);
            var body = Convert.ToBase64String(raw)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
            return Prefix + body;
        }

        public static string Hash(string key)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(key));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        /// <param name="scope">"app" (needs appId) or "worker" (appId must be null).</param>
        public async Task<ApiKeyCreated> CreateAsync(string name, string scope, string? appId, DateTimeOffset? expiresAt)
        {
            string key = GenerateKey();
            string keyPrefix = key.Substring(0, 12); // "aist_" + 7 chars, display only

            using var conn = _db.CreateConnection();
            int id = await conn.ExecuteScalarAsync<int>(@"
                INSERT INTO ai_studio_api_keys (name, scope, app_id, key_prefix, key_hash, expires_at)
                OUTPUT INSERTED.id
                VALUES (@Name, @Scope, @AppId, @KeyPrefix, @KeyHash, @ExpiresAt);",
                new { Name = name, Scope = scope, AppId = appId, KeyPrefix = keyPrefix, KeyHash = Hash(key), ExpiresAt = expiresAt });

            return new ApiKeyCreated
            {
                Id = id,
                Name = name,
                Scope = scope,
                AppId = appId,
                KeyPrefix = keyPrefix,
                Key = key,
                ExpiresAt = expiresAt
            };
        }

        public async Task<IEnumerable<ApiKeyRecord>> ListAsync()
        {
            using var conn = _db.CreateConnection();
            return await conn.QueryAsync<ApiKeyRecord>(@"
                SELECT id AS Id, name AS Name, scope AS Scope, app_id AS AppId, key_prefix AS KeyPrefix, enabled AS Enabled,
                       expires_at AS ExpiresAt, last_used_at AS LastUsedAt, created_at AS CreatedAt, revoked_at AS RevokedAt
                FROM ai_studio_api_keys
                ORDER BY created_at DESC;");
        }

        /// <summary>Returns the key's record when the key is valid, enabled, not revoked and not expired; otherwise null.</summary>
        public async Task<ApiKeyRecord?> ValidateAsync(string presentedKey)
        {
            if (string.IsNullOrWhiteSpace(presentedKey)) return null;
            string trimmed = presentedKey.Trim();
            if (!trimmed.StartsWith(Prefix, StringComparison.Ordinal)) return null;

            using var conn = _db.CreateConnection();
            var record = await conn.QuerySingleOrDefaultAsync<ApiKeyRecord>(@"
                SELECT id AS Id, name AS Name, scope AS Scope, app_id AS AppId, key_prefix AS KeyPrefix, enabled AS Enabled,
                       expires_at AS ExpiresAt, last_used_at AS LastUsedAt, created_at AS CreatedAt, revoked_at AS RevokedAt
                FROM ai_studio_api_keys
                WHERE key_hash = @KeyHash
                  AND enabled = 1
                  AND revoked_at IS NULL
                  AND (expires_at IS NULL OR expires_at > SYSDATETIMEOFFSET());",
                new { KeyHash = Hash(trimmed) });

            if (record != null)
            {
                _ = TouchLastUsedAsync(record.Id); // best effort, never blocks the request
            }
            return record;
        }

        public async Task<bool> RevokeAsync(int id)
        {
            using var conn = _db.CreateConnection();
            int rows = await conn.ExecuteAsync(@"
                UPDATE ai_studio_api_keys
                SET enabled = 0, revoked_at = COALESCE(revoked_at, SYSDATETIMEOFFSET())
                WHERE id = @Id;", new { Id = id });
            return rows > 0;
        }

        private async Task TouchLastUsedAsync(int id)
        {
            try
            {
                using var conn = _db.CreateConnection();
                await conn.ExecuteAsync(
                    "UPDATE ai_studio_api_keys SET last_used_at = SYSDATETIMEOFFSET() WHERE id = @Id;",
                    new { Id = id });
            }
            catch
            {
                // Usage stamp is informational only.
            }
        }
    }
}
