using AIStudio.Api.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.IO;
using System.IO.Compression;

var builder = WebApplication.CreateBuilder(args);

// Cloud Port binding (e.g. Render, Railway, Fly.io)
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// 1. High Performance In-Memory Cache
builder.Services.AddMemoryCache();

// 2. High Performance Gzip & Brotli Response Compression (8x smaller payloads)
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

// Add Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = null; // Preserve exact casing
    });

builder.Services.AddSingleton<DatabaseService>();

// Configure CORS for local development and web portals
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod()
              .WithExposedHeaders("X-Total-Count", "Content-Range", "X-Page-Limit", "X-Page-Offset");
    });
});

// Swagger / OpenAPI documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "AI Studio .NET Core API", Version = "v1", Description = "High-performance .NET Core backend for AI Studio with Microsoft SQL Server" });
});

var app = builder.Build();

// Enable Response Compression early in pipeline
app.UseResponseCompression();

// Enable Static & Default Files for Frontend SPA Hosting
app.UseDefaultFiles();
app.UseStaticFiles();

// Enable Swagger UI in both Dev and Prod for easy testing
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "AI Studio API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors();
app.UseAuthorization();

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

    if (!path.StartsWith("/api") && !path.StartsWith("/rest") && !path.StartsWith("/swagger"))
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
