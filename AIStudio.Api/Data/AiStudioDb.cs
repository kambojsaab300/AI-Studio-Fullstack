using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;

namespace AIStudio.Api.Data;

/// <summary>
/// Sirf stored procedures (06_security_hardening.sql). Koi dynamic table / column naam URL se nahi.
/// Dapper + ADO.NET, jaisa aapka existing DatabaseService.
/// </summary>
public sealed class AiStudioDb
{
    private readonly string _cs;

    static AiStudioDb() => DefaultTypeMap.MatchNamesWithUnderscores = true;

    public AiStudioDb(IConfiguration cfg)
        => _cs = cfg.GetConnectionString("AiStudio") ?? cfg.GetConnectionString("DefaultConnection") ?? throw new InvalidOperationException("ConnectionStrings:AiStudio missing");

    private SqlConnection Open() => new(_cs);

    // ---------------- Auth lookups ----------------

    public async Task<ApiKeyRow?> LookupApiKeyAsync(string keyHashHex, string ip)
    {
        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<ApiKeyRow>("sp_api_key_lookup",
            new { key_hash = keyHashHex, ip }, commandType: CommandType.StoredProcedure);
    }

    public async Task<string?> AuthWorkerAsync(string tokenHashHex, string ip)
    {
        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<string>("sp_worker_auth",
            new { token_hash = tokenHashHex, ip }, commandType: CommandType.StoredProcedure);
    }

    public async Task<bool> IsAdminAsync(string userId)
    {
        await using var c = Open();
        var p = new DynamicParameters(new { user_id = userId });
        p.Add("@is_admin", dbType: DbType.Boolean, direction: ParameterDirection.Output);
        p.Add("@mfa_enabled", dbType: DbType.Boolean, direction: ParameterDirection.Output);
        await c.ExecuteAsync("sp_auth_is_admin", p, commandType: CommandType.StoredProcedure);
        return p.Get<bool>("@is_admin") && p.Get<bool>("@mfa_enabled");
    }

    public async Task RiskFlagAsync(string flagType, string? appId = null, string? userId = null,
        string? workerId = null, string? detail = null, string? ip = null)
    {
        try
        {
            await using var c = Open();
            await c.ExecuteAsync("sp_risk_flag",
                new { flag_type = flagType, app_id = appId, user_id = userId, worker_id = workerId, detail, ip },
                commandType: CommandType.StoredProcedure);
        }
        catch { }
    }

    public async Task AuditAsync(string actor, string action, string? target, string? ip, string? oldValue = null, string? newValue = null)
    {
        try
        {
            await using var c = Open();
            await c.ExecuteAsync("sp_audit",
                new { actor, action, target, ip, old_value = oldValue, new_value = newValue },
                commandType: CommandType.StoredProcedure);
        }
        catch { }
    }

    // ---------------- Assets ----------------

    public async Task<Guid> CreateAssetAsync(string appId, string userId, string kind, string publicId,
        string contentType, int sizeBytes, int? width, int? height, int retentionDays)
    {
        await using var c = Open();
        var p = new DynamicParameters(new
        {
            app_id = appId, user_id = userId, kind, public_id = publicId, content_type = contentType,
            size_bytes = sizeBytes, width, height, retention_days = retentionDays
        });
        p.Add("@asset_id", dbType: DbType.Guid, direction: ParameterDirection.Output);
        await c.ExecuteAsync("sp_asset_create", p, commandType: CommandType.StoredProcedure);
        return p.Get<Guid>("@asset_id");
    }

    // ---------------- Customer / tenant tasks ----------------

    public async Task<(int Code, Guid? PublicId)> CreateTaskAsync(CreateTaskArgs a)
    {
        await using var c = Open();
        var p = new DynamicParameters(new
        {
            app_id = a.AppId, user_id = a.UserId, source = a.Source, task_type = a.TaskType, model = a.Model,
            aspect_ratio = a.AspectRatio, image_size = a.ImageSize, batch_count = a.BatchCount, prompt = a.Prompt,
            input_asset_id = a.InputAssetId, face_asset_id = a.FaceAssetId, style_asset_id = a.StyleAssetId,
            extra_asset_ids = a.ExtraAssetIdsJson, family_role_keys = a.FamilyRoleKeysJson,
            idempotency_key = a.IdempotencyKey
        });
        p.Add("@result_code", dbType: DbType.Int32, direction: ParameterDirection.Output);
        p.Add("@public_id", dbType: DbType.Guid, direction: ParameterDirection.Output);
        await c.ExecuteAsync("sp_customer_create_task", p, commandType: CommandType.StoredProcedure);
        return (p.Get<int>("@result_code"), p.Get<Guid?>("@public_id"));
    }

