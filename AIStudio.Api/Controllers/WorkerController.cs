using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AIStudio.Api.Models;
using AIStudio.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace AIStudio.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkerController : ControllerBase
    {
        private readonly DatabaseService _db;

        public WorkerController(DatabaseService db)
        {
            _db = db;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] JsonElement body)
        {
            string? wanted = body.TryGetProperty("p_wanted", out var w) ? w.GetString() : null;
            if (string.IsNullOrWhiteSpace(wanted) && body.TryGetProperty("wanted", out var w2))
                wanted = w2.GetString();

            string workerId = await _db.RegisterWorkerAsync(wanted);
            return Ok(new { worker_id = workerId });
        }

        [HttpPost("heartbeat")]
        public async Task<IActionResult> Heartbeat([FromBody] JsonElement body)
        {
            string workerId = (body.TryGetProperty("p_worker_id", out var w) ? w.GetString() : null)
                ?? (body.TryGetProperty("worker_id", out var w2) ? w2.GetString() : null)
                ?? string.Empty;

            if (string.IsNullOrWhiteSpace(workerId))
                return BadRequest(new { error = "Worker ID zaroori hai." });

            var status = await _db.WorkerHeartbeatAsync(workerId);
            return Ok(new { paused = status.paused, drain = status.drain });
        }

        [HttpPost("release")]
        public async Task<IActionResult> Release([FromBody] JsonElement body)
        {
            string workerId = (body.TryGetProperty("p_worker_id", out var w) ? w.GetString() : null)
                ?? (body.TryGetProperty("worker_id", out var w2) ? w2.GetString() : null)
                ?? string.Empty;

            if (!string.IsNullOrWhiteSpace(workerId))
                await _db.WorkerReleaseAsync(workerId);

            return Ok(new { success = true });
        }

        [HttpGet("config")]
        public async Task<IActionResult> GetConfig([FromQuery] string? workerId)
        {
            var s = await _db.GetSettingsAsync();
            var sec = await _db.GetSecretsAsync();
            int budgetLeft = await _db.RecordBudgetTakeAsync(workerId ?? "default", 0);

            var models = await _db.GetModelsAsync();
            var disabledModels = models.Where(m => !m.Enabled).Select(m => m.ModelId).ToArray();

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
                cloudinary_enabled = s.CloudinaryEnabled,
                cloudinary_cloud_name = s.CloudinaryCloudName,
                cloudinary_upload_preset = s.CloudinaryUploadPreset,
                imgbb_enabled = s.ImgbbEnabled,
                imgbb_api_key = sec.ImgbbApiKey,
                match_model = s.MatchModel,
                match_threshold = s.MatchThreshold,
                match_retries = s.MatchRetries,
                gemini_base = s.GeminiBase,
                imgbb_upload_url = s.ImgbbUploadUrl,
                stale_min = s.StaleMin,
                image_max_side = s.ImageMaxSide,
                image_quality = s.ImageQuality,
                heartbeat_sec = s.HeartbeatSec,
                fallback_sec = s.FallbackSec
            });
        }

        [HttpGet("pending")]
        public async Task<IActionResult> GetPending([FromQuery] string workerId, [FromQuery] int limit = 40)
        {
            if (string.IsNullOrWhiteSpace(workerId))
                return BadRequest(new { error = "Worker ID zaroori hai." });

            var staleBefore = DateTimeOffset.UtcNow.AddMinutes(-10);
            var tasks = await _db.GetPendingForWorkerAsync(workerId, staleBefore, limit);

            var result = tasks.Select(t => new
            {
                id = t.Id,
                task_type = t.TaskType,
                model = t.Model,
                prompt = t.Prompt,
                system_text = t.SystemText,
                aspect_ratio = t.AspectRatio,
                image_size = t.ImageSize,
                face_image_url = t.FaceImageUrl,
                style_image_url = t.StyleImageUrl,
                input_image_url = t.InputImageUrl,
                extra_image_urls = string.IsNullOrEmpty(t.ExtraImageUrls) ? null : JsonSerializer.Deserialize<string[]>(t.ExtraImageUrls),
                conversation_id = t.ConversationId,
                user_id = t.UserId,
                batch_count = t.BatchCount,
                tool = t.Tool,
                app_id = t.AppId,
                priority = t.Priority,
                family_role_keys = string.IsNullOrEmpty(t.FamilyRoleKeys) ? null : JsonSerializer.Deserialize<string[]>(t.FamilyRoleKeys),
                created_at = t.CreatedAt.ToString("o")
            });

            return Ok(result);
        }

        [HttpPost("claim")]
        public async Task<IActionResult> ClaimTask([FromBody] JsonElement body)
        {
            long id = (body.TryGetProperty("p_id", out var pid) ? pid.GetInt64() : 0)
                + (body.TryGetProperty("id", out var tid) ? tid.GetInt64() : 0);

            string workerId = (body.TryGetProperty("p_worker_id", out var pw) ? pw.GetString() : null)
                ?? (body.TryGetProperty("worker_id", out var w) ? w.GetString() : null)
                ?? string.Empty;

            if (id <= 0 || string.IsNullOrWhiteSpace(workerId))
                return BadRequest(new { error = "Task ID aur Worker ID zaroori hain." });

            bool claimed = await _db.ClaimTaskAsync(id, workerId);
            return Ok(new { success = claimed });
        }

        [HttpPost("complete")]
        public async Task<IActionResult> CompleteTask([FromBody] JsonElement body)
        {
            long id = (body.TryGetProperty("p_id", out var pid) ? pid.GetInt64() : 0)
                + (body.TryGetProperty("id", out var tid) ? tid.GetInt64() : 0);

            string workerId = (body.TryGetProperty("p_worker_id", out var pw) ? pw.GetString() : null)
                ?? (body.TryGetProperty("worker_id", out var w) ? w.GetString() : null)
                ?? string.Empty;

            JsonElement patch = body.TryGetProperty("p_patch", out var pp) ? pp : body;

            string status = patch.TryGetProperty("status", out var st) ? st.GetString() ?? "done" : "done";
            string? outputImageUrl = patch.TryGetProperty("output_image_url", out var oiu) ? oiu.GetString() : null;
            string? outputText = patch.TryGetProperty("output_text", out var ot) ? ot.GetString() : null;
            string? error = patch.TryGetProperty("error", out var er) ? er.GetString() : null;
            
            string? outputImageUrls = null;
            if (patch.TryGetProperty("output_image_urls", out var oius))
                outputImageUrls = oius.ToString();

            decimal? matchScore = null;
            if (patch.TryGetProperty("face_match_score", out var ms) && ms.ValueKind == JsonValueKind.Number)
                matchScore = ms.GetDecimal();

            int? processMs = null;
            if (patch.TryGetProperty("process_ms", out var pm) && pm.ValueKind == JsonValueKind.Number)
                processMs = pm.GetInt32();

            bool completed = await _db.CompleteTaskAsync(id, workerId, status, outputImageUrl, outputImageUrls, outputText, matchScore, error, processMs);
            return Ok(new { success = completed });
        }

        [HttpGet("prompts")]
        public async Task<IActionResult> GetPrompts()
        {
            var prompts = await _db.GetPromptsAsync();
            var dict = prompts.Where(p => p.Enabled).ToDictionary(
                p => p.TaskType,
                p => new
                {
                    system_text = p.SystemText,
                    role_text = p.RoleText,
                    negative_text = p.NegativeText,
                    prompt_version = p.PromptVersion
                }
            );
            return Ok(dict);
        }

        [HttpGet("catalog")]
        public async Task<IActionResult> GetCatalog()
        {
            var catalog = await _db.GetCatalogAsync();
            var dict = catalog.Where(c => c.Enabled).ToDictionary(
                c => c.TaskType,
                c => new
                {
                    label = c.Label,
                    output = c.Output,
                    kind = c.Output,
                    inputs = string.IsNullOrEmpty(c.Inputs) ? new string[0] : JsonSerializer.Deserialize<string[]>(c.Inputs),
                    labels = string.IsNullOrEmpty(c.Labels) ? (object)new { } : JsonSerializer.Deserialize<Dictionary<string, string>>(c.Labels),
                    optional = string.IsNullOrEmpty(c.Optional) ? new string[0] : JsonSerializer.Deserialize<string[]>(c.Optional),
                    extras = c.Extras,
                    prompt_required = c.PromptRequired,
                    face_check = c.FaceCheck,
                    edit = c.Edit,
                    transparent = c.Transparent,
                    angles = string.IsNullOrEmpty(c.Angles) ? null : JsonSerializer.Deserialize<string[]>(c.Angles),
                    family = c.Family,
                    per_photo = c.PerPhoto,
                    tool = c.Tool
                }
            );
            return Ok(dict);
        }

        [HttpGet("family-roles")]
        public async Task<IActionResult> GetFamilyRoles()
        {
            var roles = await _db.GetFamilyRolesAsync();
            return Ok(roles.Where(r => r.Enabled).Select(r => new
            {
                role_key = r.RoleKey,
                label_admin = r.LabelAdmin,
                label_customer = r.LabelCustomer,
                prompt_text = r.PromptText,
                sort_order = r.SortOrder
            }));
        }

        [HttpPost("auto-pause")]
        public async Task<IActionResult> AutoPause([FromBody] JsonElement body)
        {
            string workerId = (body.TryGetProperty("p_worker_id", out var w) ? w.GetString() : null)
                ?? (body.TryGetProperty("worker_id", out var w2) ? w2.GetString() : null)
                ?? string.Empty;

            string reason = (body.TryGetProperty("p_reason", out var r) ? r.GetString() : null)
                ?? (body.TryGetProperty("reason", out var r2) ? r2.GetString() : null)
                ?? "Automatic pause";

            if (!string.IsNullOrWhiteSpace(workerId))
                await _db.AutoPauseWorkerAsync(workerId, reason);

            return Ok(new { success = true });
        }

        [HttpPost("budget-take")]
        public async Task<IActionResult> BudgetTake([FromBody] JsonElement body)
        {
            string workerId = (body.TryGetProperty("p_worker_id", out var w) ? w.GetString() : null)
                ?? (body.TryGetProperty("worker_id", out var w2) ? w2.GetString() : null)
                ?? "default";

            int calls = 1;
            if (body.TryGetProperty("p_calls", out var c) && c.ValueKind == JsonValueKind.Number)
                calls = c.GetInt32();
            else if (body.TryGetProperty("calls", out var c2) && c2.ValueKind == JsonValueKind.Number)
                calls = c2.GetInt32();

            int budgetLeft = await _db.RecordBudgetTakeAsync(workerId, calls);
            return Ok(new { budget_left = budgetLeft });
        }
    }
}
