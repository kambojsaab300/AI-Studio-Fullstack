using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using AIStudio.Api.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace AIStudio.Api.Security;

public static class AuthSchemes
{
    public const string AppKey = "AppKey";        // tenant backend (WearGen API) -> server-to-server
    public const string Worker = "WorkerToken";   // headless worker
    public const string PortalJwt = "PortalJwt";  // customer & admin JWT / cookie auth
}

public static class Hashing
{
    public static string Sha256Hex(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();
}

/// <summary>
/// "X-Api-Key" header -> sp_api_key_lookup. Key ka app_id DB se aata hai, body se kabhi nahi.
/// Cache sirf 60 sec, taaki revoke jaldi lage. Ye key kabhi browser / APK me nahi honi chahiye.
/// </summary>
public sealed class AppKeyAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder,
    AiStudioDb db, IMemoryCache cache) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-Api-Key", out var raw) || string.IsNullOrWhiteSpace(raw))
            return AuthenticateResult.NoResult();

        var key = raw.ToString().Trim();
        if (key.Length is < 32 or > 200) return AuthenticateResult.Fail("bad key");

        var ip = Context.Connection.RemoteIpAddress?.ToString() ?? "";
        var hash = Hashing.Sha256Hex(key);
        var cacheKey = $"appkey:{hash}:{ip}";

        if (!cache.TryGetValue(cacheKey, out ApiKeyRow? row))
        {
            row = await db.LookupApiKeyAsync(hash, ip);
            cache.Set(cacheKey, row, TimeSpan.FromSeconds(row is null ? 10 : 60));
        }
        if (row is null || row.Scope != "app" || string.IsNullOrEmpty(row.AppId))
            return AuthenticateResult.Fail("invalid key");

        var identity = new ClaimsIdentity(new[]
        {
            new Claim("app_id", row.AppId),
            new Claim("key_id", row.KeyId.ToString()),
            new Claim("rl", row.RateLimitPerMin.ToString())
        }, Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }
}

/// <summary>"Authorization: Worker &lt;token&gt;" -> sp_worker_auth (revoke, expiry, IP allowlist SQL me).</summary>
public sealed class WorkerTokenAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder,
    AiStudioDb db) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var auth = Request.Headers.Authorization.ToString();
        if (!auth.StartsWith("Worker ", StringComparison.Ordinal)) return AuthenticateResult.NoResult();
        var token = auth["Worker ".Length..].Trim();
        if (token.Length is < 32 or > 200) return AuthenticateResult.Fail("bad token");

        var ip = Context.Connection.RemoteIpAddress?.ToString() ?? "";
        var workerId = await db.AuthWorkerAsync(Hashing.Sha256Hex(token), ip);
        if (workerId is null)
        {
            await db.RiskFlagAsync("WORKER_AUTH_FAILED", ip: ip);
            return AuthenticateResult.Fail("invalid worker");
        }

        var identity = new ClaimsIdentity(new[] { new Claim("worker_id", workerId) }, Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }
}

/// <summary>
/// Authenticates customer portal & admin JWT from cookie or Authorization: Bearer header.
/// </summary>
public sealed class PortalJwtAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder,
    IConfiguration config) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!AIStudio.Api.Services.AdminTokenValidator.TryGetVerifiedToken(Request, config, out var jwt) || jwt is null)
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = jwt.Claims.ToList();
        var sub = jwt.Claims.FirstOrDefault(c => c.Type == "sub" || c.Type == ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(sub))
        {
            if (!claims.Any(c => c.Type == "sub")) claims.Add(new Claim("sub", sub));
            if (!claims.Any(c => c.Type == ClaimTypes.NameIdentifier)) claims.Add(new Claim(ClaimTypes.NameIdentifier, sub));
        }

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
    }
}

/// <summary>
/// Purane [RequireAdmin] ki jagah: JWT signature ke saath DB me bhi check
/// (role = admin AND ai_studio_admins me row AND MFA on AND disabled nahi).
/// Har admin request audit log me.
/// </summary>
public sealed class RequireAdminDbAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var http = ctx.HttpContext;
        var userId = http.User.FindFirstValue("sub") ?? http.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var mfaDone = http.User.HasClaim("amr", "mfa");   // login ke waqt TOTP verify hone pe ye claim do
        var db = http.RequestServices.GetRequiredService<AiStudioDb>();

        if (userId is null || !mfaDone || !await db.IsAdminAsync(userId))
        {
            await db.RiskFlagAsync("ADMIN_DENIED", userId: userId, ip: http.Connection.RemoteIpAddress?.ToString(),
                detail: $"{http.Request.Method} {http.Request.Path}");
            ctx.Result = new NotFoundResult();   // admin route ka hona bhi mat batao
            return;
        }

        var executed = await next();
        if (!HttpMethods.IsGet(http.Request.Method))
            await db.AuditAsync(userId, $"{http.Request.Method} {http.Request.Path}", ctx.ActionDescriptor.DisplayName,
                http.Connection.RemoteIpAddress?.ToString(),
                newValue: executed.Exception is null ? "ok" : "error");
    }
}
