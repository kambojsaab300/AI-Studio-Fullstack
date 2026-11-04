using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AIStudio.Api.Models;
using AIStudio.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace AIStudio.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AdminController : ControllerBase
    {
        private readonly DatabaseService _db;

        public AdminController(DatabaseService db)
        {
            _db = db;
        }

        // ==========================================
        // WORKERS & LOAD
        // ==========================================
        [HttpGet("workers")]
        public async Task<IActionResult> GetWorkers()
        {
            var loads = await _db.GetWorkerLoadsAsync();
            return Ok(loads.Select(w => new
            {
                worker_id = w.WorkerId,
                last_seen = w.LastSeen.ToString("o"),
                processing = w.Processing,
                done = w.Done,
                paused = w.Paused,
                drain = w.Drain,
                pause_reason = w.PauseReason,
                task_limit = w.TaskLimit
            }));
        }

        [HttpGet("worker-details")]
        public async Task<IActionResult> GetWorkerDetails()
        {
            using var conn = _db.CreateConnection();
            string sql = "SELECT worker_id as WorkerId, last_seen as LastSeen, tools, task_types as TaskTypes, paused, drain, pause_reason as PauseReason, task_limit as TaskLimit FROM ai_studio_workers ORDER BY worker_id;";
            var workers = await conn.QueryAsync<Worker>(sql);
            return Ok(workers.Select(w => new
            {
                worker_id = w.WorkerId,
                tools = string.IsNullOrEmpty(w.Tools) ? new string[0] : JsonSerializer.Deserialize<string[]>(w.Tools),
                task_types = string.IsNullOrEmpty(w.TaskTypes) ? null : JsonSerializer.Deserialize<string[]>(w.TaskTypes),
                paused = w.Paused,
                drain = w.Drain,
                task_limit = w.TaskLimit
            }));
        }

        [HttpPost("workers/{workerId}/pause")]
        public async Task<IActionResult> ToggleWorkerPause(string workerId, [FromBody] JsonElement body)
        {
            bool paused = body.TryGetProperty("paused", out var p) && p.GetBoolean();
            using var conn = _db.CreateConnection();
            string sql = paused 
                ? "UPDATE ai_studio_workers SET paused = 1 WHERE worker_id = @WorkerId;"
                : "UPDATE ai_studio_workers SET paused = 0, pause_reason = NULL WHERE worker_id = @WorkerId;";
            await conn.ExecuteAsync(sql, new { WorkerId = workerId });
            return Ok(new { success = true, paused });
        }

        [HttpPost("workers/{workerId}/drain")]
        public async Task<IActionResult> ToggleWorkerDrain(string workerId, [FromBody] JsonElement body)
        {
            bool drain = body.TryGetProperty("drain", out var p) && p.GetBoolean();
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("UPDATE ai_studio_workers SET drain = @Drain WHERE worker_id = @WorkerId;", new { WorkerId = workerId, Drain = drain ? 1 : 0 });
            return Ok(new { success = true, drain });
        }

        [HttpPost("workers/{workerId}/limit")]
        public async Task<IActionResult> UpdateWorkerLimit(string workerId, [FromBody] JsonElement body)
        {
            int? limit = null;
            if (body.TryGetProperty("task_limit", out var p) && p.ValueKind == JsonValueKind.Number)
                limit = p.GetInt32();
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("UPDATE ai_studio_workers SET task_limit = @Limit WHERE worker_id = @WorkerId;", new { WorkerId = workerId, Limit = limit });
            return Ok(new { success = true, task_limit = limit });
        }

        [HttpPost("workers/{workerId}/tools")]
        public async Task<IActionResult> SetWorkerTools(string workerId, [FromBody] JsonElement body)
        {
            var tools = body.TryGetProperty("tools", out var t) ? t.ToString() : "[\"chat\",\"image\"]";
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("UPDATE ai_studio_workers SET tools = @Tools WHERE worker_id = @WorkerId;", new { WorkerId = workerId, Tools = tools });
            return Ok(new { success = true });
        }

        [HttpPost("workers/{workerId}/task-types")]
        public async Task<IActionResult> SetWorkerTaskTypes(string workerId, [FromBody] JsonElement body)
        {
            string? types = null;
            if (body.TryGetProperty("task_types", out var t) && t.ValueKind != JsonValueKind.Null)
                types = t.ToString();
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("UPDATE ai_studio_workers SET task_types = @Types WHERE worker_id = @WorkerId;", new { WorkerId = workerId, Types = types });
            return Ok(new { success = true });
        }

        // ==========================================
        // TASKS MANAGEMENT
        // ==========================================
        [HttpGet("tasks")]
        public async Task<IActionResult> GetTasks([FromQuery] string? status, [FromQuery] string? tool, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            using var conn = _db.CreateConnection();
            int offset = (Math.Max(1, page) - 1) * pageSize;

            string whereClause = "WHERE 1 = 1";
            if (!string.IsNullOrWhiteSpace(status))
                whereClause += " AND status = @Status";
            if (!string.IsNullOrWhiteSpace(tool))
                whereClause += " AND tool = @Tool";

            string sqlCount = $"SELECT COUNT(1) FROM ai_studio_tasks {whereClause};";
            int total = await conn.ExecuteScalarAsync<int>(sqlCount, new { Status = status, Tool = tool });

            string sql = $@"
                SELECT id, task_type as TaskType, model, prompt, status, error, worker_id as WorkerId,
                       user_id as UserId, output_image_url as OutputImageUrl, output_text as OutputText,
                       created_at as CreatedAt, priority, attempts, duration_ms as DurationMs
                FROM ai_studio_tasks
                {whereClause}
                ORDER BY id DESC
                OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;";

            var rows = await conn.QueryAsync<TaskItem>(sql, new { Status = status, Tool = tool, Offset = offset, PageSize = pageSize });
            var result = rows.Select(r => new
            {
                id = r.Id,
                task_type = r.TaskType,
                model = r.Model,
                prompt = r.Prompt,
                status = r.Status,
                error = r.Error,
                worker_id = r.WorkerId,
                user_id = r.UserId,
                output_image_url = r.OutputImageUrl,
                output_text = r.OutputText,
                created_at = r.CreatedAt.ToString("o"),
                priority = r.Priority,
                attempts = r.Attempts,
                duration_ms = r.DurationMs
            });

            return Ok(new { total, page, pageSize, data = result });
        }

        [HttpGet("tasks/pending-count")]
        public async Task<IActionResult> GetPendingCount()
        {
            using var conn = _db.CreateConnection();
            int count = await conn.ExecuteScalarAsync<int>("SELECT COUNT(1) FROM ai_studio_tasks WHERE status = 'pending';");
            return Ok(new { count });
        }

        [HttpPost("tasks")]
        public async Task<IActionResult> CreateTask([FromBody] CustomerController.CreateTaskDto dto)
        {
            string? extraJson = null;
            if (dto.extra_image_urls != null)
                extraJson = dto.extra_image_urls is string s ? s : JsonSerializer.Serialize(dto.extra_image_urls);

            string? familyKeysJson = null;
            if (dto.family_role_keys != null)
                familyKeysJson = dto.family_role_keys is string fk ? fk : JsonSerializer.Serialize(dto.family_role_keys);

            var task = new TaskItem
            {
                TaskType = dto.task_type,
                Model = dto.model,
                Prompt = dto.prompt,
                SystemText = dto.system_text,
                AspectRatio = dto.aspect_ratio,
                ImageSize = dto.image_size,
                FaceImageUrl = dto.face_image_url,
                StyleImageUrl = dto.style_image_url,
                InputImageUrl = dto.input_image_url,
                ExtraImageUrls = extraJson,
                ConversationId = dto.conversation_id,
                UserId = string.IsNullOrWhiteSpace(dto.user_id) ? "admin_created" : dto.user_id,
                BatchCount = dto.batch_count > 0 ? dto.batch_count : 1,
                AppId = string.IsNullOrWhiteSpace(dto.app_id) ? "weargen" : dto.app_id,
                FamilyRoleKeys = familyKeysJson
            };

            var (isValid, errorMsg) = await _db.ValidateTaskParametersAsync(task);
            if (!isValid)
            {
                return BadRequest(new { success = false, error = errorMsg, message = errorMsg });
            }

            long id = await _db.CreateTaskAsync(task);
            return Ok(new { id, status = "pending" });
        }

        [HttpPut("tasks/{id}/priority")]
        public async Task<IActionResult> SetPriority(long id, [FromBody] JsonElement body)
        {
            int priority = body.TryGetProperty("priority", out var p) ? p.GetInt32() : 0;
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("UPDATE ai_studio_tasks SET priority = @Priority WHERE id = @Id;", new { Id = id, Priority = priority });
            return Ok(new { success = true, priority });
        }

        [HttpDelete("tasks/{id}")]
        public async Task<IActionResult> DeleteTask(long id)
        {
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("DELETE FROM ai_studio_tasks WHERE id = @Id;", new { Id = id });
            return Ok(new { success = true });
        }

        // ==========================================
        // CATALOG MANAGEMENT
        // ==========================================
        [HttpGet("catalog")]
        public async Task<IActionResult> GetCatalog()
        {
            var catalog = await _db.GetCatalogAsync();
            return Ok(catalog.Select(c => new
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
                enabled = c.Enabled,
                sort = c.Sort,
                tool = c.Tool,
                updated_at = c.UpdatedAt.ToString("o")
            }));
        }

        [HttpPut("catalog/{taskType}")]
        public async Task<IActionResult> UpdateCatalogItem(string taskType, [FromBody] Dictionary<string, object> updates)
        {
            using var conn = _db.CreateConnection();
            var setClauses = new List<string>();
            var param = new DynamicParameters();
            param.Add("TaskType", taskType);

            foreach (var kvp in updates)
            {
                string col = kvp.Key;
                if (col == "task_type") continue;
                setClauses.Add($"[{col}] = @{col}");
                param.Add(col, kvp.Value?.ToString());
            }

            setClauses.Add("updated_at = SYSDATETIMEOFFSET()");
            string sql = $"UPDATE ai_studio_task_catalog SET {string.Join(", ", setClauses)} WHERE task_type = @TaskType;";
            await conn.ExecuteAsync(sql, param);
            return Ok(new { success = true });
        }

        // ==========================================
        // APPS & APP_TASKS
        // ==========================================
        [HttpGet("apps")]
        public async Task<IActionResult> GetApps()
        {
            var apps = await _db.GetAppsAsync();
            return Ok(apps.Select(a => new
            {
                app_id = a.AppId,
                label = a.Label,
                enabled = a.Enabled,
                sort = a.Sort,
                task_types = a.TaskTypes
            }));
        }

        [HttpPost("app-tasks")]
        public async Task<IActionResult> LinkAppTask([FromBody] JsonElement body)
        {
            string appId = body.GetProperty("app_id").GetString()!;
            string taskType = body.GetProperty("task_type").GetString()!;
            using var conn = _db.CreateConnection();
            string sql = @"
                IF NOT EXISTS (SELECT 1 FROM ai_studio_app_tasks WHERE app_id = @AppId AND task_type = @TaskType)
                    INSERT INTO ai_studio_app_tasks (app_id, task_type) VALUES (@AppId, @TaskType);";
            await conn.ExecuteAsync(sql, new { AppId = appId, TaskType = taskType });
            return Ok(new { success = true });
        }

        [HttpDelete("app-tasks")]
        public async Task<IActionResult> UnlinkAppTask([FromQuery] string appId, [FromQuery] string taskType)
        {
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("DELETE FROM ai_studio_app_tasks WHERE app_id = @AppId AND task_type = @TaskType;", new { AppId = appId, TaskType = taskType });
            return Ok(new { success = true });
        }

        // ==========================================
        // TOOLS & TOOL TYPES
        // ==========================================
        [HttpGet("tools")]
        public async Task<IActionResult> GetTools()
        {
            using var conn = _db.CreateConnection();
            var tools = await conn.QueryAsync("SELECT tool, label, enabled FROM ai_studio_tools ORDER BY tool;");
            var toolTypes = await conn.QueryAsync("SELECT task_type as TaskType, tool FROM ai_studio_tool_types ORDER BY task_type;");
            return Ok(new { tools, tool_types = toolTypes });
        }

        [HttpPost("tools")]
        public async Task<IActionResult> CreateTool([FromBody] JsonElement body)
        {
            string tool = body.GetProperty("tool").GetString()!.Trim();
            string label = body.GetProperty("label").GetString()!.Trim();
            using var conn = _db.CreateConnection();
            string sql = "INSERT INTO ai_studio_tools (tool, label, enabled) VALUES (@Tool, @Label, 1);";
            await conn.ExecuteAsync(sql, new { Tool = tool, Label = label });
            return Ok(new { success = true, tool, label });
        }

        [HttpPut("tools/{tool}")]
        public async Task<IActionResult> ToggleTool(string tool, [FromBody] JsonElement body)
        {
            bool enabled = body.GetProperty("enabled").GetBoolean();
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("UPDATE ai_studio_tools SET enabled = @Enabled WHERE tool = @Tool;", new { Tool = tool, Enabled = enabled ? 1 : 0 });
            return Ok(new { success = true });
        }

        [HttpPut("tool-types/{taskType}")]
        public async Task<IActionResult> SetToolType(string taskType, [FromBody] JsonElement body)
        {
            string tool = body.GetProperty("tool").GetString()!;
            using var conn = _db.CreateConnection();
            string sql = @"
                IF EXISTS (SELECT 1 FROM ai_studio_tool_types WHERE task_type = @TaskType)
                    UPDATE ai_studio_tool_types SET tool = @Tool WHERE task_type = @TaskType;
                ELSE
                    INSERT INTO ai_studio_tool_types (task_type, tool) VALUES (@TaskType, @Tool);";
            await conn.ExecuteAsync(sql, new { TaskType = taskType, Tool = tool });
            return Ok(new { success = true });
        }

        // ==========================================
        // FAMILY ROLES
        // ==========================================
        [HttpGet("family-roles")]
        public async Task<IActionResult> GetFamilyRoles()
        {
            var roles = await _db.GetFamilyRolesAsync();
            return Ok(roles.Select(r => new
            {
                role_key = r.RoleKey,
                label_admin = r.LabelAdmin,
                label_customer = r.LabelCustomer,
                prompt_text = r.PromptText,
                sort_order = r.SortOrder,
                enabled = r.Enabled
            }));
        }

        [HttpPut("family-roles/{roleKey}")]
        public async Task<IActionResult> UpdateFamilyRole(string roleKey, [FromBody] JsonElement body)
        {
            using var conn = _db.CreateConnection();
            if (body.TryGetProperty("enabled", out var e))
            {
                bool enabled = e.GetBoolean();
                await conn.ExecuteAsync("UPDATE ai_studio_family_roles SET enabled = @Enabled, updated_at = SYSDATETIMEOFFSET() WHERE role_key = @RoleKey;", new { RoleKey = roleKey, Enabled = enabled ? 1 : 0 });
            }
            return Ok(new { success = true });
        }

        [HttpPost("family-roles")]
        public async Task<IActionResult> CreateFamilyRole([FromBody] JsonElement body)
        {
            string roleKey = body.GetProperty("role_key").GetString()!;
            string labelAdmin = body.GetProperty("label_admin").GetString()!;
            string labelCustomer = body.GetProperty("label_customer").GetString()!;
            string promptText = body.GetProperty("prompt_text").GetString()!;
            int sortOrder = body.TryGetProperty("sort_order", out var s) ? s.GetInt32() : 0;

            using var conn = _db.CreateConnection();
            string sql = @"
                INSERT INTO ai_studio_family_roles (role_key, label_admin, label_customer, prompt_text, sort_order, enabled)
                VALUES (@RoleKey, @LabelAdmin, @LabelCustomer, @PromptText, @SortOrder, 1);";
            await conn.ExecuteAsync(sql, new { RoleKey = roleKey, LabelAdmin = labelAdmin, LabelCustomer = labelCustomer, PromptText = promptText, SortOrder = sortOrder });
            return Ok(new { success = true });
        }

        // ==========================================
        // SETTINGS & SECRETS
        // ==========================================
        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var s = await _db.GetSettingsAsync();
            var sec = await _db.GetSecretsAsync();
            return Ok(new { settings = s, secrets = new { imgbb_api_key = sec.ImgbbApiKey, brevo_api_key = sec.BrevoApiKey } });
        }

        [HttpPut("settings")]
        public async Task<IActionResult> UpdateSettings([FromBody] Dictionary<string, object> updates)
        {
            using var conn = _db.CreateConnection();
            var setClauses = new List<string>();
            var param = new DynamicParameters();

            foreach (var kvp in updates)
            {
                if (kvp.Key == "id") continue;
                setClauses.Add($"[{kvp.Key}] = @{kvp.Key}");
                param.Add(kvp.Key, kvp.Value?.ToString());
            }

            setClauses.Add("updated_at = SYSDATETIMEOFFSET()");
            string sql = $"UPDATE ai_studio_settings SET {string.Join(", ", setClauses)} WHERE id = 1;";
            await conn.ExecuteAsync(sql, param);
            return Ok(new { success = true });
        }

        [HttpPut("secrets")]
        public async Task<IActionResult> UpdateSecrets([FromBody] Dictionary<string, string?> updates)
        {
            using var conn = _db.CreateConnection();
            var setClauses = new List<string>();
            var param = new DynamicParameters();

            foreach (var kvp in updates)
            {
                if (kvp.Key == "id") continue;
                setClauses.Add($"[{kvp.Key}] = @{kvp.Key}");
                param.Add(kvp.Key, kvp.Value);
            }

            string sql = $"UPDATE ai_studio_secrets SET {string.Join(", ", setClauses)} WHERE id = 1;";
            await conn.ExecuteAsync(sql, param);
            return Ok(new { success = true });
        }

        // ==========================================
        // MODELS & PROMPTS
        // ==========================================
        [HttpGet("models")]
        public async Task<IActionResult> GetModels()
        {
            var models = await _db.GetModelsAsync();
            return Ok(models);
        }

        [HttpPut("models/{modelId}")]
        public async Task<IActionResult> UpdateModel(string modelId, [FromBody] JsonElement body)
        {
            using var conn = _db.CreateConnection();
            if (body.TryGetProperty("enabled", out var e))
            {
                bool enabled = e.GetBoolean();
                await conn.ExecuteAsync("UPDATE ai_studio_models SET enabled = @Enabled WHERE model_id = @ModelId;", new { ModelId = modelId, Enabled = enabled ? 1 : 0 });
            }
            return Ok(new { success = true });
        }

        [HttpGet("prompts")]
        public async Task<IActionResult> GetPrompts()
        {
            var prompts = await _db.GetPromptsAsync();
            return Ok(prompts);
        }

        [HttpPut("prompts/{taskType}")]
        public async Task<IActionResult> UpdatePrompt(string taskType, [FromBody] Dictionary<string, object> updates)
        {
            using var conn = _db.CreateConnection();
            var setClauses = new List<string>();
            var param = new DynamicParameters();
            param.Add("TaskType", taskType);

            foreach (var kvp in updates)
            {
                if (kvp.Key == "task_type") continue;
                setClauses.Add($"[{kvp.Key}] = @{kvp.Key}");
                param.Add(kvp.Key, kvp.Value?.ToString());
            }

            setClauses.Add("updated_at = SYSDATETIMEOFFSET()");
            string sql = $"UPDATE ai_studio_prompts SET {string.Join(", ", setClauses)} WHERE task_type = @TaskType;";
            await conn.ExecuteAsync(sql, param);
            return Ok(new { success = true });
        }

        // ==========================================
        // LOGS & CLEANUP
        // ==========================================
        [HttpGet("logs")]
        public async Task<IActionResult> GetLogs([FromQuery] int limit = 30)
        {
            using var conn = _db.CreateConnection();
            string sql = "SELECT TOP (@Limit) id, [at] as At, admin_id as AdminId, action, target, details FROM ai_studio_admin_log ORDER BY id DESC;";
            var logs = await conn.QueryAsync(sql, new { Limit = limit });
            return Ok(logs);
        }

        [HttpPost("logs")]
        public async Task<IActionResult> CreateLog([FromBody] JsonElement body)
        {
            string action = body.GetProperty("action").GetString()!;
            string? target = body.TryGetProperty("target", out var tg) ? tg.GetString() : null;
            string? details = body.TryGetProperty("details", out var dt) ? dt.ToString() : null;

            using var conn = _db.CreateConnection();
            string sql = "INSERT INTO ai_studio_admin_log (action, target, details) VALUES (@Action, @Target, @Details);";
            await conn.ExecuteAsync(sql, new { Action = action, Target = target, Details = details });
            return Ok(new { success = true });
        }

        [HttpPost("release-tasks")]
        public async Task<IActionResult> ReleaseTasks([FromQuery] string? workerId)
        {
            int count = await _db.ReleaseStuckTasksAsync(workerId);
            return Ok(new { released = count });
        }

        [HttpPost("clear-failed")]
        public async Task<IActionResult> ClearFailed([FromQuery] string? workerId)
        {
            int count = await _db.ClearFailedTasksAsync(workerId);
            return Ok(new { cleared = count });
        }
    }
}
