using System.Net;
using System.Security.Claims;
using System.Threading.RateLimiting;
using System.IO.Compression;
using AIStudio.Api.Data;
using AIStudio.Api.Security;
using AIStudio.Api.Services;
using AIStudio.Api.Storage;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// Cloud Port binding (e.g. Render, Railway, Fly.io)
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// ---------------- Response Compression ----------------
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);

// ---------------- Services ----------------
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<DatabaseService>();
builder.Services.AddSingleton<ApiKeyService>();
builder.Services.AddSingleton<WorkerAuthService>();
builder.Services.AddSingleton<AiStudioDb>();
builder.Services.AddSingleton<CloudinaryStorage>();
builder.Services.AddSingleton<ImageUrlGuard>();
builder.Services.AddSingleton<TenantWebhookNotifier>();
builder.Services.AddHostedService<LeaseSweeper>();
builder.Services.AddHostedService<RetentionJob>();

builder.Services.AddHttpClient(ImageUrlGuard.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(20))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false }); // SSRF: redirect band
builder.Services.AddHttpClient("cloudinary-read", c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddHttpClient("tenant-webhook", c => c.Timeout = TimeSpan.FromSeconds(10));

// ---------------- Authentication ----------------
builder.Services.AddAuthentication(defaultScheme: AuthSchemes.PortalJwt)
    .AddScheme<AuthenticationSchemeOptions, PortalJwtAuthHandler>(AuthSchemes.PortalJwt, _ => { })
    .AddScheme<AuthenticationSchemeOptions, AppKeyAuthHandler>(AuthSchemes.AppKey, _ => { })
    .AddScheme<AuthenticationSchemeOptions, WorkerTokenAuthHandler>(AuthSchemes.Worker, _ => { });

builder.Services.AddAuthorization();

// ---------------- Antiforgery (CSRF) ----------------
builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = "X-CSRF-TOKEN";
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = CookieSecurePolicy.Always;
});

// ---------------- CORS ----------------
var configuredOrigins = cfg.GetSection("Cors:Origins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(o =>
{
    o.AddPolicy("web", p =>
    {
        if (configuredOrigins.Length > 0)
        {
            p.WithOrigins(configuredOrigins)
             .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
             .WithHeaders("Content-Type", "Authorization", "X-Api-Key", "X-End-User-Id", "X-CSRF-TOKEN", "bypass-tunnel-reminder")
             .AllowCredentials()
             .WithExposedHeaders("X-Total-Count", "Content-Range");
        }
        else
        {
            p.SetIsOriginAllowed(_ => true)
             .AllowAnyMethod()
             .AllowAnyHeader()
             .AllowCredentials();
        }
    });
});

// Request body default limit
builder.WebHost.ConfigureKestrel(k => k.Limits.MaxRequestBodySize = 2 * 1024 * 1024);

// ---------------- Rate Limiting ----------------
static string Partition(HttpContext ctx)
    => ctx.User.FindFirstValue("app_id") is { } app ? $"app:{app}"
     : ctx.User.FindFirstValue("worker_id") is { } w ? $"worker:{w}"
     : ctx.User.FindFirstValue("sub") is { } u ? $"user:{u}"
     : $"ip:{ctx.Connection.RemoteIpAddress}";

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = (ctx, _) =>
    {
        if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var ra))
            ctx.HttpContext.Response.Headers.RetryAfter = ((int)ra.TotalSeconds).ToString();
        return ValueTask.CompletedTask;
    };

    // Global IP limit
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter($"ip:{ctx.Connection.RemoteIpAddress}", _ => new FixedWindowRateLimiterOptions
        { PermitLimit = 300, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter($"ip:{ctx.Connection.RemoteIpAddress}",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    o.AddPolicy("create-task", ctx => ctx.User.FindFirstValue("app_id") is not null
        ? RateLimitPartition.GetTokenBucketLimiter(Partition(ctx), _ => new TokenBucketRateLimiterOptions
            { TokenLimit = 120, TokensPerPeriod = 120, ReplenishmentPeriod = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true })
        : RateLimitPartition.GetTokenBucketLimiter(Partition(ctx), _ => new TokenBucketRateLimiterOptions
            { TokenLimit = 15, TokensPerPeriod = 15, ReplenishmentPeriod = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));

    o.AddPolicy("uploads", ctx => RateLimitPartition.GetFixedWindowLimiter(Partition(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    o.AddPolicy("poll", ctx => RateLimitPartition.GetSlidingWindowLimiter(Partition(ctx),
        _ => new SlidingWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6, QueueLimit = 0 }));

    o.AddPolicy("worker", ctx => RateLimitPartition.GetFixedWindowLimiter(Partition(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 600, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    o.AddPolicy("admin", ctx => RateLimitPartition.GetFixedWindowLimiter(Partition(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));

    o.AddPolicy("health", ctx => RateLimitPartition.GetFixedWindowLimiter($"ip:{ctx.Connection.RemoteIpAddress}",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

// Controllers & ProblemDetails
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
    });
builder.Services.AddProblemDetails();

var app = builder.Build();

// ---------------- Pipeline ----------------
var fwd = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto };
fwd.KnownNetworks.Clear();
fwd.KnownProxies.Clear();
foreach (var range in cfg.GetSection("Cloudflare:Ranges").Get<string[]>() ?? Array.Empty<string>())
{
    if (range.Contains('/'))
    {
        var parts = range.Split('/');
        fwd.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(IPAddress.Parse(parts[0]), int.Parse(parts[1])));
    }
}
app.UseForwardedHeaders(fwd);
app.UseResponseCompression();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler();
    app.UseHsts();
}

app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<LegacyEndpointBlocker>(); // /api/rest, /api/rpc, worker.html, *.map -> 404 (C1, C2, C3)
app.UseHttpsRedirection();

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();
app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// CSRF token endpoint (customer portal)
app.MapGet("/api/auth/csrf", (IAntiforgery af, HttpContext ctx) =>
{
    var tokens = af.GetAndStoreTokens(ctx);
    return Results.Ok(new { token = tokens.RequestToken });
});

// Public health check
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).RequireRateLimiting("health");

app.MapControllers();

// Clean SPA Fallback Routing for Admin, Apps, and Customer
app.MapFallback(async context =>
{
    var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";
    var webRoot = app.Environment.WebRootPath;
    if (string.IsNullOrEmpty(webRoot) || !Directory.Exists(webRoot))
    {
        webRoot = Path.Combine(AppContext.BaseDirectory, "wwwroot");
    }

    if (path.StartsWith("/admin"))
    {
        var adminFile = Path.Combine(webRoot, "admin.html");
        if (File.Exists(adminFile))
        {
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(adminFile);
            return;
        }
    }
    else if (path.StartsWith("/app"))
    {
        var appFile = Path.Combine(webRoot, "app.html");
        if (File.Exists(appFile))
        {
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(appFile);
            return;
        }
    }
    else if (path.StartsWith("/customer"))
    {
        var custFile = Path.Combine(webRoot, "customer.html");
        if (File.Exists(custFile))
        {
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(custFile);
            return;
        }
    }

    if (!path.StartsWith("/api") && !path.StartsWith("/swagger"))
    {
        var indexFile = Path.Combine(webRoot, "index.html");
        if (File.Exists(indexFile))
        {
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(indexFile);
            return;
        }
    }

    context.Response.StatusCode = 404;
});

app.Run();
