using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using AIStudio.Api.Data;
using AIStudio.Api.Storage;

namespace AIStudio.Api.Services;

/// <summary>
/// Task complete / fail hone pe tenant (WearGen API) ko HMAC-signed webhook.
/// Config (secret env me): Tenants:{appId}:WebhookUrl, Tenants:{appId}:WebhookSecret
/// Header: X-AIStudio-Signature: t={unix},v1={hex(HMACSHA256(secret, t + "." + body))}
/// Tenant: signature verify kare, t 5 min se purana ho to reject, publicId pe dedupe kare,
/// aur "failed" pe apne ledger me token refund kare.
/// </summary>
public sealed class TenantWebhookNotifier(IHttpClientFactory http, IConfiguration cfg, ILogger<TenantWebhookNotifier> log)
{
    public async Task NotifyAsync(string appId, string userId, Guid publicId, string status, string? errorCode, CancellationToken ct)
    {
        var url = cfg[$"Tenants:{appId}:WebhookUrl"];
        var secret = cfg[$"Tenants:{appId}:WebhookSecret"];
        if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(secret)) return;   // portal app: webhook nahi

        var body = JsonSerializer.Serialize(new { publicId, userId, status, errorCode });
        var t = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var sig = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes($"{t}.{body}"))).ToLowerInvariant();

        for (var attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(body, Encoding.UTF8, "application/json")
                };
                req.Headers.Add("X-AIStudio-Signature", $"t={t},v1={sig}");
                using var resp = await http.CreateClient("tenant-webhook").SendAsync(req, ct);
                if (resp.IsSuccessStatusCode) return;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogWarning(ex, "Webhook to {App} failed (attempt {Attempt})", appId, attempt);
            }
            await Task.Delay(TimeSpan.FromSeconds(2 * attempt), ct);
        }
        log.LogError("Webhook to {App} for {Task} gave up; tenant poll karega", appId, publicId);
    }
}

/// <summary>Har minute: expired leases -> retry ya fail (H4). Fail hue tasks ka tenant ko webhook.</summary>
public sealed class LeaseSweeper(IServiceScopeFactory scopes, ILogger<LeaseSweeper> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stop))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AiStudioDb>();
                var hooks = scope.ServiceProvider.GetRequiredService<TenantWebhookNotifier>();
                foreach (var t in await db.RequeueExpiredLeasesAsync())
                    if (t.NewStatus == "failed")
                        await hooks.NotifyAsync(t.AppId, t.UserId, t.PublicId, "failed", "TIMEOUT", stop);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "Lease sweeper failed");
            }
        }
    }
}

/// <summary>Har ghante: retention ke hisaab se purani photos Cloudinary se delete (privacy).</summary>
public sealed class RetentionJob(IServiceScopeFactory scopes, ILogger<RetentionJob> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        while (await timer.WaitForNextTickAsync(stop))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AiStudioDb>();
                var storage = scope.ServiceProvider.GetRequiredService<CloudinaryStorage>();
                foreach (var a in await db.AssetsDueForDeletionAsync(200))
                {
                    await storage.DeleteAsync(a.PublicId, stop);
                    await db.MarkAssetDeletedAsync(a.AssetId);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "Retention job failed");
            }
        }
    }
}
