using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using AIStudio.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;

namespace AIStudio.Api.Controllers
{
    [ApiController]
    public class RestController : ControllerBase
    {
        private readonly DatabaseService _db;

        public RestController(DatabaseService db)
        {
            _db = db;
        }

        private static Dictionary<string, object?> ParseJsonColumns(IDictionary<string, object> row)
        {
            var result = new Dictionary<string, object?>(row.Count);
            foreach (var kvp in row)
            {
                if (kvp.Value is string str && str.Length >= 2 &&
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

        private static readonly HashSet<string> AllowedTables = new(StringComparer.OrdinalIgnoreCase)
        {
            "ai_studio_tasks",
            "ai_studio_workers",
            "ai_studio_worker_load",
            "ai_studio_settings",
            "ai_studio_secrets",
            "ai_studio_models",
            "ai_studio_usage",
            "ai_studio_admin_log",
            "ai_studio_alert_log",
            "ai_studio_prompts",
            "ai_studio_tools",
            "ai_studio_tool_types",
            "ai_studio_task_catalog",
            "ai_studio_family_roles",
            "ai_studio_apps",
            "ai_studio_app_tasks",
            "ai_studio_users",
            "ai_studio_admins"
        };

        [HttpGet("rest/v1/{table}")]
        [HttpGet("api/rest/{table}")]
        public async Task<IActionResult> QueryTable(string table)
        {
            if (!AllowedTables.Contains(table))
                return NotFound(new { error = $"Table {table} not allowed." });

            using var conn = _db.CreateConnection();
            var query = Request.Query;

            string select = query.TryGetValue("select", out var s) ? s.ToString() : "*";
            if (select == "*") select = "*";
            else
            {
                var cols = select.Split(',').Select(c => c.Trim()).Where(c => !string.IsNullOrEmpty(c));
                select = string.Join(", ", cols.Select(c => $"[{c.Replace("]", "")}]"));
            }

            var whereClauses = new List<string>();
            var param = new DynamicParameters();
            int paramIndex = 0;

            foreach (var kvp in query)
            {
                string key = kvp.Key;
                string val = kvp.Value.ToString();

                if (key.Equals("select", StringComparison.OrdinalIgnoreCase) ||
                    key.Equals("order", StringComparison.OrdinalIgnoreCase) ||
                    key.Equals("limit", StringComparison.OrdinalIgnoreCase) ||
                    key.Equals("offset", StringComparison.OrdinalIgnoreCase) ||
                    key.Equals("head", StringComparison.OrdinalIgnoreCase) ||
                    key.Equals("count", StringComparison.OrdinalIgnoreCase))
                    continue;

                paramIndex++;
                string pName = $"p_{paramIndex}";

                if (val.StartsWith("eq."))
                {
                    string cleanVal = val.Substring(3);
                    whereClauses.Add($"[{key}] = @{pName}");
                    param.Add(pName, cleanVal);
                }
                else if (val.StartsWith("neq."))
                {
                    string cleanVal = val.Substring(4);
                    whereClauses.Add($"[{key}] <> @{pName}");
                    param.Add(pName, cleanVal);
                }
                else if (val.StartsWith("gt."))
                {
                    whereClauses.Add($"[{key}] > @{pName}");
                    param.Add(pName, val.Substring(3));
                }
                else if (val.StartsWith("gte."))
                {
                    whereClauses.Add($"[{key}] >= @{pName}");
                    param.Add(pName, val.Substring(4));
                }
                else if (val.StartsWith("lt."))
                {
                    whereClauses.Add($"[{key}] < @{pName}");
                    param.Add(pName, val.Substring(3));
                }
                else if (val.StartsWith("lte."))
                {
                    whereClauses.Add($"[{key}] <= @{pName}");
                    param.Add(pName, val.Substring(4));
                }
                else if (val.StartsWith("in."))
                {
                    string inner = val.Substring(3).Trim('(', ')');
                    var inValues = inner.Split(',').Select(x => x.Trim()).ToArray();
                    var inParams = new List<string>();
                    for (int i = 0; i < inValues.Length; i++)
                    {
                        string inP = $"{pName}_in{i}";
                        inParams.Add($"@{inP}");
                        param.Add(inP, inValues[i]);
                    }
                    whereClauses.Add($"[{key}] IN ({string.Join(", ", inParams)})");
                }
                else if (val.StartsWith("is."))
                {
                    string cleanVal = val.Substring(3).ToLower();
                    if (cleanVal == "null") whereClauses.Add($"[{key}] IS NULL");
                    else if (cleanVal == "not null") whereClauses.Add($"[{key}] IS NOT NULL");
                    else if (cleanVal == "true") whereClauses.Add($"[{key}] = 1");
                    else if (cleanVal == "false") whereClauses.Add($"[{key}] = 0");
                }
            }

            string whereSql = whereClauses.Count > 0 ? "WHERE " + string.Join(" AND ", whereClauses) : "";

            bool needsCount = query.ContainsKey("count") || query.ContainsKey("head") ||
                (Request.Headers.TryGetValue("Prefer", out var pref) && pref.ToString().Contains("count=exact"));
            int totalCount = 0;
            if (needsCount)
            {
                string countSql = $"SELECT COUNT(1) FROM [{table}] {whereSql};";
                totalCount = await conn.ExecuteScalarAsync<int>(countSql, param);
            }

            bool isHead = query.TryGetValue("head", out var h) && h.ToString().Equals("true", StringComparison.OrdinalIgnoreCase);
            if (isHead)
            {
                Response.Headers["Content-Range"] = $"*/{totalCount}";
                Response.Headers["X-Total-Count"] = totalCount.ToString();
                return Ok(new object[0]);
            }

            string orderSql = "";
            if (query.TryGetValue("order", out var ord))
            {
                var parts = ord.ToString().Split('.');
                string col = parts[0].Trim();
                string dir = parts.Length > 1 && parts[1].Equals("desc", StringComparison.OrdinalIgnoreCase) ? "DESC" : "ASC";
                orderSql = $"ORDER BY [{col}] {dir}";
            }

            int offsetVal = 0;
            if (query.TryGetValue("offset", out var off) && int.TryParse(off.ToString(), out int oVal))
                offsetVal = Math.Max(0, oVal);

            int? limitVal = null;
            if (query.TryGetValue("limit", out var lim) && int.TryParse(lim.ToString(), out int lVal))
                limitVal = Math.Max(1, lVal);

            string sql;
            if (limitVal.HasValue)
            {
                if (string.IsNullOrEmpty(orderSql))
                {
                    // Need order by for OFFSET / FETCH
                    orderSql = "ORDER BY (SELECT NULL)";
                }
                sql = $"SELECT {select} FROM [{table}] {whereSql} {orderSql} OFFSET {offsetVal} ROWS FETCH NEXT {limitVal.Value} ROWS ONLY;";
            }
            else
            {
                sql = $"SELECT {select} FROM [{table}] {whereSql} {orderSql};";
            }

            var rows = (await conn.QueryAsync(sql, param)).ToList();
            var parsed = rows.Select(r => ParseJsonColumns((IDictionary<string, object>)r)).ToList();

            if (needsCount)
            {
                int toIndex = offsetVal + parsed.Count - 1;
                Response.Headers["Content-Range"] = parsed.Count > 0 ? $"{offsetVal}-{toIndex}/{totalCount}" : $"*/{totalCount}";
                Response.Headers["X-Total-Count"] = totalCount.ToString();
            }

            // Supabase header check for single object
            if (Request.Headers.TryGetValue("Accept", out var accept) && accept.ToString().Contains("application/vnd.pgrst.object+json"))
            {
                return Ok(parsed.FirstOrDefault());
            }

            return Ok(parsed);
        }

        [HttpPost("rest/v1/{table}")]
        [HttpPost("api/rest/{table}")]
        public async Task<IActionResult> InsertTable(string table, [FromBody] JsonElement body)
        {
            if (!AllowedTables.Contains(table))
                return NotFound(new { error = $"Table {table} not allowed." });

            using var conn = _db.CreateConnection();
            var items = new List<JsonElement>();
            if (body.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in body.EnumerateArray()) items.Add(el);
            }
            else if (body.ValueKind == JsonValueKind.Object)
            {
                items.Add(body);
            }

            foreach (var item in items)
            {
                var cols = new List<string>();
                var vals = new List<string>();
                var param = new DynamicParameters();

                foreach (var prop in item.EnumerateObject())
                {
                    cols.Add($"[{prop.Name}]");
                    vals.Add($"@{prop.Name}");
                    if (prop.Value.ValueKind == JsonValueKind.Null || prop.Value.ValueKind == JsonValueKind.Undefined)
                        param.Add(prop.Name, (object?)null);
                    else if (prop.Value.ValueKind == JsonValueKind.True)
                        param.Add(prop.Name, true);
                    else if (prop.Value.ValueKind == JsonValueKind.False)
                        param.Add(prop.Name, false);
                    else if (prop.Value.ValueKind == JsonValueKind.Number)
                        param.Add(prop.Name, prop.Value.GetDecimal());
                    else
                        param.Add(prop.Name, prop.Value.ToString());
                }

                string sql = $"INSERT INTO [{table}] ({string.Join(", ", cols)}) VALUES ({string.Join(", ", vals)});";
                await conn.ExecuteAsync(sql, param);
            }

            return Ok(new { success = true, count = items.Count });
        }

        [HttpPatch("rest/v1/{table}")]
        [HttpPut("rest/v1/{table}")]
        [HttpPatch("api/rest/{table}")]
        [HttpPut("api/rest/{table}")]
        public async Task<IActionResult> UpdateTable(string table, [FromBody] JsonElement body)
        {
            if (!AllowedTables.Contains(table))
                return NotFound(new { error = $"Table {table} not allowed." });

            using var conn = _db.CreateConnection();
            var query = Request.Query;

            var whereClauses = new List<string>();
            var param = new DynamicParameters();
            int condIndex = 0;

            foreach (var kvp in query)
            {
                string key = kvp.Key;
                string val = kvp.Value.ToString();
                condIndex++;
                string pName = $"cond_{condIndex}";

                if (val.StartsWith("eq."))
                {
                    whereClauses.Add($"[{key}] = @{pName}");
                    param.Add(pName, val.Substring(3));
                }
                else if (val.StartsWith("neq."))
                {
                    whereClauses.Add($"[{key}] <> @{pName}");
                    param.Add(pName, val.Substring(4));
                }
            }

            if (whereClauses.Count == 0)
                return BadRequest(new { error = "Update requires WHERE filter." });

            var setClauses = new List<string>();
            foreach (var prop in body.EnumerateObject())
            {
                setClauses.Add($"[{prop.Name}] = @val_{prop.Name}");
                if (prop.Value.ValueKind == JsonValueKind.Null || prop.Value.ValueKind == JsonValueKind.Undefined)
                    param.Add($"val_{prop.Name}", (object?)null);
                else if (prop.Value.ValueKind == JsonValueKind.True)
                    param.Add($"val_{prop.Name}", true);
                else if (prop.Value.ValueKind == JsonValueKind.False)
                    param.Add($"val_{prop.Name}", false);
                else if (prop.Value.ValueKind == JsonValueKind.Number)
                    param.Add($"val_{prop.Name}", prop.Value.GetDecimal());
                else
                    param.Add($"val_{prop.Name}", prop.Value.ToString());
            }

            string sql = $"UPDATE [{table}] SET {string.Join(", ", setClauses)} WHERE {string.Join(" AND ", whereClauses)};";
            int rows = await conn.ExecuteAsync(sql, param);
            return Ok(new { success = true, rows_affected = rows });
        }

        [HttpDelete("rest/v1/{table}")]
        [HttpDelete("api/rest/{table}")]
        public async Task<IActionResult> DeleteTable(string table)
        {
            if (!AllowedTables.Contains(table))
                return NotFound(new { error = $"Table {table} not allowed." });

            using var conn = _db.CreateConnection();
            var query = Request.Query;

            var whereClauses = new List<string>();
            var param = new DynamicParameters();
            int condIndex = 0;

            foreach (var kvp in query)
            {
                string key = kvp.Key;
                string val = kvp.Value.ToString();
                condIndex++;
                string pName = $"del_cond_{condIndex}";

                if (val.StartsWith("eq."))
                {
                    whereClauses.Add($"[{key}] = @{pName}");
                    param.Add(pName, val.Substring(3));
                }
                else if (val.StartsWith("neq."))
                {
                    whereClauses.Add($"[{key}] <> @{pName}");
                    param.Add(pName, val.Substring(4));
                }
            }

            if (whereClauses.Count == 0)
                return BadRequest(new { error = "Delete requires WHERE filter." });

            string sql = $"DELETE FROM [{table}] WHERE {string.Join(" AND ", whereClauses)};";
            int rows = await conn.ExecuteAsync(sql, param);
            return Ok(new { success = true, rows_affected = rows });
        }
    }
}
