using System.Security.Claims;
using System.Text.Json;
using AIStudio.Api.Services;
using AIStudio.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace AIStudio.Api.Controllers;

/// <summary>
/// Read-only data for the worker (task types, prompts, family roles, runtime settings) and the
/// auto-pause action. All routes need a worker token ("Authorization: Worker <token>").
/// Claim / inputs / complete stay in WorkerController.
/// </summary>
[ApiController, Route("api/worker"), Authorize(AuthenticationSchemes = AuthSchemes.Worker)]
[EnableRateLimiting("worker")]
public sealed class WorkerDataController(DatabaseService db, IMemoryCache cache) : ControllerBase
{
    private string WorkerId => User.FindFirstValue("worker_id")!;

    [HttpGet("catalog")]
    public async Task<IActionResult> Catalog()
    {
        var _db = db; var _cache = cache;
            // ⚡ 0ms Cached In-Memory Response
            if (_cache.TryGetValue("rpc_get_task_catalog", out var cachedCatalog))
                return Ok(cachedCatalog);

            var catalog = await _db.GetCatalogAsync();
            var result = catalog.Select(c => new
            {
                task_type = c.TaskType,
                label = c.Label,
                customer_label = c.CustomerLabel,
                hint = c.Hint,
                output = c.Output,
                inputs = string.IsNullOrEmpty(c.Inputs) ? new string[0] : JsonSerializer.Deserialize<string[]>(c.Inputs),
                optional = string.IsNullOrEmpty(c.Optional) ? new string[0] : JsonSerializer.Deserialize<string[]>(c.Optional),
                labels = string.IsNullOrEmpty(c.Labels) ? (object)new { } : JsonSerializer.Deserialize<Dictionary<string, string>>(c.Labels),
                customer_labels = string.IsNullOrEmpty(c.CustomerLabels) ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(c.CustomerLabels),
                extras = c.Extras,
                prompt_required = c.PromptRequired,
                face_check = c.FaceCheck,
                edit = c.Edit,
                transparent = c.Transparent,
                angles = string.IsNullOrEmpty(c.Angles) ? null : JsonSerializer.Deserialize<string[]>(c.Angles),
                family = c.Family,
                per_photo = c.PerPhoto,
                customer_visible = c.CustomerVisible,
                sort = c.Sort,
                tool = c.Tool,
                apps = !string.IsNullOrEmpty(c.AppsCsv)
                    ? c.AppsCsv.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries).Select(x => x.Trim()).ToArray()
                    : new [] { "weargen", "ppp" },
                enabled = c.Enabled
            }).ToList();

            _cache.Set("rpc_get_task_catalog", result, TimeSpan.FromMinutes(5));
            return Ok(result);
    }

    [HttpGet("family-roles")]
    public async Task<IActionResult> FamilyRoles()
    {
        var _db = db; var _cache = cache;
            // ⚡ 0ms Cached In-Memory Response
            if (_cache.TryGetValue("rpc_get_family_roles", out var cachedRoles))
                return Ok(cachedRoles);

            var roles = await _db.GetFamilyRolesAsync();
            var result = roles.Where(r => r.Enabled).Select(r => new
            {
                role_key = r.RoleKey,
                label_admin = r.LabelAdmin,
                label_customer = r.LabelCustomer,
                prompt_text = r.PromptText,
                sort_order = r.SortOrder,
                enabled = r.Enabled
            }).ToList();

            _cache.Set("rpc_get_family_roles", result, TimeSpan.FromMinutes(10));
            return Ok(result);
    }

    [HttpGet("prompts")]
    public async Task<IActionResult> Prompts()
    {
        var _db = db; var _cache = cache;
            // ⚡ 0ms Cached In-Memory Response
            if (_cache.TryGetValue("rpc_get_task_prompts", out var cachedPrompts))
                return Ok(cachedPrompts);

            var prompts = await _db.GetPromptsAsync();
            var result = prompts.Where(p => p.Enabled).Select(p => new
            {
                task_type = p.TaskType,
                system_text = p.SystemText,
                role_text = p.RoleText,
                negative_text = p.NegativeText,
                prompt_version = p.PromptVersion,
                enabled = p.Enabled
            }).ToList();

            _cache.Set("rpc_get_task_prompts", result, TimeSpan.FromMinutes(10));
            return Ok(result);
    }

    // Runtime limits and model list. No secret keys are returned here.
    [HttpGet("settings")]
    public async Task<IActionResult> Settings()
    {
        var _db = db;
string workerId = WorkerId;
            var s = await _db.GetSettingsAsync();
            var sec = await _db.GetSecretsAsync();
            int budgetLeft = await _db.RecordBudgetTakeAsync(workerId, 0);
            var models = await _db.GetModelsAsync();
            var disabledModels = models.Where(m => !m.Enabled).Select(m => m.ModelId).ToArray();

            var modelCaps = models.Where(m => !string.IsNullOrEmpty(m.Kind)).ToDictionary(
                m => m.ModelId,
                m => new
                {
                    kind = m.Kind,
                    label = m.Label,
                    aspects = string.IsNullOrEmpty(m.Aspects) ? new string[0] : JsonSerializer.Deserialize<string[]>(m.Aspects),
                    sizes = string.IsNullOrEmpty(m.Sizes) ? new string[0] : JsonSerializer.Deserialize<string[]>(m.Sizes)
                }
            );

            return Ok(new
            {
                task_concurrency = s.TaskConcurrency,
                gemini_concurrency = s.GeminiConcurrency,
                photos_per_task_max = s.PhotosPerTaskMax,
                max_attempts = s.MaxAttempts,
                retry_delay_sec = s.RetryDelaySec,
                task_timeout_sec = s.TaskTimeoutSec,
                budget_left = budgetLeft,
                disabled_models = disabledModels,
                model_caps = modelCaps,
                cloudinary_enabled = s.CloudinaryEnabled,
                cloudinary_cloud_name = s.CloudinaryCloudName,
                cloudinary_upload_preset = s.CloudinaryUploadPreset,
                imgbb_enabled = s.ImgbbEnabled,
                match_model = s.MatchModel,
                match_threshold = s.MatchThreshold,
                match_retries = s.MatchRetries,
                gemini_base = s.GeminiBase,
                imgbb_upload_url = s.ImgbbUploadUrl,
                stale_min = s.StaleMin,
                image_max_side = s.ImageMaxSide,
                image_quality = s.ImageQuality,
                heartbeat_sec = s.HeartbeatSec,
                fallback_sec = s.FallbackSec,
                worker_recycle_after_tasks = s.WorkerRecycleAfterTasks <= 0 ? 50 : s.WorkerRecycleAfterTasks
            });
    }

    [HttpPost("auto-pause")]
    public async Task<IActionResult> AutoPause([FromBody] AutoPauseRequest? body)
    {
        string reason = string.IsNullOrWhiteSpace(body?.Reason) ? "Auto pause" : body!.Reason!;
        if (reason.Length > 300) reason = reason[..300];
        await db.AutoPauseWorkerAsync(WorkerId, reason);
        return Ok(new { success = true });
    }

    public sealed record AutoPauseRequest(string? Reason);
}
