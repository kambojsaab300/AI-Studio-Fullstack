using System.Security.Claims;
using System.Text.Json;
using AIStudio.Api.Data;
using AIStudio.Api.Security;
using AIStudio.Api.Services;
using AIStudio.Api.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AIStudio.Api.Controllers;

public sealed record WorkerRegisterRequest(
    [property: System.Text.Json.Serialization.JsonPropertyName("wanted")] string? Wanted,
    [property: System.Text.Json.Serialization.JsonPropertyName("p_wanted")] string? PWanted);

/// <summary>
/// Worker endpoints (C9, H3, H4, C10):
/// - auth: per-worker token + IP allowlist (SQL me)
/// - claim: ek task, lease + budget SQL me; prompts sirf yahan
/// - inputs: worker ko image sirf valid lease pe, API se stream (Cloudinary URL / secret worker ke paas nahi)
/// - complete: worker image BYTES bhejta hai; upload API karta hai; worker koi URL nahi bhej sakta
/// Purane /pending, /config, /budget-take routes LegacyEndpointBlocker band karta hai.
/// </summary>
[ApiController, Route("api/worker"), Authorize(AuthenticationSchemes = AuthSchemes.Worker)]
[EnableRateLimiting("worker")]
public sealed class WorkerController(AiStudioDb db, CloudinaryStorage storage, ImageUrlGuard urlGuard,
    TenantWebhookNotifier webhooks) : ControllerBase
{
    private string WorkerId => User.FindFirstValue("worker_id")!;
    private string Ip => HttpContext.Connection.RemoteIpAddress?.ToString() ?? "";

    /// <summary>
    /// Browser worker enrollment. Header X-Api-Key = worker enrollment key (optional, enforced by Security:Enforce).
    /// Body: { "wanted": "worker_3" } (optional). Returns worker_id + worker_token (send as "Authorization: Worker &lt;token&gt;").
    /// </summary>
    [HttpPost("register"), AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] WorkerRegisterRequest? body, [FromServices] WorkerAuthService auth)
    {
        string? wanted = body?.Wanted ?? body?.PWanted;
        string? key = Request.Headers["X-Api-Key"].ToString();
        var r = await auth.RegisterAsync(wanted, string.IsNullOrWhiteSpace(key) ? null : key);
        if (!r.Ok) return StatusCode(r.Status, new { error = r.Error });
        return Ok(new { worker_id = r.WorkerId, worker_token = r.Token });
    }

    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat()
    {
        var (paused, drain, blocked) = await db.HeartbeatAsync(WorkerId, Ip);
        return blocked ? Unauthorized() : Ok(new { paused, drain });
    }

    [HttpPost("claim")]
    public async Task<IActionResult> Claim()
    {
        var (code, t) = await db.ClaimNextAsync(WorkerId, Ip, leaseSeconds: 300);
        if (code == 90) return Unauthorized();
        if (code == 91) return StatusCode(429, new { error = "DAILY_BUDGET_REACHED" });
        if (code == 70) return StatusCode(503, new { error = "MAINTENANCE" });
        if (t is null) return NoContent();   // queue khaali

        string Input(string role, int i = 0) => $"/api/worker/tasks/{t.PublicId}/inputs/{role}?lease={t.LeaseId}&i={i}";
        var extras = t.ExtraPublicIds is null ? 0 : JsonDocument.Parse(t.ExtraPublicIds).RootElement.GetArrayLength();

        return Ok(new
        {
            t.PublicId, t.LeaseId, t.LeaseExpiresAt, t.TaskType, t.Model, t.Prompt, t.AspectRatio, t.ImageSize,
            t.BatchCount, t.FamilyRoleKeys, t.Attempts, t.FaceCheck, t.Edit, t.Transparent,
            prompts = new { t.SystemText, t.RoleText, t.NegativeText, t.PromptVersion },
            inputs = new
            {
                input = t.InputPublicId is not null ? Input("input") : null,
                face = t.FacePublicId is not null ? Input("face") : null,
                style = t.StylePublicId is not null ? Input("style") : null,
                extra = Enumerable.Range(0, extras).Select(i => Input("extra", i)).ToArray()
            },
            // Legacy tasks: worker ye URLs khud fetch na kare; neeche wale legacy endpoint se guard ke through lo
            legacy = new { t.InputImageUrl, t.FaceImageUrl, t.StyleImageUrl, t.ExtraImageUrls }
        });
    }

    [HttpGet("tasks/{publicId:guid}/inputs/{role}")]
    public async Task<IActionResult> Input(Guid publicId, string role, [FromQuery] Guid lease, [FromQuery] int i, CancellationToken ct)
    {
        if (role is not ("input" or "face" or "style" or "extra") || i is < 0 or > 7) return NotFound();
        var asset = await db.GetWorkerTaskAssetAsync(WorkerId, publicId, lease, role, i);
        if (asset is null) return NotFound();
        var stream = await storage.OpenReadByPublicIdAsync(asset.PublicId, asset.ContentType, ct);
        return stream is null ? NotFound() : File(stream, asset.ContentType);
    }

    /// <summary>Legacy URL tasks ke liye: SSRF guard ke saath API fetch karta hai.</summary>
    [HttpPost("legacy-fetch")]
    public async Task<IActionResult> LegacyFetch([FromBody] LegacyFetchRequest r, CancellationToken ct)
    {
        var img = await urlGuard.DownloadAsync(r.Url, ct);
        if (img is null)
        {
            await db.RiskFlagAsync("SSRF_BLOCKED", workerId: WorkerId, detail: r.Url, ip: Ip);
            return BadRequest(new { error = "URL_NOT_ALLOWED" });
        }
        return File(img.Value.Bytes, img.Value.ContentType);
    }

    public sealed record LegacyFetchRequest(string Url);

    [HttpPost("tasks/{publicId:guid}/complete"), RequestSizeLimit(60 * 1024 * 1024)]
    public async Task<IActionResult> Complete(Guid publicId, [FromForm] CompleteForm f, CancellationToken ct)
    {
        var urls = new List<string>();
        var uploaded = new List<UploadedImage>();
        if (f.Success)
        {
            // Text tasks (chat) finish with output_text and no images; image tasks need 1..10 images.
            bool textOnly = !string.IsNullOrWhiteSpace(f.OutputText) && (f.Images is null || f.Images.Count == 0);
            if (!textOnly && (f.Images is null || f.Images.Count is 0 or > 10)) return BadRequest(new { error = "IMAGES" });
            foreach (var file in f.Images ?? new List<IFormFile>())
            {
                if (file.Length is 0 or > ImageSniffer.MaxBytes) return BadRequest(new { error = "IMAGE_SIZE" });
                using var ms = new MemoryStream();
                await file.CopyToAsync(ms, ct);
                var bytes = ms.ToArray();
                if (ImageSniffer.DetectContentType(bytes) is null) return BadRequest(new { error = "IMAGE_TYPE" });
                var up = await storage.UploadAsync(bytes, "outputs", "output", ct);
                uploaded.Add(up);
                urls.Add(up.CanonicalUrl);
            }
        }

        var res = await db.CompleteAsync(new CompleteArgs(
            WorkerId, publicId, f.LeaseId, f.Success, f.Retryable,
            urls.Count > 0 ? JsonSerializer.Serialize(urls) : null,
            f.OutputText is { Length: > 20000 } ? f.OutputText[..20000] : f.OutputText,
            SafeCode(f.ErrorCode), f.ErrorDetail is { Length: > 2000 } ? f.ErrorDetail[..2000] : f.ErrorDetail,
            f.ProcessMs, f.FaceMatchScore, storage.OutputPrefix));

        if (res.Code is 92 or 93)
        {
            foreach (var up in uploaded) await storage.DeleteAsync(up.PublicId, ct);   // orphan uploads hatao
            return res.Code == 92 ? Conflict(new { error = "LEASE_INVALID" }) : BadRequest(new { error = "OUTPUT_REJECTED" });
        }

        // Outputs bhi retention me (90 din), taaki RetentionJob inhe baad me delete kare
        if (res.FinalStatus == "completed" && res.AppId is not null && res.UserId is not null)
            foreach (var up in uploaded)
                await db.CreateAssetAsync(res.AppId, res.UserId, "output", up.PublicId,
                    up.Format == "png" ? "image/png" : up.Format == "webp" ? "image/webp" : "image/jpeg",
                    up.Bytes, up.Width, up.Height, retentionDays: 90);

        if (res.FinalStatus is "completed" or "failed" && res.AppId is not null)
            await webhooks.NotifyAsync(res.AppId, res.UserId!, publicId, res.FinalStatus, res.FinalStatus == "failed" ? SafeCode(f.ErrorCode) : null, ct);

        return Ok(new { status = res.FinalStatus });
    }

    public sealed class CompleteForm
    {
        public Guid LeaseId { get; set; }
        public bool Success { get; set; }
        public bool Retryable { get; set; }
        public string? OutputText { get; set; }
        public string? ErrorCode { get; set; }
        public string? ErrorDetail { get; set; }
        public int? ProcessMs { get; set; }
        public decimal? FaceMatchScore { get; set; }
        public List<IFormFile>? Images { get; set; }
    }

    // Customer ko jaane wala error code sirf in me se
    private static readonly HashSet<string> AllowedCodes = new(StringComparer.Ordinal)
        { "SAFETY_BLOCKED", "FACE_NOT_FOUND", "FACE_MISMATCH", "BAD_INPUT", "TIMEOUT", "GENERATION_FAILED" };

    private static string? SafeCode(string? c) => c is null ? null : AllowedCodes.Contains(c) ? c : "GENERATION_FAILED";
}
