using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace AIStudio.Api.Controllers
{
    // Admin data endpoints used by the Admin portal and the Client App portal.
    // Rows come back with their database column names (snake_case) and JSON text columns parsed,
    // the same shape the UI used with the old /rest/v1 layer, but every route here is admin-only
    // (class-level [RequireAdmin]) and no caller-supplied column name reaches SQL unchecked.
    public partial class AdminController
    {
        // ==========================================
        // HELPERS
        // ==========================================

        // Text columns holding JSON that the UI reads as arrays / objects.
        private static readonly HashSet<string> JsonColumns = new(StringComparer.OrdinalIgnoreCase)
        {
            "extra_image_urls", "output_image_urls", "imgbb_image_urls", "extras",
            "inputs", "optional", "labels", "customer_labels", "task_types", "apps",
            "aspect_ratios", "image_sizes", "rules", "payload", "tags"
        };

        // Task columns the UI lists (leaves out large or internal fields).
        private const string TaskColumns =
            "id, task_type, model, prompt, aspect_ratio, image_size, status, error, output_text, output_image_url, " +
            "output_image_urls, input_image_url, face_image_url, style_image_url, worker_id, app_id, user_id, " +
            "batch_count, conversation_id, face_match_score, created_at, finished_at, duration_ms, process_ms";

        private static readonly Regex SafeIdent = new("^[A-Za-z_][A-Za-z0-9_]{0,63}$", RegexOptions.Compiled);

        private static Dictionary<string, object?> ToRow(IDictionary<string, object> row)
        {
            var result = new Dictionary<string, object?>(row.Count);
            foreach (var kvp in row)
            {
                if (JsonColumns.Contains(kvp.Key) && kvp.Value is string str && str.Length >= 2 &&
                    ((str[0] == '[' && str[^1] == ']') || (str[0] == '{' && str[^1] == '}')))
                {
                    try { result[kvp.Key] = JsonSerializer.Deserialize<JsonElement>(str); }
                    catch { result[kvp.Key] = kvp.Value; }
                }
                else
                {
                    result[kvp.Key] = kvp.Value;
                }
            }
            return result;
        }

        private async Task<List<Dictionary<string, object?>>> RowsAsync(string sql, object? param = null)
        {
            using var conn = _db.CreateConnection();
            var rows = await conn.QueryAsync(sql, param);
            return rows.Select(r => ToRow((IDictionary<string, object>)r)).ToList();
        }

        private static object? ToDbValue(JsonElement v) => v.ValueKind switch
        {
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number => v.TryGetInt64(out var l) ? l : v.GetDecimal(),
            JsonValueKind.String => v.GetString(),
            _ => v.GetRawText() // arrays / objects are stored as JSON text
        };

        // Column names + parameters from a JSON object. Null when the body is not an object or a name is unsafe.
        private static (List<string> Cols, DynamicParameters Param)? ReadColumns(JsonElement body, params string[] skip)
        {
            if (body.ValueKind != JsonValueKind.Object) return null;
            var cols = new List<string>();
            var param = new DynamicParameters();
            foreach (var prop in body.EnumerateObject())
            {
                if (skip.Contains(prop.Name, StringComparer.OrdinalIgnoreCase)) continue;
                if (!SafeIdent.IsMatch(prop.Name)) return null;
                cols.Add(prop.Name);
                param.Add("v_" + prop.Name, ToDbValue(prop.Value));
            }
            return (cols, param);
        }

        // INSERT one row (or each row of an array). updated_at, when sent, is set by the server clock.
        private async Task<IActionResult> InsertRowsAsync(string table, JsonElement body)
        {
            var items = body.ValueKind == JsonValueKind.Array ? body.EnumerateArray().ToList() : new List<JsonElement> { body };
            if (items.Count == 0) return BadRequest(new { error = "Empty body." });

            using var conn = _db.CreateConnection();
            conn.Open();
            using var trans = conn.BeginTransaction();
            foreach (var item in items)
            {
                var parsed = ReadColumns(item, "updated_at");
                if (parsed is null) { trans.Rollback(); return BadRequest(new { error = "Invalid body or column name." }); }
                var (cols, param) = parsed.Value;
                var names = cols.Select(c => $"[{c}]").ToList();
                var values = cols.Select(c => $"@v_{c}").ToList();
                if (item.TryGetProperty("updated_at", out _)) { names.Add("[updated_at]"); values.Add("SYSDATETIMEOFFSET()"); }
                if (names.Count == 0) { trans.Rollback(); return BadRequest(new { error = "Empty row." }); }
                await conn.ExecuteAsync($"INSERT INTO [{table}] ({string.Join(", ", names)}) VALUES ({string.Join(", ", values)});", param, trans);
            }
            trans.Commit();
            return Ok(new { success = true, count = items.Count });
        }

        // UPDATE the row whose key column equals keyValue with the fields in body.
        private async Task<IActionResult> UpdateRowAsync(string table, string keyColumn, object keyValue, JsonElement body, bool touchUpdatedAt)
        {
            var parsed = ReadColumns(body, keyColumn, "updated_at", "id");
            if (parsed is null) return BadRequest(new { error = "Invalid body or column name." });
            var (cols, param) = parsed.Value;
            var sets = cols.Select(c => $"[{c}] = @v_{c}").ToList();
            if (touchUpdatedAt) sets.Add("[updated_at] = SYSDATETIMEOFFSET()");
            if (sets.Count == 0) return BadRequest(new { error = "Nothing to update." });
            param.Add("key", keyValue);

            using var conn = _db.CreateConnection();
            int rows = await conn.ExecuteAsync($"UPDATE [{table}] SET {string.Join(", ", sets)} WHERE [{keyColumn}] = @key;", param);
            return Ok(new { success = true, rows_affected = rows });
        }

        // ==========================================
        // WORKERS
        // ==========================================
        // is_online = heartbeat (every ~30s) received in the last 90s. Computed on the DB clock so it is not skewed by client time.
        [HttpGet("workers")]
        public async Task<IActionResult> ListWorkers() => Ok(await RowsAsync(@"
            SELECT worker_id, last_seen, started_at, paused, pause_reason, drain, task_limit, tools, task_types,
                   CASE WHEN last_seen >= DATEADD(SECOND, -90, SYSDATETIMEOFFSET()) THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS is_online
            FROM ai_studio_workers ORDER BY worker_id;"));

        [HttpGet("worker-load")]
        public async Task<IActionResult> ListWorkerLoad() =>
            Ok(await RowsAsync("SELECT * FROM ai_studio_worker_load ORDER BY worker_id;"));

        // ==========================================
        // TASKS
        // ==========================================
        // ?status=&appId=&limit=&offset= ; returns { total, data } newest first, max 100 per page.
        [HttpGet("tasks")]
        public async Task<IActionResult> ListTasks([FromQuery] string? status, [FromQuery] string? appId,
            [FromQuery] int limit = 20, [FromQuery] int offset = 0)
        {
            limit = Math.Clamp(limit, 1, 100);
            offset = Math.Max(0, offset);
            var where = new List<string>();
            if (!string.IsNullOrWhiteSpace(status)) where.Add("status = @Status");
            if (!string.IsNullOrWhiteSpace(appId)) where.Add("app_id = @AppId");
            string whereSql = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";
            var p = new { Status = status, AppId = appId, Limit = limit, Offset = offset };

            using var conn = _db.CreateConnection();
            int total = await conn.ExecuteScalarAsync<int>($"SELECT COUNT(1) FROM ai_studio_tasks WITH (NOLOCK) {whereSql};", p);
            var rows = await conn.QueryAsync($@"
                SELECT {TaskColumns} FROM ai_studio_tasks WITH (NOLOCK) {whereSql}
                ORDER BY id DESC OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;", p);
            return Ok(new { total, data = rows.Select(r => ToRow((IDictionary<string, object>)r)) });
        }

        [HttpGet("tasks/{id:long}")]
        public async Task<IActionResult> GetTask(long id)
        {
            var rows = await RowsAsync($"SELECT {TaskColumns} FROM ai_studio_tasks WHERE id = @Id;", new { Id = id });
            return rows.Count == 0 ? NotFound(new { error = "Task not found." }) : Ok(rows[0]);
        }

        // ==========================================
        // CATALOG (tools)
        // ==========================================
        [HttpGet("catalog")]
        public async Task<IActionResult> ListCatalog() =>
            Ok(await RowsAsync("SELECT * FROM ai_studio_task_catalog ORDER BY sort, task_type;"));

        [HttpPost("catalog")]
        public Task<IActionResult> CreateCatalogItem([FromBody] JsonElement body) =>
            InsertRowsAsync("ai_studio_task_catalog", body);

        [HttpPut("catalog/{taskType}")]
        public Task<IActionResult> UpdateCatalogItem(string taskType, [FromBody] JsonElement body) =>
            UpdateRowAsync("ai_studio_task_catalog", "task_type", taskType, body, touchUpdatedAt: true);

        // ==========================================
        // APPS & APP-TOOL LINKS
        // ==========================================
        [HttpGet("apps")]
        public async Task<IActionResult> ListApps() =>
            Ok(await RowsAsync("SELECT * FROM ai_studio_apps ORDER BY sort, app_id;"));

        [HttpGet("apps/{appId}")]
        public async Task<IActionResult> GetApp(string appId)
        {
            var rows = await RowsAsync("SELECT * FROM ai_studio_apps WHERE app_id = @AppId;", new { AppId = appId });
            return rows.Count == 0 ? NotFound(new { error = $"App \"{appId}\" not found." }) : Ok(rows[0]);
        }

        [HttpPost("apps")]
        public Task<IActionResult> CreateApp([FromBody] JsonElement body) => InsertRowsAsync("ai_studio_apps", body);

        [HttpPut("apps/{appId}")]
        public Task<IActionResult> UpdateApp(string appId, [FromBody] JsonElement body) =>
            UpdateRowAsync("ai_studio_apps", "app_id", appId, body, touchUpdatedAt: true);

        // Removes the app and its tool links. The built-in apps cannot be deleted.
        [HttpDelete("apps/{appId}")]
        public async Task<IActionResult> DeleteApp(string appId)
        {
            if (appId.Equals("weargen", StringComparison.OrdinalIgnoreCase) || appId.Equals("ppp", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "Default system apps (WearGen, PPP) cannot be deleted." });
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("DELETE FROM ai_studio_app_tasks WHERE app_id = @AppId;", new { AppId = appId });
            int rows = await conn.ExecuteAsync("DELETE FROM ai_studio_apps WHERE app_id = @AppId;", new { AppId = appId });
            return Ok(new { success = true, rows_affected = rows });
        }

        [HttpGet("app-tasks")]
        public async Task<IActionResult> ListAppTasks([FromQuery] string? appId) =>
            Ok(string.IsNullOrWhiteSpace(appId)
                ? await RowsAsync("SELECT * FROM ai_studio_app_tasks;")
                : await RowsAsync("SELECT * FROM ai_studio_app_tasks WHERE app_id = @AppId;", new { AppId = appId }));

        // Body: { app_id, task_type } or { app_id, task_types: [...] }. Existing links are left as they are.
        [HttpPost("app-tasks")]
        public async Task<IActionResult> LinkAppTasks([FromBody] JsonElement body)
        {
            if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty("app_id", out var a) || a.ValueKind != JsonValueKind.String)
                return BadRequest(new { error = "app_id is required." });
            var types = new List<string>();
            if (body.TryGetProperty("task_type", out var one) && one.ValueKind == JsonValueKind.String) types.Add(one.GetString()!);
            if (body.TryGetProperty("task_types", out var many) && many.ValueKind == JsonValueKind.Array)
                types.AddRange(many.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!));
            if (types.Count == 0) return BadRequest(new { error = "task_type or task_types is required." });

            using var conn = _db.CreateConnection();
            int added = 0;
            foreach (var type in types.Distinct())
            {
                added += await conn.ExecuteAsync(@"
                    IF NOT EXISTS (SELECT 1 FROM ai_studio_app_tasks WHERE app_id = @AppId AND task_type = @TaskType)
                        INSERT INTO ai_studio_app_tasks (app_id, task_type) VALUES (@AppId, @TaskType);",
                    new { AppId = a.GetString(), TaskType = type });
            }
            return Ok(new { success = true, added });
        }

        // ?appId=x&taskTypes=a,b ; without taskTypes every link of the app is removed.
        [HttpDelete("app-tasks")]
        public async Task<IActionResult> UnlinkAppTasks([FromQuery] string appId, [FromQuery] string? taskTypes)
        {
            if (string.IsNullOrWhiteSpace(appId)) return BadRequest(new { error = "appId is required." });
            using var conn = _db.CreateConnection();
            int rows;
            if (string.IsNullOrWhiteSpace(taskTypes))
            {
                rows = await conn.ExecuteAsync("DELETE FROM ai_studio_app_tasks WHERE app_id = @AppId;", new { AppId = appId });
            }
            else
            {
                var list = taskTypes.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                rows = await conn.ExecuteAsync("DELETE FROM ai_studio_app_tasks WHERE app_id = @AppId AND task_type IN @Types;",
                    new { AppId = appId, Types = list });
            }
            return Ok(new { success = true, rows_affected = rows });
        }

        // ==========================================
        // FAMILY ROLES, MODELS, PROMPTS
        // ==========================================
        [HttpGet("family-roles")]
        public async Task<IActionResult> ListFamilyRoles() =>
            Ok(await RowsAsync("SELECT * FROM ai_studio_family_roles ORDER BY sort_order, role_key;"));

        [HttpGet("models")]
        public async Task<IActionResult> ListModels() =>
            Ok(await RowsAsync("SELECT * FROM ai_studio_models ORDER BY model_id;"));

        [HttpGet("prompts")]
        public async Task<IActionResult> ListPrompts() =>
            Ok(await RowsAsync("SELECT * FROM ai_studio_prompts ORDER BY task_type;"));

        [HttpPost("prompts")]
        public Task<IActionResult> CreatePrompt([FromBody] JsonElement body) => InsertRowsAsync("ai_studio_prompts", body);

        [HttpPut("prompts/{taskType}")]
        public Task<IActionResult> UpdatePrompt(string taskType, [FromBody] JsonElement body) =>
            UpdateRowAsync("ai_studio_prompts", "task_type", taskType, body, touchUpdatedAt: true);

        // ==========================================
        // SETTINGS & SECRETS
        // ==========================================
        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            var settings = await RowsAsync("SELECT * FROM ai_studio_settings WHERE id = 1;");
            var secrets = await RowsAsync("SELECT imgbb_api_key, brevo_api_key FROM ai_studio_secrets WHERE id = 1;");
            return Ok(new
            {
                settings = settings.FirstOrDefault() ?? new Dictionary<string, object?>(),
                secrets = secrets.FirstOrDefault() ?? new Dictionary<string, object?>()
            });
        }

        [HttpPut("settings")]
        public Task<IActionResult> UpdateSettings([FromBody] JsonElement body) =>
            UpdateRowAsync("ai_studio_settings", "id", 1, body, touchUpdatedAt: true);

        // Only the two keys the admin UI manages can be written.
        [HttpPut("secrets")]
        public async Task<IActionResult> UpdateSecrets([FromBody] JsonElement body)
        {
            if (body.ValueKind != JsonValueKind.Object) return BadRequest(new { error = "Invalid body." });
            foreach (var prop in body.EnumerateObject())
                if (prop.Name is not ("imgbb_api_key" or "brevo_api_key"))
                    return BadRequest(new { error = $"Field \"{prop.Name}\" cannot be changed here." });
            return await UpdateRowAsync("ai_studio_secrets", "id", 1, body, touchUpdatedAt: false);
        }

        // ==========================================
        // API USAGE (per client app, from ai_studio_tasks)
        // ==========================================
        // ?days=28 ; { days: [{ day, app_id, tasks, done, failed, photos }], tools: [{ app_id, task_type, tasks, failed }] }
        [HttpGet("usage")]
        public async Task<IActionResult> GetUsage([FromQuery] int days = 28)
        {
            days = Math.Clamp(days, 1, 365);
            var p = new { Days = days };
            var byDay = await RowsAsync(@"
                SELECT CONVERT(VARCHAR(10), CAST(created_at AS DATE), 23) AS day,
                       COALESCE(NULLIF(app_id, ''), 'weargen') AS app_id,
                       COUNT(1) AS tasks,
                       SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
                       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
                       SUM(CASE WHEN status = 'done' AND tool = 'image' THEN COALESCE(batch_count, 1) ELSE 0 END) AS photos
                FROM ai_studio_tasks WITH (NOLOCK)
                WHERE created_at > DATEADD(DAY, -@Days, CAST(SYSDATETIMEOFFSET() AS DATE))
                GROUP BY CAST(created_at AS DATE), COALESCE(NULLIF(app_id, ''), 'weargen')
                ORDER BY day, app_id;", p);
            var byTool = await RowsAsync(@"
                SELECT COALESCE(NULLIF(app_id, ''), 'weargen') AS app_id, task_type,
                       COUNT(1) AS tasks,
                       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
                FROM ai_studio_tasks WITH (NOLOCK)
                WHERE created_at > DATEADD(DAY, -@Days, CAST(SYSDATETIMEOFFSET() AS DATE))
                GROUP BY COALESCE(NULLIF(app_id, ''), 'weargen'), task_type
                ORDER BY app_id, tasks DESC;", p);
            return Ok(new { days = byDay, tools = byTool });
        }
    }
}