    public async Task<TaskView?> GetTaskAsync(string appId, string userId, Guid publicId)
    {
        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<TaskView>("sp_customer_get_task",
            new { app_id = appId, user_id = userId, public_id = publicId }, commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<TaskListItem>> ListTasksAsync(string appId, string userId, DateTimeOffset? before, int limit)
    {
        await using var c = Open();
        return await c.QueryAsync<TaskListItem>("sp_customer_list_tasks",
            new { app_id = appId, user_id = userId, before, limit }, commandType: CommandType.StoredProcedure);
    }

    public async Task<int> CancelTaskAsync(string appId, string userId, Guid publicId)
        => await CodeOnlyAsync("sp_customer_cancel_task", new { app_id = appId, user_id = userId, public_id = publicId });

    public async Task<int> DeleteTaskAsync(string appId, string userId, Guid publicId)
        => await CodeOnlyAsync("sp_customer_delete_task", new { app_id = appId, user_id = userId, public_id = publicId });

    public async Task<string?> GetTaskOutputRefAsync(string appId, string userId, Guid publicId, int index)
    {
        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<string>("sp_customer_task_output",
            new { app_id = appId, user_id = userId, task_public_id = publicId, index }, commandType: CommandType.StoredProcedure);
    }

    private async Task<int> CodeOnlyAsync(string sp, object args)
    {
        await using var c = Open();
        var p = new DynamicParameters(args);
        p.Add("@result_code", dbType: DbType.Int32, direction: ParameterDirection.Output);
        await c.ExecuteAsync(sp, p, commandType: CommandType.StoredProcedure);
        return p.Get<int>("@result_code");
    }

    // ---------------- Worker ----------------

    public async Task<(bool Paused, bool Drain, bool Blocked)> HeartbeatAsync(string workerId, string ip)
    {
        await using var c = Open();
        var p = new DynamicParameters(new { worker_id = workerId, ip });
        p.Add("@paused", dbType: DbType.Boolean, direction: ParameterDirection.Output);
        p.Add("@drain", dbType: DbType.Boolean, direction: ParameterDirection.Output);
        p.Add("@blocked", dbType: DbType.Boolean, direction: ParameterDirection.Output);
        await c.ExecuteAsync("sp_worker_heartbeat", p, commandType: CommandType.StoredProcedure);
        return (p.Get<bool?>("@paused") ?? true, p.Get<bool?>("@drain") ?? false, p.Get<bool?>("@blocked") ?? true);
    }

    public async Task<(int Code, ClaimedTask? Task)> ClaimNextAsync(string workerId, string ip, int leaseSeconds)
    {
        await using var c = Open();
        var p = new DynamicParameters(new { worker_id = workerId, ip, lease_seconds = leaseSeconds });
        p.Add("@result_code", dbType: DbType.Int32, direction: ParameterDirection.Output);
        var rows = await c.QueryAsync<ClaimedTask>("sp_worker_claim_next", p, commandType: CommandType.StoredProcedure);
        return (p.Get<int>("@result_code"), rows.FirstOrDefault());
    }

    public async Task<AssetRef?> GetWorkerTaskAssetAsync(string workerId, Guid taskPublicId, Guid leaseId, string role, int extraIndex)
    {
        await using var c = Open();
        return await c.QueryFirstOrDefaultAsync<AssetRef>("sp_worker_task_asset",
            new { worker_id = workerId, task_public_id = taskPublicId, lease_id = leaseId, role, extra_index = extraIndex },
            commandType: CommandType.StoredProcedure);
    }

    public async Task<CompleteResult> CompleteAsync(CompleteArgs a)
    {
        await using var c = Open();
        var p = new DynamicParameters(new
        {
            worker_id = a.WorkerId, public_id = a.PublicId, lease_id = a.LeaseId, success = a.Success,
            retryable = a.Retryable, output_urls = a.OutputUrlsJson, output_text = a.OutputText,
            error_code = a.ErrorCode, error_detail = a.ErrorDetail, process_ms = a.ProcessMs,
            face_match_score = a.FaceMatchScore, allowed_prefix = a.AllowedPrefix
        });
        p.Add("@result_code", dbType: DbType.Int32, direction: ParameterDirection.Output);
        p.Add("@app_id", dbType: DbType.String, size: 100, direction: ParameterDirection.Output);
        p.Add("@user_id", dbType: DbType.String, size: 100, direction: ParameterDirection.Output);
        p.Add("@final_status", dbType: DbType.AnsiString, size: 20, direction: ParameterDirection.Output);
        await c.ExecuteAsync("sp_worker_complete", p, commandType: CommandType.StoredProcedure);
        return new CompleteResult(p.Get<int>("@result_code"), p.Get<string?>("@app_id"),
            p.Get<string?>("@user_id"), p.Get<string?>("@final_status"));
    }

    public async Task<IEnumerable<RequeuedTask>> RequeueExpiredLeasesAsync()
    {
        await using var c = Open();
        return await c.QueryAsync<RequeuedTask>("sp_requeue_expired_leases", commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<AssetToDelete>> AssetsDueForDeletionAsync(int limit)
    {
        await using var c = Open();
        return await c.QueryAsync<AssetToDelete>("sp_assets_due_for_deletion", new { limit }, commandType: CommandType.StoredProcedure);
    }

    public async Task MarkAssetDeletedAsync(Guid assetId)
    {
        await using var c = Open();
        await c.ExecuteAsync("sp_asset_mark_deleted", new { asset_id = assetId }, commandType: CommandType.StoredProcedure);
    }
}

// ---------------- DTOs ----------------

public sealed class ApiKeyRow { public int KeyId { get; set; } public string? AppId { get; set; } public string Scope { get; set; } = ""; public int RateLimitPerMin { get; set; } }

public sealed record CreateTaskArgs(string AppId, string UserId, string Source, string TaskType, string Model,
    string? AspectRatio, string? ImageSize, int BatchCount, string? Prompt, Guid? InputAssetId, Guid? FaceAssetId,
    Guid? StyleAssetId, string? ExtraAssetIdsJson, string? FamilyRoleKeysJson, string IdempotencyKey);

public sealed class TaskView
{
    public Guid PublicId { get; set; } public string TaskType { get; set; } = ""; public string Model { get; set; } = "";
    public string? AspectRatio { get; set; } public string? ImageSize { get; set; } public int BatchCount { get; set; }
    public string Status { get; set; } = ""; public string? OutputImageUrl { get; set; } public string? OutputImageUrls { get; set; }
    public string? OutputText { get; set; } public decimal? FaceMatchScore { get; set; } public string? ErrorCode { get; set; }
    public DateTimeOffset CreatedAt { get; set; } public DateTimeOffset? FinishedAt { get; set; }
}

public sealed class TaskListItem
{
    public Guid PublicId { get; set; } public string TaskType { get; set; } = ""; public string Status { get; set; } = "";
    public string? OutputImageUrl { get; set; } public string? ErrorCode { get; set; }
    public DateTimeOffset CreatedAt { get; set; } public DateTimeOffset? FinishedAt { get; set; }
}

public sealed class ClaimedTask
{
    public Guid PublicId { get; set; } public Guid LeaseId { get; set; } public DateTimeOffset LeaseExpiresAt { get; set; }
    public string TaskType { get; set; } = ""; public string Model { get; set; } = ""; public string? Prompt { get; set; }
    public string? AspectRatio { get; set; } public string? ImageSize { get; set; } public int BatchCount { get; set; }
    public string? FamilyRoleKeys { get; set; } public int Attempts { get; set; }
    public bool? FaceCheck { get; set; } public bool? Edit { get; set; } public bool? Transparent { get; set; }
    public string? SystemText { get; set; } public string? RoleText { get; set; } public string? NegativeText { get; set; }
    public int? PromptVersion { get; set; }
    public string? InputPublicId { get; set; } public string? FacePublicId { get; set; } public string? StylePublicId { get; set; }
    public string? ExtraPublicIds { get; set; }
    // legacy tasks (purane URL wale) - worker ImageUrlGuard se hi fetch kare
    public string? InputImageUrl { get; set; } public string? FaceImageUrl { get; set; }
    public string? StyleImageUrl { get; set; } public string? ExtraImageUrls { get; set; }
}

public sealed class AssetRef { public string Storage { get; set; } = ""; public string PublicId { get; set; } = ""; public string ContentType { get; set; } = ""; }

public sealed record CompleteArgs(string WorkerId, Guid PublicId, Guid LeaseId, bool Success, bool Retryable,
    string? OutputUrlsJson, string? OutputText, string? ErrorCode, string? ErrorDetail, int? ProcessMs,
    decimal? FaceMatchScore, string AllowedPrefix);

public sealed record CompleteResult(int Code, string? AppId, string? UserId, string? FinalStatus);

public sealed class RequeuedTask { public Guid PublicId { get; set; } public string AppId { get; set; } = ""; public string UserId { get; set; } = ""; public string NewStatus { get; set; } = ""; }

public sealed class AssetToDelete { public Guid AssetId { get; set; } public string Storage { get; set; } = ""; public string PublicId { get; set; } = ""; public string DeliveryType { get; set; } = ""; }
