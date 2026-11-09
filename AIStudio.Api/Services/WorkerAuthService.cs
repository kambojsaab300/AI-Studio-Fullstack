using System;
using System.Security.Cryptography;
using System.Threading.Tasks;
using Dapper;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace AIStudio.Api.Services
{
    public sealed class WorkerRegisterResult
    {
        public bool Ok { get; init; }
        public int Status { get; init; }
        public string? Error { get; init; }
        public string WorkerId { get; init; } = string.Empty;
        /// <summary>Null for legacy registrations (no enrollment key, enforcement off).</summary>
        public string? Token { get; init; }
    }

    /// <summary>
    /// Worker identity. A worker gets an id plus a secret token when it enrolls with a
    /// worker enrollment key. Every worker call must present that token (X-Worker-Token)
    /// and it must belong to the worker id in the request.
    ///
    /// Rollout switch: Security:Enforce (env: Security__Enforce=true).
    /// When false, calls without a token are still accepted (old worker pages keep working).
    /// Calls that present a token are always verified.
    /// </summary>
    public class WorkerAuthService
    {
        public const string TokenHeader = "X-Worker-Token";

        private readonly DatabaseService _db;
        private readonly ApiKeyService _keys;
        private readonly IConfiguration _config;

        public WorkerAuthService(DatabaseService db, ApiKeyService keys, IConfiguration config)
        {
            _db = db;
            _keys = keys;
            _config = config;
        }

        public bool Enforce => string.Equals(_config["Security:Enforce"], "true", StringComparison.OrdinalIgnoreCase);

        public static string? ReadToken(HttpRequest request)
        {
            string value = request.Headers[TokenHeader].ToString();
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        public static string NewToken()
        {
            var raw = RandomNumberGenerator.GetBytes(32);
            return "wkr_" + Convert.ToBase64String(raw).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }

        /// <summary>
        /// Enrolls a worker. With a valid worker enrollment key: returns the worker id and a new token.
        /// Without a key: refused when enforcement is on, otherwise a legacy registration.
        /// A key that is present but invalid is always refused.
        /// </summary>
        public async Task<WorkerRegisterResult> RegisterAsync(string? wanted, string? enrollmentKey)
        {
            if (!string.IsNullOrWhiteSpace(enrollmentKey))
            {
                var key = await _keys.ValidateAsync(enrollmentKey);
                if (key == null || key.Scope != "worker")
                    return Fail(401, "Worker key invalid, disabled or expired.");

                string id = await _db.RegisterWorkerAsync(wanted);
                string token = NewToken();
                await SetTokenHashAsync(id, ApiKeyService.Hash(token));
                return new WorkerRegisterResult { Ok = true, Status = 200, WorkerId = id, Token = token };
            }

            if (Enforce)
                return Fail(401, "Worker key required. Enter the worker key in the worker page.");

            string legacyId = await _db.RegisterWorkerAsync(wanted);
            return new WorkerRegisterResult { Ok = true, Status = 200, WorkerId = legacyId, Token = null };
        }

        /// <summary>True when the call may act as workerId.</summary>
        public async Task<bool> AuthorizeWorkerAsync(HttpRequest request, string workerId)
        {
            string? token = ReadToken(request);
            if (token == null) return !Enforce;
            if (string.IsNullOrWhiteSpace(workerId)) return false;

            string? owner = await WorkerIdForTokenAsync(token);
            return owner != null && string.Equals(owner, workerId, StringComparison.Ordinal);
        }

        /// <summary>True when the request carries any valid worker token (used for reads that workers need).</summary>
        public async Task<bool> HasValidWorkerTokenAsync(HttpRequest request)
        {
            string? token = ReadToken(request);
            return token != null && await WorkerIdForTokenAsync(token) != null;
        }

        private async Task<string?> WorkerIdForTokenAsync(string token)
        {
            using var conn = _db.CreateConnection();
            return await conn.ExecuteScalarAsync<string?>(
                "SELECT worker_id FROM ai_studio_workers WHERE token_hash = @Hash;",
                new { Hash = ApiKeyService.Hash(token) });
        }

        private async Task SetTokenHashAsync(string workerId, string hash)
        {
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync(
                "UPDATE ai_studio_workers SET token_hash = @Hash WHERE worker_id = @Id;",
                new { Hash = hash, Id = workerId });
        }

        private static WorkerRegisterResult Fail(int status, string error) =>
            new WorkerRegisterResult { Ok = false, Status = status, Error = error };
    }
}
