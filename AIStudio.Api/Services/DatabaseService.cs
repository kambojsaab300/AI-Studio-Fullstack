using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using AIStudio.Api.Models;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace AIStudio.Api.Services
{
    public class DatabaseService
    {
        private readonly string _connectionString;
        private static readonly ConcurrentDictionary<string, (CatalogItem item, DateTimeOffset expires)> _catalogCache = new(StringComparer.OrdinalIgnoreCase);

        public DatabaseService(IConfiguration config)
        {
            _connectionString = config.GetConnectionString("DefaultConnection") 
                ?? throw new InvalidOperationException("DefaultConnection string is not configured");
        }

        public IDbConnection CreateConnection() => new SqlConnection(_connectionString);

        public static string HashPassword(string password)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(password));
            return Convert.ToHexString(bytes).ToLower();
        }

        // ==========================================
        // AUTH
        // ==========================================
        public async Task<User?> AuthenticateUserAsync(string email, string password)
        {
            using var conn = CreateConnection();
            string hash = HashPassword(password);
            string sql = "SELECT id, email, password_hash as PasswordHash, role, created_at as CreatedAt FROM ai_studio_users WHERE LOWER(email) = LOWER(@Email)";
            var user = await conn.QuerySingleOrDefaultAsync<User>(sql, new { Email = email.Trim() });
            if (user == null) return null;
            if (user.PasswordHash != hash && user.PasswordHash != password) return null;
            if (user.Email.Equals("admin@aistudio.local", StringComparison.OrdinalIgnoreCase) || 
                user.Email.Equals("amansama65478@gmail.com", StringComparison.OrdinalIgnoreCase))
            {
                user.Role = "admin";
            }
            return user;
        }

        public async Task<User> RegisterUserAsync(string email, string password, string role = "customer")
        {
            using var conn = CreateConnection();
            string hash = HashPassword(password);
            string id = Guid.NewGuid().ToString();
            string sql = @"
                INSERT INTO ai_studio_users (id, email, password_hash, role)
                VALUES (@Id, @Email, @Hash, @Role);
                SELECT id, email, password_hash as PasswordHash, role, created_at as CreatedAt FROM ai_studio_users WHERE id = @Id;";
            
            return await conn.QuerySingleAsync<User>(sql, new { Id = id, Email = email.Trim(), Hash = hash, Role = role });
        }

        public async Task<bool> IsAdminAsync(string userId)
        {
            if (string.Equals(userId, "admin-user-local", StringComparison.OrdinalIgnoreCase)) return true;
            using var conn = CreateConnection();
            string sql = @"
                SELECT 1 FROM ai_studio_admins WHERE user_id = @UserId 
                UNION 
                SELECT 1 FROM ai_studio_users WHERE id = @UserId AND (role = 'admin' OR LOWER(email) IN ('admin@aistudio.local', 'amansama65478@gmail.com'))";
            var result = await conn.ExecuteScalarAsync<int?>(sql, new { UserId = userId });
            return result.HasValue;
        }

        public static bool IsEmptyUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return true;
            var trimmed = url.Trim();
            return trimmed.Equals("null", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("undefined", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("{}", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("[]", StringComparison.OrdinalIgnoreCase);
        }

        public static List<string> ParseUrls(string? jsonOrCsv)
        {
            var list = new List<string>();
            if (string.IsNullOrWhiteSpace(jsonOrCsv)) return list;
            try
            {
                var trimmed = jsonOrCsv.Trim();
                if (trimmed.StartsWith("["))
                {
                    var parsed = JsonSerializer.Deserialize<List<string>>(trimmed);
                    if (parsed != null)
                    {
                        list.AddRange(parsed.Where(s => !IsEmptyUrl(s)));
                        return list;
                    }
                }
            }
            catch { }

            var split = jsonOrCsv.Split(new[] { ',', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var s in split)
            {
                var clean = s.Trim().Trim('"', '\'');
                if (!IsEmptyUrl(clean) && !clean.StartsWith("[") && !clean.StartsWith("]"))
                {
                    list.Add(clean);
                }
            }
            return list;
        }

        public async Task<(bool isValid, string? errorMessage)> ValidateTaskParametersAsync(TaskItem task)
        {
            if (task == null)
                return (false, "Task payload null nahi ho sakta.");

            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(task.TaskType))
                errors.Add("Task Type (task_type) zaroori hai");

            if (string.IsNullOrWhiteSpace(task.Model))
                errors.Add("AI Model (model) zaroori hai");

            if (errors.Count > 0)
                return (false, string.Join("; ", errors));

            string taskType = task.TaskType.Trim();

            CatalogItem? catalog = null;
            if (_catalogCache.TryGetValue(taskType, out var cached) && cached.expires > DateTimeOffset.UtcNow)
            {
                catalog = cached.item;
            }
            else
            {
                using var conn = CreateConnection();
                string sql = @"
                    SELECT TOP 1 task_type as TaskType, label, output, inputs, optional, labels, extras, 
                                 prompt_required as PromptRequired, family, per_photo as PerPhoto, enabled 
                    FROM ai_studio_task_catalog WITH (NOLOCK) 
                    WHERE task_type = @TaskType;";
                catalog = await conn.QuerySingleOrDefaultAsync<CatalogItem>(sql, new { TaskType = taskType });
                if (catalog != null)
                {
                    _catalogCache[taskType] = (catalog, DateTimeOffset.UtcNow.AddMinutes(5));
                }
            }

            if (catalog == null)
            {
                if (taskType.Equals("chat", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.IsNullOrWhiteSpace(task.Prompt))
                        errors.Add("Chat ke liye message / prompt zaroori hai");
                    return (errors.Count == 0, errors.Count > 0 ? string.Join("; ", errors) : null);
                }
                if (taskType.Equals("photo_read", StringComparison.OrdinalIgnoreCase))
                {
                    if (IsEmptyUrl(task.InputImageUrl))
                        errors.Add("Photo Read ke liye Input photo (input_image_url) zaroori hai");
                    return (errors.Count == 0, errors.Count > 0 ? string.Join("; ", errors) : null);
                }

                return (false, $"Task type '{taskType}' invalid hai ya catalog mein registered nahi hai");
            }

            if (!catalog.Enabled)
            {
                return (false, $"Task type '{catalog.Label ?? taskType}' currently disabled hai");
            }

            var inputs = new List<string>();
            if (!string.IsNullOrWhiteSpace(catalog.Inputs))
            {
                try { inputs = JsonSerializer.Deserialize<List<string>>(catalog.Inputs) ?? inputs; } catch { }
            }

            var optional = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(catalog.Optional))
            {
                try
                {
                    var optList = JsonSerializer.Deserialize<List<string>>(catalog.Optional);
                    if (optList != null) foreach (var o in optList) optional.Add(o);
                }
                catch { }
            }

            var labels = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(catalog.Labels))
            {
                try { labels = JsonSerializer.Deserialize<Dictionary<string, string>>(catalog.Labels) ?? labels; } catch { }
            }

            foreach (var slot in inputs)
            {
                if (optional.Contains(slot)) continue;

                if (slot.Equals("face", StringComparison.OrdinalIgnoreCase))
                {
                    if (IsEmptyUrl(task.FaceImageUrl))
                    {
                        string slotLabel = labels.GetValueOrDefault("face", "Model / Face photo");
                        errors.Add($"{slotLabel} (face_image_url) zaroori hai");
                    }
                }
                else if (slot.Equals("style", StringComparison.OrdinalIgnoreCase))
                {
                    if (IsEmptyUrl(task.StyleImageUrl))
                    {
                        string slotLabel = labels.GetValueOrDefault("style", "Style / Garment photo");
                        errors.Add($"{slotLabel} (style_image_url) zaroori hai");
                    }
                }
                else if (slot.Equals("input", StringComparison.OrdinalIgnoreCase))
                {
                    if (IsEmptyUrl(task.InputImageUrl))
                    {
                        string slotLabel = labels.GetValueOrDefault("input", "Input photo");
                        errors.Add($"{slotLabel} (input_image_url) zaroori hai");
                    }
                }
            }

            if (catalog.PromptRequired && string.IsNullOrWhiteSpace(task.Prompt))
            {
                errors.Add($"Creative prompt zaroori hai is task type ke liye ('{catalog.Label ?? taskType}')");
            }

            if (catalog.Family)
            {
                var extraUrls = ParseUrls(task.ExtraImageUrls);
                if (extraUrls.Count < 2)
                {
                    errors.Add("Parivar (Family photo) ke liye kam se kam 2 photos (extra_image_urls) zaroori hain");
                }
            }
            else if (catalog.Extras && inputs.Count == 0)
            {
                var extraUrls = ParseUrls(task.ExtraImageUrls);
                if (extraUrls.Count == 0)
                {
                    errors.Add("Kam se kam 1 photo (extra_image_urls) zaroori hai is task ke liye");
                }
            }

            if (task.BatchCount < 1 || task.BatchCount > 10)
            {
                task.BatchCount = Math.Clamp(task.BatchCount, 1, 10);
            }

            if (errors.Count > 0)
            {
                return (false, string.Join("; ", errors));
            }

            return (true, null);
        }

        // ==========================================
        // TASK CREATION (Customer & Admin) - Zero N+1 Round Trips
        // ==========================================
        public async Task<long> CreateTaskAsync(TaskItem task)
        {
            var (isValid, errorMsg) = await ValidateTaskParametersAsync(task);
            if (!isValid)
            {
                throw new ArgumentException(errorMsg ?? "Task validation failed");
            }

            using var conn = CreateConnection();

            task.CreatedAt = DateTimeOffset.UtcNow;
            task.UpdatedAt = DateTimeOffset.UtcNow;
            task.Status = "pending";

            // Tool is resolved inline in SQL Server in 1 single round-trip (No N+1 tool lookup query)
            string insertSql = @"
                INSERT INTO ai_studio_tasks (
                    task_type, model, prompt, system_text, aspect_ratio, image_size,
                    face_image_url, style_image_url, input_image_url, extra_image_urls,
                    conversation_id, output_text, output_image_url, output_image_urls,
                    user_id, batch_count, status, worker_id, tool, app_id, priority, family_role_keys,
                    created_at, updated_at
                )
                OUTPUT INSERTED.id
                VALUES (
                    @TaskType, @Model, @Prompt, @SystemText, @AspectRatio, @ImageSize,
                    @FaceImageUrl, @StyleImageUrl, @InputImageUrl, @ExtraImageUrls,
                    @ConversationId, @OutputText, @OutputImageUrl, @OutputImageUrls,
                    @UserId, @BatchCount, @Status, @WorkerId,
                    COALESCE(
                        @Tool,
                        (SELECT TOP 1 tt.tool 
                         FROM ai_studio_task_catalog c WITH (NOLOCK) 
                         LEFT JOIN ai_studio_tool_types tt WITH (NOLOCK) ON tt.task_type = c.task_type 
                         WHERE c.task_type = @TaskType),
                        'image'
                    ),
                    @AppId, @Priority, @FamilyRoleKeys,
                    @CreatedAt, @UpdatedAt
                );";

            return await conn.ExecuteScalarAsync<long>(insertSql, task);
        }

        // ==========================================
        // WORKER OPERATIONS
        // ==========================================
        public async Task<string> RegisterWorkerAsync(string? wantedId = null)
        {
            using var conn = CreateConnection();
            if (!string.IsNullOrWhiteSpace(wantedId))
            {
                string sqlWanted = @"
                    IF NOT EXISTS (SELECT 1 FROM ai_studio_workers WHERE worker_id = @Id)
                        INSERT INTO ai_studio_workers (worker_id, last_seen, started_at) VALUES (@Id, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
                    ELSE
                        UPDATE ai_studio_workers SET last_seen = SYSDATETIMEOFFSET() WHERE worker_id = @Id;
                    SELECT @Id;";
                return await conn.ExecuteScalarAsync<string>(sqlWanted, new { Id = wantedId.Trim() });
            }

            // Find next worker number worker_1, worker_2...
            string findNext = @"
                DECLARE @i INT = 1;
                DECLARE @candidate NVARCHAR(100);
                WHILE 1 = 1
                BEGIN
                    SET @candidate = 'worker_' + CAST(@i AS NVARCHAR(10));
                    IF NOT EXISTS (SELECT 1 FROM ai_studio_workers WHERE worker_id = @candidate)
                    BEGIN
                        INSERT INTO ai_studio_workers (worker_id, last_seen, started_at) VALUES (@candidate, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());
                        BREAK;
                    END
                    SET @i = @i + 1;
                END
                SELECT @candidate;";

            return await conn.ExecuteScalarAsync<string>(findNext);
        }

        public async Task<(bool paused, bool drain)> WorkerHeartbeatAsync(string workerId)
        {
            using var conn = CreateConnection();
            string sql = @"
                UPDATE ai_studio_workers 
                SET last_seen = SYSDATETIMEOFFSET() 
                OUTPUT inserted.paused, inserted.drain
                WHERE worker_id = @WorkerId;";
            
            var res = await conn.QuerySingleOrDefaultAsync<(bool paused, bool drain)>(sql, new { WorkerId = workerId });
            return res;
        }

        public async Task<int> WorkerReleaseAsync(string workerId)
        {
            using var conn = CreateConnection();
            string sql = @"
                UPDATE ai_studio_tasks 
                SET status = 'pending', worker_id = NULL, locked_at = NULL, updated_at = SYSDATETIMEOFFSET()
                WHERE worker_id = @WorkerId AND status = 'processing';";
            return await conn.ExecuteAsync(sql, new { WorkerId = workerId });
        }

        public async Task<IEnumerable<TaskItem>> GetPendingForWorkerAsync(string workerId, DateTimeOffset staleBefore, int limit = 40)
        {
            using var conn = CreateConnection();
            // Get worker tools and task types
            var worker = await conn.QuerySingleOrDefaultAsync<Worker>(
                "SELECT worker_id as WorkerId, tools, task_types as TaskTypes, paused, drain FROM ai_studio_workers WHERE worker_id = @WorkerId",
                new { WorkerId = workerId });

            if (worker == null || worker.Paused || worker.Drain) return Enumerable.Empty<TaskItem>();

            List<string> tools = new() { "chat", "image" };
            if (!string.IsNullOrWhiteSpace(worker.Tools))
            {
                try { tools = JsonSerializer.Deserialize<List<string>>(worker.Tools) ?? tools; } catch { }
            }

            List<string>? specificTypes = null;
            if (!string.IsNullOrWhiteSpace(worker.TaskTypes))
            {
                try { specificTypes = JsonSerializer.Deserialize<List<string>>(worker.TaskTypes); } catch { }
            }

            string sql = @"
                SELECT TOP (@Limit)
                    id, task_type as TaskType, model, prompt, system_text as SystemText, aspect_ratio as AspectRatio, image_size as ImageSize,
                    face_image_url as FaceImageUrl, style_image_url as StyleImageUrl, input_image_url as InputImageUrl, extra_image_urls as ExtraImageUrls,
                    conversation_id as ConversationId, output_text as OutputText, output_image_url as OutputImageUrl, output_image_urls as OutputImageUrls,
                    imgbb_image_urls as ImgbbImageUrls, face_match_score as FaceMatchScore, user_id as UserId, batch_count as BatchCount,
                    status, error, worker_id as WorkerId, tool, app_id as AppId, attempts, priority, family_role_keys as FamilyRoleKeys,
                    locked_at as LockedAt, next_run_at as NextRunAt, created_at as CreatedAt, updated_at as UpdatedAt
                FROM ai_studio_tasks WITH (READPAST)
                WHERE (status = 'pending' OR (status = 'processing' AND locked_at < @StaleBefore))
                  AND (next_run_at IS NULL OR next_run_at <= SYSDATETIMEOFFSET())
                  AND tool IN @Tools
                  AND (@FilterTypes = 0 OR task_type IN @SpecificTypes)
                ORDER BY priority DESC, id ASC;";

            return await conn.QueryAsync<TaskItem>(sql, new {
                Limit = limit,
                StaleBefore = staleBefore,
                Tools = tools,
                FilterTypes = (specificTypes != null && specificTypes.Count > 0) ? 1 : 0,
                SpecificTypes = specificTypes ?? new List<string>()
            });
        }

        public async Task<bool> ClaimTaskAsync(long taskId, string workerId)
        {
            using var conn = CreateConnection();
            string sql = @"
                UPDATE ai_studio_tasks
                SET status = 'processing',
                    worker_id = @WorkerId,
                    locked_at = SYSDATETIMEOFFSET(),
                    updated_at = SYSDATETIMEOFFSET()
                WHERE id = @TaskId 
                  AND (status = 'pending' OR (status = 'processing' AND locked_at < DATEADD(minute, -10, SYSDATETIMEOFFSET())));";

            int rows = await conn.ExecuteAsync(sql, new { TaskId = taskId, WorkerId = workerId });
            return rows > 0;
        }

        public async Task<bool> CompleteTaskAsync(long taskId, string workerId, string status, string? outputImageUrl, string? outputImageUrls, string? outputText, decimal? matchScore, string? error, int? processMs)
        {
            using var conn = CreateConnection();

            // App-specific error formatting: Stamp originating app_id in error return
            if (status == "failed" && !string.IsNullOrWhiteSpace(error))
            {
                try
                {
                    var taskAppId = await conn.ExecuteScalarAsync<string>(
                        "SELECT app_id FROM ai_studio_tasks WITH (NOLOCK) WHERE id = @TaskId;", new { TaskId = taskId });
                    if (!string.IsNullOrEmpty(taskAppId))
                    {
                        string prefix = $"[{taskAppId.ToUpper()}]";
                        if (!error.StartsWith("[", StringComparison.OrdinalIgnoreCase))
                        {
                            error = $"{prefix} {error}";
                        }
                    }
                }
                catch { }
            }

            string sql = @"
                UPDATE ai_studio_tasks
                SET status = @Status,
                    output_image_url = COALESCE(@OutputImageUrl, output_image_url),
                    output_image_urls = COALESCE(@OutputImageUrls, output_image_urls),
                    output_text = COALESCE(@OutputText, output_text),
                    face_match_score = COALESCE(@MatchScore, face_match_score),
                    error = @Error,
                    process_ms = @ProcessMs,
                    finished_at = SYSDATETIMEOFFSET(),
                    duration_ms = DATEDIFF(millisecond, created_at, SYSDATETIMEOFFSET()),
                    updated_at = SYSDATETIMEOFFSET()
                WHERE id = @TaskId AND worker_id = @WorkerId;";

            int rows = await conn.ExecuteAsync(sql, new {
                TaskId = taskId,
                WorkerId = workerId,
                Status = status,
                OutputImageUrl = outputImageUrl,
                OutputImageUrls = outputImageUrls,
                OutputText = outputText,
                MatchScore = matchScore,
                Error = error,
                ProcessMs = processMs
            });

            return rows > 0;
        }

        public async Task AutoPauseWorkerAsync(string workerId, string reason)
        {
            using var conn = CreateConnection();
            string sql = @"UPDATE ai_studio_workers SET paused = 1, pause_reason = @Reason WHERE worker_id = @WorkerId;";
            await conn.ExecuteAsync(sql, new { WorkerId = workerId, Reason = reason });
        }

        public async Task<int> RecordBudgetTakeAsync(string workerId, int calls = 1)
        {
            using var conn = CreateConnection();
            string sql = @"
                MERGE ai_studio_usage AS target
                USING (SELECT CAST(SYSDATETIMEOFFSET() AS DATE) AS [day], @WorkerId AS worker_id) AS source
                ON (target.[day] = source.[day] AND target.worker_id = source.worker_id)
                WHEN MATCHED THEN
                    UPDATE SET calls = target.calls + @Calls
                WHEN NOT MATCHED THEN
                    INSERT ([day], worker_id, calls) VALUES (source.[day], source.worker_id, @Calls);";

            await conn.ExecuteAsync(sql, new { WorkerId = workerId, Calls = calls });

            var totalToday = await conn.ExecuteScalarAsync<int>(
                "SELECT COALESCE(SUM(calls), 0) FROM ai_studio_usage WHERE [day] = CAST(SYSDATETIMEOFFSET() AS DATE);");

            var budget = await conn.ExecuteScalarAsync<int>(
                "SELECT daily_gemini_budget FROM ai_studio_settings WHERE id = 1;");

            if (budget > 0)
                return Math.Max(0, budget - totalToday);
            return 999999;
        }

        // ==========================================
        // CATALOG, MODELS, SETTINGS, APPS
        // ==========================================
        public async Task<IEnumerable<CatalogItem>> GetCatalogAsync()
        {
            using var conn = CreateConnection();
            string sql = @"
                SELECT c.task_type as TaskType, c.label, c.customer_label as CustomerLabel, c.hint, c.output,
                       c.inputs, c.optional, c.labels, c.customer_labels as CustomerLabels, c.extras,
                       c.prompt_required as PromptRequired, c.face_check as FaceCheck, c.edit, c.transparent,
                       c.angles, c.family, c.per_photo as PerPhoto, c.customer_visible as CustomerVisible,
                       c.enabled, c.sort, COALESCE(tt.tool, 'image') as Tool, c.updated_at as UpdatedAt,
                       COALESCE((
                           SELECT STRING_AGG(m.app_id, ',')
                           FROM ai_studio_app_tasks m WITH (NOLOCK)
                           JOIN ai_studio_apps a WITH (NOLOCK) ON a.app_id = m.app_id
                           WHERE m.task_type = c.task_type AND a.enabled = 1
                       ), 'weargen,ppp') as AppsCsv
                FROM ai_studio_task_catalog c
                LEFT JOIN ai_studio_tool_types tt ON tt.task_type = c.task_type
                ORDER BY c.sort ASC, c.task_type ASC;";
            return await conn.QueryAsync<CatalogItem>(sql);
        }

        public async Task<IEnumerable<FamilyRole>> GetFamilyRolesAsync()
        {
            using var conn = CreateConnection();
            string sql = @"
                SELECT role_key as RoleKey, label_admin as LabelAdmin, label_customer as LabelCustomer,
                       prompt_text as PromptText, sort_order as SortOrder, enabled, updated_at as UpdatedAt
                FROM ai_studio_family_roles
                ORDER BY sort_order ASC;";
            return await conn.QueryAsync<FamilyRole>(sql);
        }

        public async Task<IEnumerable<AiModel>> GetModelsAsync()
        {
            using var conn = CreateConnection();
            string sql = "SELECT model_id as ModelId, kind, label, aspects, sizes, enabled FROM ai_studio_models ORDER BY model_id ASC;";
            return await conn.QueryAsync<AiModel>(sql);
        }

        public async Task<IEnumerable<PromptItem>> GetPromptsAsync()
        {
            using var conn = CreateConnection();
            string sql = @"
                SELECT task_type as TaskType, system_text as SystemText, role_text as RoleText,
                       negative_text as NegativeText, enabled, prompt_version as PromptVersion, updated_at as UpdatedAt
                FROM ai_studio_prompts;";
            return await conn.QueryAsync<PromptItem>(sql);
        }

        public async Task<Setting> GetSettingsAsync()
        {
            using var conn = CreateConnection();
            string sql = @"
                SELECT id, task_concurrency as TaskConcurrency, gemini_concurrency as GeminiConcurrency,
                       photos_per_task_max as PhotosPerTaskMax, cloudinary_enabled as CloudinaryEnabled,
                       cloudinary_cloud_name as CloudinaryCloudName, cloudinary_upload_preset as CloudinaryUploadPreset,
                       imgbb_enabled as ImgbbEnabled, max_attempts as MaxAttempts, retry_delay_sec as RetryDelaySec,
                       task_timeout_sec as TaskTimeoutSec, alert_queue_size as AlertQueueSize,
                       user_daily_task_limit as UserDailyTaskLimit, daily_gemini_budget as DailyGeminiBudget,
                       maintenance_on as MaintenanceOn, maintenance_message as MaintenanceMessage,
                       alert_email_enabled as AlertEmailEnabled, alert_admin_email as AlertAdminEmail,
                       alert_sender_email as AlertSenderEmail, alert_sender_name as AlertSenderName,
                       alert_cooldown_min as AlertCooldownMin, match_model as MatchModel,
                       match_threshold as MatchThreshold, match_retries as MatchRetries,
                       gemini_base as GeminiBase, imgbb_upload_url as ImgbbUploadUrl, stale_min as StaleMin,
                       image_max_side as ImageMaxSide, image_quality as ImageQuality, heartbeat_sec as HeartbeatSec,
                       fallback_sec as FallbackSec, worker_recycle_after_tasks as WorkerRecycleAfterTasks, updated_at as UpdatedAt
                FROM ai_studio_settings WHERE id = 1;";
            return await conn.QuerySingleAsync<Setting>(sql);
        }

        public async Task<Secret> GetSecretsAsync()
        {
            using var conn = CreateConnection();
            string sql = "SELECT id, imgbb_api_key as ImgbbApiKey, brevo_api_key as BrevoApiKey FROM ai_studio_secrets WHERE id = 1;";
            return await conn.QuerySingleAsync<Secret>(sql);
        }

        // Single Unified Query - 0 N+1 Extra Round Trips
        public async Task<IEnumerable<AppInfo>> GetAppsAsync()
        {
            using var conn = CreateConnection();
            string sql = @"
                SELECT a.app_id as AppId, a.label, a.enabled, a.sort, a.updated_at as UpdatedAt,
                       COALESCE((
                           SELECT STRING_AGG(m.task_type, ',')
                           FROM ai_studio_app_tasks m WITH (NOLOCK)
                           WHERE m.app_id = a.app_id
                       ), '') as TaskTypesCsv
                FROM ai_studio_apps a WITH (NOLOCK)
                ORDER BY a.sort ASC;";

            var rows = await conn.QueryAsync(sql);
            return rows.Select(r => new AppInfo
            {
                AppId = (string)r.AppId,
                Label = (string)r.label,
                Enabled = (bool)r.enabled,
                Sort = (int)r.sort,
                UpdatedAt = (DateTimeOffset)r.UpdatedAt,
                TaskTypes = string.IsNullOrEmpty((string)r.TaskTypesCsv) 
                    ? new List<string>() 
                    : ((string)r.TaskTypesCsv).Split(',').ToList()
            });
        }

        public async Task<IEnumerable<WorkerLoad>> GetWorkerLoadsAsync()
        {
            using var conn = CreateConnection();
            string sql = @"
                SELECT worker_id as WorkerId, last_seen as LastSeen, processing, done, paused, drain, pause_reason as PauseReason, task_limit as TaskLimit
                FROM ai_studio_worker_load
                ORDER BY worker_id ASC;";
            return await conn.QueryAsync<WorkerLoad>(sql);
        }

        public async Task<int> ReleaseStuckTasksAsync(string? workerId = null)
        {
            using var conn = CreateConnection();
            string sql = @"
                UPDATE ai_studio_tasks
                SET status = 'pending', worker_id = NULL, locked_at = NULL, updated_at = SYSDATETIMEOFFSET()
                WHERE status = 'processing' AND (@WorkerId IS NULL OR worker_id = @WorkerId);";
            return await conn.ExecuteAsync(sql, new { WorkerId = workerId });
        }

        public async Task<int> ClearFailedTasksAsync(string? workerId = null)
        {
            using var conn = CreateConnection();
            string sql = @"
                DELETE FROM ai_studio_tasks
                WHERE status = 'failed' AND (@WorkerId IS NULL OR worker_id = @WorkerId);";
            return await conn.ExecuteAsync(sql, new { WorkerId = workerId });
        }
    }
}
