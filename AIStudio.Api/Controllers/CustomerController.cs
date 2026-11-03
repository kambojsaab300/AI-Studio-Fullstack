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
    public class CustomerController : ControllerBase
    {
        private readonly DatabaseService _db;

        public CustomerController(DatabaseService db)
        {
            _db = db;
        }

        [HttpGet("catalog")]
        public async Task<IActionResult> GetCatalog()
        {
            var catalog = await _db.GetCatalogAsync();
            var customerCatalog = catalog.Where(c => c.CustomerVisible && c.Enabled).Select(c => new
            {
                task_type = c.TaskType,
                label = c.Label,
                customer_label = c.CustomerLabel ?? c.Label,
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
                tool = c.Tool
            });
            return Ok(customerCatalog);
        }

        [HttpGet("family-roles")]
        public async Task<IActionResult> GetFamilyRoles()
        {
            var roles = await _db.GetFamilyRolesAsync();
            var customerRoles = roles.Where(r => r.Enabled).Select(r => new
            {
                role_key = r.RoleKey,
                label_admin = r.LabelAdmin,
                label_customer = r.LabelCustomer,
                prompt_text = r.PromptText,
                sort_order = r.SortOrder
            });
            return Ok(customerRoles);
        }

        [HttpGet("models")]
        public async Task<IActionResult> GetModels()
        {
            var models = await _db.GetModelsAsync();
            var customerModels = models.Where(m => m.Enabled).Select(m => new
            {
                model_id = m.ModelId,
                kind = m.Kind,
                label = m.Label,
                aspects = string.IsNullOrEmpty(m.Aspects) ? new string[0] : JsonSerializer.Deserialize<string[]>(m.Aspects),
                sizes = string.IsNullOrEmpty(m.Sizes) ? new string[0] : JsonSerializer.Deserialize<string[]>(m.Sizes),
                enabled = m.Enabled
            });
            return Ok(customerModels);
        }

        [HttpGet("apps")]
        public async Task<IActionResult> GetApps()
        {
            var apps = await _db.GetAppsAsync();
            var result = apps.Where(a => a.Enabled).Select(a => new
            {
                app_id = a.AppId,
                label = a.Label,
                sort = a.Sort,
                task_types = a.TaskTypes
            });
            return Ok(result);
        }

        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var s = await _db.GetSettingsAsync();
            return Ok(new
            {
                maintenance_on = s.MaintenanceOn,
                maintenance_message = s.MaintenanceMessage
            });
        }

        [HttpGet("tasks")]
        public async Task<IActionResult> GetTasks([FromQuery] string? userId, [FromQuery] int limit = 50)
        {
            if (string.IsNullOrWhiteSpace(userId))
                userId = "weargen_user_1";

            using var conn = _db.CreateConnection();
            string sql = @"
                SELECT TOP (@Limit)
                    id, task_type as TaskType, model, prompt, status, error,
                    output_image_url as OutputImageUrl, output_image_urls as OutputImageUrls,
                    output_text as OutputText, created_at as CreatedAt, batch_count as BatchCount,
                    face_match_score as FaceMatchScore, duration_ms as DurationMs
                FROM ai_studio_tasks
                WHERE user_id = @UserId
                ORDER BY created_at DESC;";

            var rows = await conn.QueryAsync<TaskItem>(sql, new { UserId = userId, Limit = limit });
            var result = rows.Select(r => new
            {
                id = r.Id,
                task_type = r.TaskType,
                model = r.Model,
                prompt = r.Prompt,
                status = r.Status,
                error = r.Error,
                output_image_url = r.OutputImageUrl,
                output_image_urls = string.IsNullOrEmpty(r.OutputImageUrls) ? null : JsonSerializer.Deserialize<string[]>(r.OutputImageUrls),
                output_text = r.OutputText,
                created_at = r.CreatedAt.ToString("o"),
                batch_count = r.BatchCount,
                face_match_score = r.FaceMatchScore,
                duration_ms = r.DurationMs
            });

            return Ok(result);
        }

        public class CreateTaskDto
        {
            public string task_type { get; set; } = string.Empty;
            public string model { get; set; } = string.Empty;
            public string? prompt { get; set; }
            public string? system_text { get; set; }
            public string? aspect_ratio { get; set; }
            public string? image_size { get; set; }
            public string? face_image_url { get; set; }
            public string? style_image_url { get; set; }
            public string? input_image_url { get; set; }
            public object? extra_image_urls { get; set; }
            public string? conversation_id { get; set; }
            public string? user_id { get; set; }
            public int batch_count { get; set; } = 1;
            public string? app_id { get; set; }
            public object? family_role_keys { get; set; }
        }

        [HttpPost("tasks")]
        public async Task<IActionResult> CreateTask([FromBody] CreateTaskDto dto)
        {
            var settings = await _db.GetSettingsAsync();
            if (settings.MaintenanceOn)
                return StatusCode(503, new { error = settings.MaintenanceMessage });

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
                UserId = string.IsNullOrWhiteSpace(dto.user_id) ? "weargen_user_1" : dto.user_id,
                BatchCount = dto.batch_count > 0 ? dto.batch_count : 1,
                AppId = string.IsNullOrWhiteSpace(dto.app_id) ? "weargen" : dto.app_id,
                FamilyRoleKeys = familyKeysJson
            };

            long id = await _db.CreateTaskAsync(task);
            return Ok(new { id = id, status = "pending" });
        }
    }
}
