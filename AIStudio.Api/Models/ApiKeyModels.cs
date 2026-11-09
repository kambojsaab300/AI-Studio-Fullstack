using System;

namespace AIStudio.Api.Models
{
    // Row returned to the Admin UI. Never contains the key or its hash.
    public class ApiKeyRecord
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Scope { get; set; } = "app";
        public string? AppId { get; set; }
        public string KeyPrefix { get; set; } = string.Empty;
        public bool Enabled { get; set; }
        public DateTimeOffset? ExpiresAt { get; set; }
        public DateTimeOffset? LastUsedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? RevokedAt { get; set; }
    }

    // Returned only once, from the create endpoint. `Key` is the plain key.
    public class ApiKeyCreated
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Scope { get; set; } = "app";
        public string? AppId { get; set; }
        public string KeyPrefix { get; set; } = string.Empty;
        public string Key { get; set; } = string.Empty;
        public DateTimeOffset? ExpiresAt { get; set; }
    }
}
