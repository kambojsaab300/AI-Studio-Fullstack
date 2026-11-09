using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using AIStudio.Api.Data;
using AIStudio.Api.Security;
using AIStudio.Api.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AIStudio.Api.Controllers;

public sealed record CreateTaskRequest(
    string TaskType, string Model, string? AspectRatio, string? ImageSize, int BatchCount, string? Prompt,
    Guid? InputAssetId, Guid? FaceAssetId, Guid? StyleAssetId, Guid[]? ExtraAssetIds, string[]? FamilyRoleKeys,
    string IdempotencyKey);
// NOTE: is request me user_id / app_id / priority / system_text field hi nahi hai. Bhejoge to ignore.

/// <summary>Tenant aur portal dono ke liye same logic. Owner hamesha server tay karta hai.</summary>
public abstract class TaskEndpointsBase(AiStudioDb db, CloudinaryStorage storage) : ControllerBase
{
    protected abstract (string AppId, string UserId)? Owner();
    protected abstract string Source { get; }

    [HttpPost("uploads"), RequestSizeLimit(ImageSniffer.MaxBytes + 64 * 1024), EnableRateLimiting("uploads")]
    public async Task<IActionResult> Upload(IFormFile file, CancellationToken ct)
    {
        if (Owner() is not { } o) return Unauthorized();
        if (file is null || file.Length is 0 or > ImageSniffer.MaxBytes) return BadRequest(new { error = "FILE_SIZE" });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();
        var type = ImageSniffer.DetectContentType(bytes);
        if (type is null) return BadRequest(new { error = "FILE_TYPE" });

        // TODO: yahan image moderation (NSFW / minor) chalao; fail = 422, asset save mat karo.
        var up = await storage.UploadAsync(bytes, o.AppId, "input", ct);
        var assetId = await db.CreateAssetAsync(o.AppId, o.UserId, "input", up.PublicId, type, up.Bytes, up.Width, up.Height, retentionDays: 30);
        return Ok(new { assetId });
    }

    [HttpPost("tasks"), EnableRateLimiting("create-task")]
    public async Task<IActionResult> Create([FromBody] CreateTaskRequest r)
    {
        if (Owner() is not { } o) return Unauthorized();
        if (string.IsNullOrWhiteSpace(r.IdempotencyKey) || r.IdempotencyKey.Length is < 8 or > 100)
            return BadRequest(new { error = "IDEMPOTENCY_KEY" });

        var (code, publicId) = await db.CreateTaskAsync(new CreateTaskArgs(
            o.AppId, o.UserId, Source, r.TaskType, r.Model, r.AspectRatio, r.ImageSize, r.BatchCount,
            r.Prompt?.Trim(), r.InputAssetId, r.FaceAssetId, r.StyleAssetId,
            r.ExtraAssetIds is { Length: > 0 } ? JsonSerializer.Serialize(r.ExtraAssetIds) : null,
            r.FamilyRoleKeys is { Length: > 0 } ? JsonSerializer.Serialize(r.FamilyRoleKeys) : null,
            r.IdempotencyKey));

        return code is 0 or 1 ? Accepted(new { publicId, duplicate = code == 1 }) : TaskErrors.ToResult(code);
    }

    [HttpGet("tasks/{publicId:guid}"), EnableRateLimiting("poll")]
    public async Task<IActionResult> Get(Guid publicId)
    {
        if (Owner() is not { } o) return Unauthorized();
        var t = await db.GetTaskAsync(o.AppId, o.UserId, publicId);
        if (t is null) return NotFound();   // dusre user ka ho ya na ho: same jawab
        var count = t.OutputImageUrls is null ? 0 : JsonSerializer.Deserialize<string[]>(t.OutputImageUrls)?.Length ?? 0;
        return Ok(new
        {
            t.PublicId, t.TaskType, t.Status, t.ErrorCode, t.OutputText, t.FaceMatchScore, t.CreatedAt, t.FinishedAt,
            // Cloudinary URL kabhi bahar nahi; sirf API ka owner-checked path
            images = Enumerable.Range(0, count).Select(i => Url.Action(nameof(Image), new { publicId, index = i })).ToArray()
        });
    }

    [HttpGet("tasks"), EnableRateLimiting("poll")]
    public async Task<IActionResult> List([FromQuery] DateTimeOffset? before, [FromQuery] int limit = 20)
    {
        if (Owner() is not { } o) return Unauthorized();
        var rows = await db.ListTasksAsync(o.AppId, o.UserId, before, Math.Clamp(limit, 1, 50));
        return Ok(rows.Select(t => new { t.PublicId, t.TaskType, t.Status, t.ErrorCode, t.CreatedAt, t.FinishedAt }));
    }

    [HttpGet("tasks/{publicId:guid}/images/{index:int}"), EnableRateLimiting("poll")]
    public async Task<IActionResult> Image(Guid publicId, int index, CancellationToken ct)
    {
        if (Owner() is not { } o) return Unauthorized();
        if (index is < 0 or > 9) return NotFound();
        var outputRef = await db.GetTaskOutputRefAsync(o.AppId, o.UserId, publicId, index);
        if (outputRef is null) return NotFound();
        var stream = await storage.OpenReadByCanonicalAsync(outputRef, ct);
        if (stream is null) return NotFound();
        Response.Headers.CacheControl = "private, max-age=300";
        var type = outputRef.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ? "image/png"
                 : outputRef.EndsWith(".webp", StringComparison.OrdinalIgnoreCase) ? "image/webp" : "image/jpeg";
        return File(stream, type);
    }

