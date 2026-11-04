using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using AIStudio.Api.Services;
using Dapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace AIStudio.Api.Controllers
{
    [ApiController]
    public class RestController : ControllerBase
    {
        private readonly DatabaseService _db;
        private readonly IMemoryCache _cache;

        public RestController(DatabaseService db, IMemoryCache cache)
        {
            _db = db;
            _cache = cache;
        }

        private (string? userId, bool isAdmin) GetAuthContext()
        {
            string? tokenStr = null;
            var authHeader = Request.Headers["Authorization"].ToString();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                tokenStr = authHeader.Substring("Bearer ".Length).Trim();
            }
            else if (Request.Cookies.TryGetValue("aistudio_jwt", out var cToken) && !string.IsNullOrEmpty(cToken))
            {
                tokenStr = cToken;
            }

            if (string.IsNullOrWhiteSpace(tokenStr)) return (null, false);

            try
            {
                var handler = new JwtSecurityTokenHandler();
                if (!handler.CanReadToken(tokenStr)) return (null, false);
                var jwt = handler.ReadJwtToken(tokenStr);
                if (jwt.ValidTo < DateTime.UtcNow) return (null, false);

                var userId = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier || c.Type == "sub")?.Value;
                var roleClaim = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role")?.Value ?? "";
                var adminClaim = jwt.Claims.FirstOrDefault(c => c.Type == "is_admin")?.Value;

                bool isAdmin = (adminClaim != null && adminClaim.Equals("true", StringComparison.OrdinalIgnoreCase))
                    || roleClaim.Equals("admin", StringComparison.OrdinalIgnoreCase);

                return (userId, isAdmin);
            }
            catch
            {
                return (null, false);
            }
        }

        private static readonly HashSet<string> JsonColumnNames = new(StringComparer.OrdinalIgnoreCase)
        {
            "extra_image_urls", "output_image_urls", "imgbb_image_urls", "extras",
            "inputs", "optional", "labels", "customer_labels", "task_types", "apps",
            "aspect_ratios", "image_sizes", "rules", "payload", "tags"
        };

        private static readonly HashSet<string> CacheableTables = new(StringComparer.OrdinalIgnoreCase)
        {
            "ai_studio_task_catalog",
            "ai_studio_apps",
            "ai_studio_app_tasks",
            "ai_studio_models",
            "ai_studio_prompts",
            "ai_studio_family_roles",
            "ai_studio_settings"
        };

        private static Dictionary<string, object?> ParseJsonColumns(IDictionary<string, object> row)
        {
            var result = new Dictionary<string, object?>(row.Count);
            foreach (var kvp in row)
            {
                if (JsonColumnNames.Contains(kvp.Key) && kvp.Value is string str && str.Length >= 2 &&
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

        private static readonly HashSet<string> LargeTables = new(StringComparer.OrdinalIgnoreCase)
        {
            "ai_studio_tasks",
            "ai_studio_admin_log",
            "ai_studio_alert_log",
            "ai_studio_usage",
            "ai_studio_users"
        };

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
            "ai_studio_catalog",
            "ai_studio_family_roles",
            "ai_studio_apps",
            "ai_studio_app_tasks",
            "ai_studio_users",
            "ai_studio_admins",
            "ai_studio_action_log",
            "ai_studio_worker_tools"
        };

        private static string NormalizeTableName(string table)
        {
            if (string.Equals(table, "ai_studio_catalog", StringComparison.OrdinalIgnoreCase))
                return "ai_studio_task_catalog";
            if (string.Equals(table, "ai_studio_action_log", StringComparison.OrdinalIgnoreCase))
                return "ai_studio_admin_log";
            if (string.Equals(table, "ai_studio_worker_tools", StringComparison.OrdinalIgnoreCase))
                return "ai_studio_tools";
            return table;
        }

        private void InvalidateTableCache(string table)
        {
            table = NormalizeTableName(table);
            if (CacheableTables.Contains(table))
            {
                // Remove base cache key and notify controllers
                _cache.Remove($"table_{table.ToLowerInvariant()}_all");
                _cache.Remove($"rpc_get_task_catalog");
                _cache.Remove($"rpc_get_app_list");
            }
        }

        [HttpGet("rest/v1/{table}")]
        [HttpGet("api/rest/{table}")]
        public async Task<IActionResult> QueryTable(string table)
        {
            table = NormalizeTableName(table);
            if (!AllowedTables.Contains(table))
                return NotFound(new { error = $"Table {table} not allowed." });

            string queryString = Request.QueryString.Value ?? "";
            bool isCacheable = CacheableTables.Contains(table) && string.IsNullOrEmpty(queryString);
            string cacheKey = $"table_{table.ToLowerInvariant()}_all";

            if (isCacheable && _cache.TryGetValue(cacheKey, out var cachedData))
            {
                return Ok(cachedData);
            }

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

            // Customer Row-Level Security (RLS) Isolation
            if (table.Equals("ai_studio_tasks", StringComparison.OrdinalIgnoreCase))
            {
                var (authUserId, isAdmin) = GetAuthContext();
                if (!isAdmin && !string.IsNullOrEmpty(authUserId))
                {
                    // Strictly isolate to the authenticated customer's own tasks
                    whereClauses.RemoveAll(c => c.StartsWith("[user_id]"));
                    paramIndex++;
                    string authParam = $"p_auth_uid_{paramIndex}";
                    whereClauses.Add($"[user_id] = @{authParam}");
                    param.Add(authParam, authUserId);
                }
            }

            string whereSql = whereClauses.Count > 0 ? "WHERE " + string.Join(" AND ", whereClauses) : "";

            bool needsCount = query.ContainsKey("count") || query.ContainsKey("head") ||
                (Request.Headers.TryGetValue("Prefer", out var pref) && pref.ToString().Contains("count=exact"));
            int totalCount = 0;
            if (needsCount)
            {
                // High performance lock-free count
                string countSql = $"SELECT COUNT(1) FROM [{table}] WITH (NOLOCK) {whereSql};";
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
                if (table.Equals("ai_studio_family_roles", StringComparison.OrdinalIgnoreCase) && col.Equals("sort", StringComparison.OrdinalIgnoreCase))
                {
                    col = "sort_order";
                }
                orderSql = $"ORDER BY [{col}] {dir}";
            }

            int offsetVal = 0;
            if (query.TryGetValue("offset", out var off) && int.TryParse(off.ToString(), out int oVal))
                offsetVal = Math.Max(0, oVal);

            int? limitVal = null;
            if (query.TryGetValue("limit", out var lim) && int.TryParse(lim.ToString(), out int lVal))
                limitVal = Math.Max(1, lVal);

            // Enforce Server-Side Pagination on heavy tables (Avoid unbounded full table memory dumps)
            if (!limitVal.HasValue && LargeTables.Contains(table))
            {
                limitVal = 50; // Default page limit: 50
            }
            if (limitVal.HasValue)
            {
                limitVal = Math.Min(limitVal.Value, 100); // Strict safety ceiling: max 100 items per request
            }

            string sql;
            if (limitVal.HasValue)
            {
                if (string.IsNullOrEmpty(orderSql))
                {
                    orderSql = "ORDER BY (SELECT NULL)";
                }
                // High performance lock-free query with NOLOCK hint
                sql = $"SELECT {select} FROM [{table}] WITH (NOLOCK) {whereSql} {orderSql} OFFSET {offsetVal} ROWS FETCH NEXT {limitVal.Value} ROWS ONLY;";
            }
            else
            {
                // High performance lock-free query with NOLOCK hint
                sql = $"SELECT {select} FROM [{table}] WITH (NOLOCK) {whereSql} {orderSql};";
            }

            var rows = (await conn.QueryAsync(sql, param)).ToList();
            var parsed = rows.Select(r => ParseJsonColumns((IDictionary<string, object>)r)).ToList();

            // Set standard pagination metadata headers
            Response.Headers["X-Page-Limit"] = (limitVal ?? parsed.Count).ToString();
            Response.Headers["X-Page-Offset"] = offsetVal.ToString();

            if (needsCount)
            {
                int toIndex = offsetVal + parsed.Count - 1;
                Response.Headers["Content-Range"] = parsed.Count > 0 ? $"{offsetVal}-{toIndex}/{totalCount}" : $"*/{totalCount}";
                Response.Headers["X-Total-Count"] = totalCount.ToString();
            }

            // PostgREST / Standard REST header check for single object
            if (Request.Headers.TryGetValue("Accept", out var accept) && accept.ToString().Contains("application/vnd.pgrst.object+json"))
            {
                return Ok(parsed.FirstOrDefault());
            }

            // Save to memory cache for 3 minutes if static table
            if (isCacheable)
            {
                _cache.Set(cacheKey, parsed, TimeSpan.FromMinutes(3));
            }

            return Ok(parsed);
        }

        [HttpPost("rest/v1/{table}")]
        [HttpPost("api/rest/{table}")]
        public async Task<IActionResult> InsertTable(string table, [FromBody] JsonElement body)
        {
            table = NormalizeTableName(table);
            if (!AllowedTables.Contains(table))
                return NotFound(new { error = $"Table {table} not allowed." });

            InvalidateTableCache(table);

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

            if (conn.State != System.Data.ConnectionState.Open) conn.Open();
            using var trans = conn.BeginTransaction();
            try
            {
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
                    await conn.ExecuteAsync(sql, param, trans);
                }
                trans.Commit();
            }
            catch
            {
                trans.Rollback();
                throw;
            }

            return Ok(new { success = true, count = items.Count });
        }

        [HttpPatch("rest/v1/{table}")]
        [HttpPut("rest/v1/{table}")]
        [HttpPatch("api/rest/{table}")]
        [HttpPut("api/rest/{table}")]
        public async Task<IActionResult> UpdateTable(string table, [FromBody] JsonElement body)
        {
            table = NormalizeTableName(table);
            if (!AllowedTables.Contains(table))
                return NotFound(new { error = $"Table {table} not allowed." });

            InvalidateTableCache(table);

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
            table = NormalizeTableName(table);
            if (!AllowedTables.Contains(table))
                return NotFound(new { error = $"Table {table} not allowed." });

            InvalidateTableCache(table);

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
