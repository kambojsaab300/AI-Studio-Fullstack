using AIStudio.Api.Data;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace AIStudio.Api.Security;

/// <summary>
/// H6 CSRF: cookie se login hue user ke har POST / PUT / DELETE pe "X-CSRF-TOKEN" header zaroori.
/// (Bearer token wali requests CSRF-prone nahi hoti, unhe skip karte hain.)
/// Client: pehle GET /api/auth/csrf, phir token header me bhejo.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class CsrfProtectAttribute : Attribute, IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext ctx)
    {
        var req = ctx.HttpContext.Request;
        if (HttpMethods.IsGet(req.Method) || HttpMethods.IsHead(req.Method) || HttpMethods.IsOptions(req.Method)) return;
        if (req.Headers.Authorization.ToString().StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return;

        var af = ctx.HttpContext.RequestServices.GetRequiredService<IAntiforgery>();
        try { await af.ValidateRequestAsync(ctx.HttpContext); }
        catch (AntiforgeryValidationException) { ctx.Result = new BadRequestObjectResult(new { error = "CSRF" }); }
    }
}

/// <summary>Security headers har response pe.</summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task Invoke(HttpContext ctx)
    {
        var h = ctx.Response.Headers;
        h["X-Content-Type-Options"] = "nosniff";
        h["X-Frame-Options"] = "DENY";
        h["Referrer-Policy"] = "strict-origin-when-cross-origin";
        h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        // Apne frontend ke hisaab se adjust karo (fonts / analytics domains add karne pad sakte hain)
        h["Content-Security-Policy"] =
            "default-src 'self'; img-src 'self' data: blob:; connect-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
        h.Remove("Server");
        h.Remove("X-Powered-By");
        return next(ctx);
    }
}

/// <summary>
/// C1 / C2: purane generic routes band. Hit aaye to 404 + risk flag (koi purana client ya attacker).
/// </summary>
public sealed class LegacyEndpointBlocker(RequestDelegate next)
{
    private static readonly string[] Blocked =
    {
        "/api/rest", "/rest/v1", "/api/rpc", "/rpc",
        "/api/worker/budget-take", "/api/worker/config", "/api/worker/pending",
        "/swagger", "/worker.html", "/worker.bundle.js"
    };

    public async Task Invoke(HttpContext ctx, AiStudioDb db)
    {
        var path = ctx.Request.Path.Value ?? "";
        if (Blocked.Any(b => path.StartsWith(b, StringComparison.OrdinalIgnoreCase)) || path.EndsWith(".map", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                await db.RiskFlagAsync("LEGACY_ENDPOINT_HIT", ip: ctx.Connection.RemoteIpAddress?.ToString(),
                    detail: $"{ctx.Request.Method} {path}");
            }
            catch { }
            ctx.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }
        await next(ctx);
    }
}