    [HttpPost("tasks/{publicId:guid}/cancel"), EnableRateLimiting("poll")]
    public async Task<IActionResult> Cancel(Guid publicId)
    {
        if (Owner() is not { } o) return Unauthorized();
        var code = await db.CancelTaskAsync(o.AppId, o.UserId, publicId);
        return code == 0 ? Ok(new { status = "cancelled" }) : TaskErrors.ToResult(code);
    }

    [HttpDelete("tasks/{publicId:guid}"), EnableRateLimiting("poll")]
    public async Task<IActionResult> Delete(Guid publicId)
    {
        if (Owner() is not { } o) return Unauthorized();
        var code = await db.DeleteTaskAsync(o.AppId, o.UserId, publicId);
        return code == 0 ? NoContent() : TaskErrors.ToResult(code);
    }
}

/// <summary>
/// Tenant (WearGen API) -> server-to-server. App key se app_id; end-user id header se
/// (tenant ne apne user ko khud authenticate kiya hai).
/// </summary>
[ApiController, Route("api/v1"), Authorize(AuthenticationSchemes = AuthSchemes.AppKey)]
public sealed class TenantTasksController(AiStudioDb db, CloudinaryStorage storage) : TaskEndpointsBase(db, storage)
{
    private static readonly Regex UserIdFormat = new("^[A-Za-z0-9_-]{1,64}$", RegexOptions.Compiled);
    protected override string Source => "tenant";

    protected override (string AppId, string UserId)? Owner()
    {
        var appId = User.FindFirstValue("app_id");
        var endUser = Request.Headers["X-End-User-Id"].ToString();
        if (appId is null || !UserIdFormat.IsMatch(endUser)) return null;
        return (appId, endUser);
    }
}

/// <summary>AI Studio ke apne customer portal ke users (JWT / cookie). app_id config se, URL se nahi.</summary>
[ApiController, Route("api/customer"), Authorize]
[CsrfProtect]   // cookie auth ke saath CSRF se bachao (H6)
public sealed class CustomerTasksController(AiStudioDb db, CloudinaryStorage storage) : TaskEndpointsBase(db, storage)
{
    protected override string Source => "portal";

    // App and user both come from the signed JWT (app_id is set at login), never from the request.
    protected override (string AppId, string UserId)? Owner()
    {
        var userId = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        var appId = User.FindFirstValue("app_id");
        return string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(appId) ? null : (appId, userId);
    }

    // Server downloads the image (only from allowed hosts, private IPs blocked, size and type checked),
    // then stores it as an asset. The client gets an asset id, never a raw URL back.
    [HttpPost("assets/from-url"), EnableRateLimiting("uploads")]
    public async Task<IActionResult> AssetFromUrl([FromBody] UrlAssetRequest r, [FromServices] ImageUrlGuard guard, CancellationToken ct)
    {
        if (Owner() is not { } o) return Unauthorized();
        var img = await guard.DownloadAsync(r.Url ?? "", ct);
        if (img is null) return BadRequest(new { error = "URL_NOT_ALLOWED_OR_NOT_IMAGE" });
        var (bytes, type) = img.Value;
        var up = await storage.UploadAsync(bytes, o.AppId, "input", ct);
        var assetId = await db.CreateAssetAsync(o.AppId, o.UserId, "input", up.PublicId, type, up.Bytes, up.Width, up.Height, retentionDays: 30);
        return Ok(new { assetId });
    }
}

public sealed record UrlAssetRequest(string? Url);

public static class TaskErrors
{
    // SQL return codes -> HTTP + chhota error code (internal detail kabhi nahi)
    public static IActionResult ToResult(int code) => code switch
    {
        70 => new ObjectResult(new { error = "MAINTENANCE" }) { StatusCode = 503 },
        71 => new ObjectResult(new { error = "APP_DISABLED" }) { StatusCode = 403 },
        72 => new BadRequestObjectResult(new { error = "TOOL_NOT_ALLOWED" }),
        73 => new BadRequestObjectResult(new { error = "PROMPT_REQUIRED" }),
        74 => new BadRequestObjectResult(new { error = "PROMPT_TOO_LONG" }),
        75 => new BadRequestObjectResult(new { error = "MODEL_NOT_ALLOWED" }),
        76 => new BadRequestObjectResult(new { error = "ASPECT_OR_SIZE_NOT_ALLOWED" }),
        77 => new ObjectResult(new { error = "SIZE_NOT_IN_PLAN" }) { StatusCode = 402 },
        78 => new BadRequestObjectResult(new { error = "BATCH_NOT_ALLOWED" }),
        79 => new BadRequestObjectResult(new { error = "INVALID_ASSET" }),
        80 => new ObjectResult(new { error = "USER_DAILY_LIMIT" }) { StatusCode = 429 },
        81 => new ObjectResult(new { error = "APP_DAILY_LIMIT" }) { StatusCode = 429 },
        82 => new ObjectResult(new { error = "TOO_MANY_OPEN_TASKS" }) { StatusCode = 429 },
        83 => new NotFoundResult(),
        84 => new ConflictObjectResult(new { error = "NOT_ALLOWED_IN_THIS_STATE" }),
        _ => new ObjectResult(new { error = "UNKNOWN" }) { StatusCode = 500 }
    };
}
