using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using AIStudio.Api.Models;
using AIStudio.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace AIStudio.Api.Controllers
{
    [ApiController]
    public class RpcController : ControllerBase
    {
        private readonly DatabaseService _db;
        private readonly IMemoryCache _cache;

        public RpcController(DatabaseService db, IMemoryCache cache)
        {
            _db = db;
            _cache = cache;
        }

        private static string? GetStr(JsonElement el, string prop, string? fallback = null)
        {
            if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var val))
            {
                if (val.ValueKind == JsonValueKind.String) return val.GetString();
                if (val.ValueKind == JsonValueKind.Null || val.ValueKind == JsonValueKind.Undefined) return fallback;
                return val.ToString();
            }
            return fallback;
        }

        private static long GetLong(JsonElement el, string prop, long fallback = 0)
        {
            if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var val))
            {
                if (val.ValueKind == JsonValueKind.Number && val.TryGetInt64(out var num)) return num;
                if (val.ValueKind == JsonValueKind.String && long.TryParse(val.GetString(), out var parsed)) return parsed;
            }
            return fallback;
        }

        private static int GetInt(JsonElement el, string prop, int fallback = 0)
        {
            if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty(prop, out var val))
            {
                if (val.ValueKind == JsonValueKind.Number && val.TryGetInt32(out var num)) return num;
                if (val.ValueKind == JsonValueKind.String && int.TryParse(val.GetString(), out var parsed)) return parsed;
            }
            return fallback;
        }

        [HttpPost("rest/v1/rpc/{functionName}")]
        [HttpPost("api/rpc/{functionName}")]
        public async Task<IActionResult> HandleRpc(string functionName, [FromBody] JsonElement body)
        {
            try
            {
                switch (functionName.ToLowerInvariant())
                {
                    case "customer_create_task":
                    case "upload_ai_studio_task":
                    {
                        JsonElement payload = body.ValueKind == JsonValueKind.Object && body.TryGetProperty("p_payload", out var p) ? p : body;
                        var task = new TaskItem
                        {
                            TaskType = GetStr(payload, "task_type", "")!,
                            Model = GetStr(payload, "model", "")!,
                            Prompt = GetStr(payload, "prompt"),
                            SystemText = GetStr(payload, "system_text"),
                            AspectRatio = GetStr(payload, "aspect_ratio"),
                            ImageSize = GetStr(payload, "image_size"),
                            FaceImageUrl = GetStr(payload, "face_image_url"),
                            StyleImageUrl = GetStr(payload, "style_image_url"),
                            InputImageUrl = GetStr(payload, "input_image_url"),
                            ExtraImageUrls = payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("extra_image_urls", out var ei) ? ei.ToString() : null,
                            ConversationId = GetStr(payload, "conversation_id"),
                            UserId = GetStr(payload, "user_id", "weargen_user_1")!,
                            BatchCount = GetInt(payload, "batch_count", 1),
                            AppId = GetStr(payload, "app_id", "weargen")!,
                            Priority = GetInt(payload, "priority", 0),
                            FamilyRoleKeys = payload.ValueKind == JsonValueKind.Object && payload.TryGetProperty("family_role_keys", out var fr) ? fr.ToString() : null
                        };

                        long id = await _db.CreateTaskAsync(task);
                        return Ok(id);
                    }

                    case "register_ai_studio_worker":
                    {
                        string? wanted = GetStr(body, "p_wanted") ?? GetStr(body, "wanted");
                        string workerId = await _db.RegisterWorkerAsync(wanted);
                        return new JsonResult(workerId);
                    }

                    case "worker_heartbeat":
                    {
                        string workerId = GetStr(body, "p_worker_id") ?? GetStr(body, "worker_id") ?? "worker_1";
                        var status = await _db.WorkerHeartbeatAsync(workerId);
                        return Ok(new { paused = status.paused, drain = status.drain });
                    }

                    case "worker_release":
                    {
                        string workerId = GetStr(body, "p_worker_id") ?? GetStr(body, "worker_id") ?? "";
                        if (!string.IsNullOrEmpty(workerId))
                            await _db.WorkerReleaseAsync(workerId);
                        return Ok(true);
                    }

                    case "get_pending_for_worker":
                    case "get_pending_ai_studio_tasks":
                    {
                        string workerId = GetStr(body, "p_worker_id") ?? GetStr(body, "worker_id") ?? "worker_1";
                        int limit = GetInt(body, "p_limit", 40);
                        var staleBefore = DateTimeOffset.UtcNow.AddMinutes(-10);
                        string? staleStr = GetStr(body, "p_stale_before");
                        if (!string.IsNullOrEmpty(staleStr) && DateTimeOffset.TryParse(staleStr, out var parsedStale))
                        {
                            staleBefore = parsedStale;
                        }
                        var tasks = await _db.GetPendingForWorkerAsync(workerId, staleBefore, limit);
                        return Ok(tasks.Select(t => new
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
                        }));
                    }

                    case "claim_ai_studio_task":
                    {
                        long id = GetLong(body, "p_id", GetLong(body, "id"));
                        string workerId = GetStr(body, "p_worker_id") ?? GetStr(body, "worker_id") ?? "";
                        bool claimed = await _db.ClaimTaskAsync(id, workerId);
                        if (claimed)
                            return Ok(new[] { new { id = id } });
                        return Ok(new object[0]);
                    }

                    case "worker_complete_task":
                    {
                        long id = GetLong(body, "p_id", GetLong(body, "id"));
                        string workerId = GetStr(body, "p_worker_id") ?? GetStr(body, "worker_id") ?? "";
                        JsonElement patch = body.ValueKind == JsonValueKind.Object && body.TryGetProperty("p_patch", out var pp) ? pp : body;

                        string status = GetStr(patch, "status", "done")!;
                        string? outputImageUrl = GetStr(patch, "output_image_url");
                        string? outputText = GetStr(patch, "output_text");
                        string? error = GetStr(patch, "error");
                        string? outputImageUrls = patch.ValueKind == JsonValueKind.Object && patch.TryGetProperty("output_image_urls", out var oius) ? oius.ToString() : null;

                        decimal? matchScore = null;
                        if (patch.ValueKind == JsonValueKind.Object && patch.TryGetProperty("face_match_score", out var ms) && ms.ValueKind == JsonValueKind.Number)
                            matchScore = ms.GetDecimal();

                        int? processMs = null;
                        if (patch.ValueKind == JsonValueKind.Object && patch.TryGetProperty("process_ms", out var pm) && pm.ValueKind == JsonValueKind.Number)
                            processMs = pm.GetInt32();

                        bool completed = await _db.CompleteTaskAsync(id, workerId, status, outputImageUrl, outputImageUrls, outputText, matchScore, error, processMs);
                        if (completed)
                            return Ok(new[] { new { id = id } });
                        return Ok(new object[0]);
                    }

                    case "get_task_catalog":
                    {
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
                            enabled = c.Enabled
                        }).ToList();

                        _cache.Set("rpc_get_task_catalog", result, TimeSpan.FromMinutes(5));
                        return Ok(result);
                    }

                    case "get_family_roles":
                    {
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

                    case "get_model_list":
                    {
                        // ⚡ 0ms Cached In-Memory Response
                        if (_cache.TryGetValue("rpc_get_model_list", out var cachedModels))
                            return Ok(cachedModels);

                        var models = await _db.GetModelsAsync();
                        var result = models.Select(m => new
                        {
                            model_id = m.ModelId,
                            kind = m.Kind,
                            label = m.Label,
                            aspects = string.IsNullOrEmpty(m.Aspects) ? new string[0] : JsonSerializer.Deserialize<string[]>(m.Aspects),
                            sizes = string.IsNullOrEmpty(m.Sizes) ? new string[0] : JsonSerializer.Deserialize<string[]>(m.Sizes),
                            enabled = m.Enabled
                        }).ToList();

                        _cache.Set("rpc_get_model_list", result, TimeSpan.FromMinutes(10));
                        return Ok(result);
                    }

                    case "get_app_list":
                    {
                        // ⚡ 0ms Cached In-Memory Response
                        if (_cache.TryGetValue("rpc_get_app_list", out var cachedApps))
                            return Ok(cachedApps);

                        var apps = await _db.GetAppsAsync();
                        var result = apps.Where(a => a.Enabled).Select(a => new
                        {
                            app_id = a.AppId,
                            label = a.Label,
                            sort = a.Sort,
                            task_types = a.TaskTypes
                        }).ToList();

                        _cache.Set("rpc_get_app_list", result, TimeSpan.FromMinutes(5));
                        return Ok(result);
                    }

                    case "get_task_prompts":
                    {
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

                    case "get_worker_config":
                    {
                        string workerId = GetStr(body, "p_worker_id", "default")!;
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
                            fallback_sec = s.FallbackSec,
                            worker_recycle_after_tasks = s.WorkerRecycleAfterTasks <= 0 ? 50 : s.WorkerRecycleAfterTasks
                        });
                    }

                    case "worker_auto_pause":
                    {
                        string workerId = GetStr(body, "p_worker_id", "")!;
                        string reason = GetStr(body, "p_reason", "Auto pause")!;
                        if (!string.IsNullOrWhiteSpace(workerId))
                            await _db.AutoPauseWorkerAsync(workerId, reason);
                        return Ok(true);
                    }

                    case "worker_budget_take":
                    {
                        string workerId = GetStr(body, "p_worker_id", "default")!;
                        int calls = GetInt(body, "p_calls", 1);
                        int left = await _db.RecordBudgetTakeAsync(workerId, calls);
                        return Ok(new { budget_left = left });
                    }

                    case "is_ai_studio_admin":
                    {
                        var authHeader = Request.Headers["Authorization"].ToString();
                        string? tokenStr = null;
                        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                        {
                            tokenStr = authHeader.Substring("Bearer ".Length).Trim();
                        }
                        else if (Request.Cookies.TryGetValue("aistudio_jwt", out var cToken) && !string.IsNullOrEmpty(cToken))
                        {
                            tokenStr = cToken;
                        }

                        if (!string.IsNullOrEmpty(tokenStr))
                        {
                            var handler = new JwtSecurityTokenHandler();
                            if (handler.CanReadToken(tokenStr))
                            {
                                var jwt = handler.ReadJwtToken(tokenStr);
                                var adminClaim = jwt.Claims.FirstOrDefault(c => c.Type == "is_admin" || c.Type == ClaimTypes.Role);
                                if (adminClaim != null && (adminClaim.Value.Equals("true", StringComparison.OrdinalIgnoreCase) || adminClaim.Value.Equals("admin", StringComparison.OrdinalIgnoreCase)))
                                    return Ok(true);

                                var userId = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier || c.Type == "sub")?.Value;
                                if (!string.IsNullOrEmpty(userId))
                                {
                                    bool isAdmin = await _db.IsAdminAsync(userId);
                                    return Ok(isAdmin);
                                }
                            }
                        }
                        return Ok(false);
                    }

                    case "ai_studio_send_test_mail":
                    {
                        return Ok(new { success = true, message = "Test email notification simulated." });
                    }

                    case "ai_studio_set_worker_tools":
                    {
                        string workerId = GetStr(body, "p_worker_id", "")!;
                        string tools = body.ValueKind == JsonValueKind.Object && body.TryGetProperty("p_tools", out var pt) ? pt.ToString() : "[\"chat\",\"image\"]";
                        using var conn = _db.CreateConnection();
                        await conn.ExecuteAsync("UPDATE ai_studio_workers SET tools = @Tools WHERE worker_id = @WorkerId;", new { WorkerId = workerId, Tools = tools });
                        return Ok(true);
                    }

                    case "ai_studio_set_worker_task_types":
                    {
                        string workerId = GetStr(body, "p_worker_id", "")!;
                        string? types = body.ValueKind == JsonValueKind.Object && body.TryGetProperty("p_types", out var pt) && pt.ValueKind != JsonValueKind.Null ? pt.ToString() : null;
                        using var conn = _db.CreateConnection();
                        await conn.ExecuteAsync("UPDATE ai_studio_workers SET task_types = @Types WHERE worker_id = @WorkerId;", new { WorkerId = workerId, Types = types });
                        return Ok(true);
                    }

                    case "ai_studio_release_tasks":
                    {
                        string? workerId = GetStr(body, "p_worker_id");
                        int count = await _db.ReleaseStuckTasksAsync(workerId);
                        return Ok(count);
                    }

                    case "ai_studio_clear_failed":
                    {
                        string? workerId = GetStr(body, "p_worker_id");
                        int count = await _db.ClearFailedTasksAsync(workerId);
                        return Ok(count);
                    }

                    default:
                        return Ok(new { error = $"Function {functionName} not found." });
                }
            }
            catch (Exception ex)
            {
                return Ok(new { error = ex.Message });
            }
        }
    }
}
