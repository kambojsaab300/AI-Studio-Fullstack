using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AIStudio.Api.Models;
using AIStudio.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace AIStudio.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CustomerController : ControllerBase
    {
        private readonly DatabaseService _db;
        private readonly ApiKeyService _apiKeys;
        private readonly IConfiguration _config;

        public CustomerController(DatabaseService db, ApiKeyService apiKeys, IConfiguration config)
        {
            _db = db;
            _apiKeys = apiKeys;
            _config = config;
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

    }
}
