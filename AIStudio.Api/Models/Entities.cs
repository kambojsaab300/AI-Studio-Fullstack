using System;
using System.Collections.Generic;

namespace AIStudio.Api.Models
{
    public class User
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string Role { get; set; } = "customer"; // "admin" or "customer"
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    public class TaskItem
    {
        public long Id { get; set; }
        public string TaskType { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string? Prompt { get; set; }
        public string? SystemText { get; set; }
        public string? AspectRatio { get; set; }
        public string? ImageSize { get; set; }
        public string? FaceImageUrl { get; set; }
        public string? StyleImageUrl { get; set; }
        public string? InputImageUrl { get; set; }
        public string? ExtraImageUrls { get; set; } // JSON array
        public string? ConversationId { get; set; }
        public string? OutputText { get; set; }
        public string? OutputImageUrl { get; set; }
        public string? OutputImageUrls { get; set; } // JSON array
        public string? ImgbbImageUrls { get; set; }  // JSON array
        public decimal? FaceMatchScore { get; set; }
        public string UserId { get; set; } = "weargen_user_1";
        public int BatchCount { get; set; } = 1;
        public string Status { get; set; } = "pending";
        public string? Error { get; set; }
        public string? WorkerId { get; set; }
        public string Tool { get; set; } = "image";
        public string AppId { get; set; } = "weargen";
        public int Attempts { get; set; } = 0;
        public int Priority { get; set; } = 0;
        public string? FamilyRoleKeys { get; set; } // JSON array
        public DateTimeOffset? LockedAt { get; set; }
        public DateTimeOffset? NextRunAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset? FinishedAt { get; set; }
        public int? DurationMs { get; set; }
        public int? ProcessMs { get; set; }
    }

    public class Worker
    {
        public string WorkerId { get; set; } = string.Empty;
        public DateTimeOffset LastSeen { get; set; } = DateTimeOffset.UtcNow;
        public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
        public bool Paused { get; set; } = false;
        public string? PauseReason { get; set; }
        public bool Drain { get; set; } = false;
        public int? TaskLimit { get; set; }
        public string Tools { get; set; } = "[\"chat\",\"image\"]";
        public string? TaskTypes { get; set; }
    }

    public class WorkerLoad
    {
        public string WorkerId { get; set; } = string.Empty;
        public DateTimeOffset LastSeen { get; set; }
        public int Processing { get; set; }
        public int Done { get; set; }
        public bool Paused { get; set; }
        public bool Drain { get; set; }
        public string? PauseReason { get; set; }
        public int? TaskLimit { get; set; }
    }

    public class Setting
    {
        public int Id { get; set; } = 1;
        public int TaskConcurrency { get; set; } = 20;
        public int GeminiConcurrency { get; set; } = 8;
        public int PhotosPerTaskMax { get; set; } = 10;
        public bool CloudinaryEnabled { get; set; } = true;
        public string CloudinaryCloudName { get; set; } = "draaqjcre";
        public string CloudinaryUploadPreset { get; set; } = "ml_default";
        public bool ImgbbEnabled { get; set; } = false;
        public int MaxAttempts { get; set; } = 3;
        public int RetryDelaySec { get; set; } = 30;
        public int TaskTimeoutSec { get; set; } = 300;
        public int AlertQueueSize { get; set; } = 50;
        public int UserDailyTaskLimit { get; set; } = 0;
        public int DailyGeminiBudget { get; set; } = 0;
        public bool MaintenanceOn { get; set; } = false;
        public string MaintenanceMessage { get; set; } = "System abhi maintenance mein hai. Thodi der baad try karo.";
        public bool AlertEmailEnabled { get; set; } = false;
        public string AlertAdminEmail { get; set; } = string.Empty;
        public string AlertSenderEmail { get; set; } = string.Empty;
        public string AlertSenderName { get; set; } = "AI Studio";
        public int AlertCooldownMin { get; set; } = 15;
        public string MatchModel { get; set; } = "gemini-3-flash-preview";
        public int MatchThreshold { get; set; } = 70;
        public int MatchRetries { get; set; } = 2;
        public string GeminiBase { get; set; } = "https://generativelanguage.googleapis.com/v1beta/models";
        public string ImgbbUploadUrl { get; set; } = "https://api.imgbb.com/1/upload";
        public int StaleMin { get; set; } = 10;
        public int ImageMaxSide { get; set; } = 2048;
        public decimal ImageQuality { get; set; } = 0.85m;
        public int HeartbeatSec { get; set; } = 30;
        public int FallbackSec { get; set; } = 600;
        public int WorkerRecycleAfterTasks { get; set; } = 50;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    public class Secret
    {
        public int Id { get; set; } = 1;
        public string? ImgbbApiKey { get; set; }
        public string? BrevoApiKey { get; set; }
    }

    public class AiModel
    {
        public string ModelId { get; set; } = string.Empty;
        public string Kind { get; set; } = "image";
        public string Label { get; set; } = string.Empty;
        public string Aspects { get; set; } = "[]";
        public string Sizes { get; set; } = "[]";
        public bool Enabled { get; set; } = true;
    }

    public class PromptItem
    {
        public string TaskType { get; set; } = string.Empty;
        public string SystemText { get; set; } = string.Empty;
        public string RoleText { get; set; } = string.Empty;
        public string NegativeText { get; set; } = string.Empty;
        public bool Enabled { get; set; } = true;
        public int PromptVersion { get; set; } = 1;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    public class CatalogItem
    {
        public string TaskType { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string? CustomerLabel { get; set; }
        public string? Hint { get; set; }
        public string Output { get; set; } = "image";
        public string Inputs { get; set; } = "[]";
        public string Optional { get; set; } = "[]";
        public string Labels { get; set; } = "{}";
        public string? CustomerLabels { get; set; }
        public bool Extras { get; set; } = false;
        public bool PromptRequired { get; set; } = false;
        public bool FaceCheck { get; set; } = false;
        public bool Edit { get; set; } = false;
        public bool Transparent { get; set; } = false;
        public string? Angles { get; set; }
        public bool Family { get; set; } = false;
        public bool PerPhoto { get; set; } = false;
        public bool CustomerVisible { get; set; } = false;
        public bool Enabled { get; set; } = true;
        public int Sort { get; set; } = 0;
        public string Tool { get; set; } = "image";
        public string? AppsCsv { get; set; }
        public List<string> Apps { get; set; } = new();
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    public class FamilyRole
    {
        public string RoleKey { get; set; } = string.Empty;
        public string LabelAdmin { get; set; } = string.Empty;
        public string LabelCustomer { get; set; } = string.Empty;
        public string PromptText { get; set; } = string.Empty;
        public int SortOrder { get; set; } = 0;
        public bool Enabled { get; set; } = true;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    public class AppInfo
    {
        public string AppId { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public bool Enabled { get; set; } = true;
        public int Sort { get; set; } = 0;
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
        public List<string> TaskTypes { get; set; } = new();
    }

    public class AppUsageDayRow
    {
        public string Day { get; set; } = string.Empty;
        public string AppId { get; set; } = string.Empty;
        public long Tasks { get; set; }
        public long Done { get; set; }
        public long Failed { get; set; }
        public long Photos { get; set; }
    }

    public class AppUsageToolRow
    {
        public string AppId { get; set; } = string.Empty;
        public string TaskType { get; set; } = string.Empty;
        public long Tasks { get; set; }
        public long Failed { get; set; }
    }
}
