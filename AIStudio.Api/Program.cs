using AIStudio.Api.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// Cloud Port binding (e.g. Render, Railway, Fly.io)
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// Add Services
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
              .WithExposedHeaders("X-Total-Count", "Content-Range");
    });
});

// Swagger / OpenAPI documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "AI Studio .NET Core API", Version = "v1", Description = "High-performance .NET Core backend for AI Studio with Microsoft SQL Server" });
});

var app = builder.Build();

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

// Health check endpoint
app.MapGet("/", () => Results.Ok(new
{
    service = "AI Studio .NET Core API",
    status = "healthy",
    database = "Microsoft SQL Server",
    time = DateTimeOffset.UtcNow,
    swagger = "/swagger"
}));

app.Run();
