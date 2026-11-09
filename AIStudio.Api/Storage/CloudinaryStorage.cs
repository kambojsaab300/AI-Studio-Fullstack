using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace AIStudio.Api.Storage;

/// <summary>
/// NuGet: CloudinaryDotNet. API secret sirf server env me (Cloudinary__ApiSecret).
/// - Upload hamesha server se, SIGNED, type = "authenticated" (unsigned preset band karo).
/// - Delivery: Cloudinary ke signed URLs free / normal plans pe expire NAHI hote, isliye
///   user ko Cloudinary URL dene ki jagah API image stream karta hai (owner check ke baad).
///   (Expire hone wale token URLs Cloudinary ke Advanced plan me milte hain.)
/// </summary>
public sealed class CloudinaryStorage
{
    private readonly Cloudinary _c;
    private readonly IHttpClientFactory _http;
    public string CloudName { get; }

    public CloudinaryStorage(IConfiguration cfg, IHttpClientFactory http)
    {
        CloudName = cfg["Cloudinary:CloudName"] ?? "draaqjcre";
        var key = cfg["Cloudinary:ApiKey"] ?? "placeholder_key";
        var secret = cfg["Cloudinary:ApiSecret"] ?? "placeholder_secret";
        _c = new Cloudinary(new Account(CloudName, key, secret));
        _c.Api.Secure = true;
        _http = http;
    }

    /// <summary>SQL ke sp_worker_complete @allowed_prefix ke liye.</summary>
    public string OutputPrefix => $"https://res.cloudinary.com/{CloudName}/image/authenticated/aistudio/";

    public async Task<UploadedImage> UploadAsync(byte[] bytes, string appId, string kind, CancellationToken ct)
    {
        // Folder me koi PII nahi: app / kind / yyyy / mm / random
        var now = DateTime.UtcNow;
        var folder = $"aistudio/{Safe(appId)}/{kind}/{now:yyyy}/{now:MM}";
        using var ms = new MemoryStream(bytes);
        var p = new ImageUploadParams
        {
            File = new FileDescription("img", ms),
            Folder = folder,
            PublicId = Guid.NewGuid().ToString("N"),
            Type = "authenticated",
            Overwrite = false,
            UseFilename = false,
            UniqueFilename = false,
            AllowedFormats = new[] { "jpg", "png", "webp" }
        };
        var r = await _c.UploadAsync(p, ct);
        if (r.Error is not null) throw new InvalidOperationException("Upload failed: " + r.Error.Message);

        var canonical = $"https://res.cloudinary.com/{CloudName}/image/authenticated/{r.PublicId}.{r.Format}";
        return new UploadedImage(r.PublicId, r.Format, (int)r.Bytes, r.Width, r.Height, canonical);
    }

    /// <summary>Server-side signed URL (kabhi client ko mat do). Isse API image stream karta hai.</summary>
    private string SignedUrl(string publicIdWithFormat)
        => _c.Api.UrlImgUp.Secure(true).Signed(true).Type("authenticated").BuildUrl(publicIdWithFormat);

    /// <summary>Canonical stored ref (https://res.cloudinary.com/{cloud}/image/authenticated/{pid}.{fmt}) se stream.</summary>
    public async Task<Stream?> OpenReadByCanonicalAsync(string canonical, CancellationToken ct)
    {
        var prefix = $"https://res.cloudinary.com/{CloudName}/image/authenticated/";
        if (!canonical.StartsWith(prefix, StringComparison.Ordinal) || canonical.Contains("..")) return null;
        return await OpenAsync(SignedUrl(canonical[prefix.Length..]), ct);
    }

    /// <summary>Asset table ka public_id (format ke bina) se stream.</summary>
    public async Task<Stream?> OpenReadByPublicIdAsync(string publicId, string contentType, CancellationToken ct)
    {
        var ext = contentType switch { "image/png" => "png", "image/webp" => "webp", _ => "jpg" };
        return await OpenAsync(SignedUrl($"{publicId}.{ext}"), ct);
    }

    private async Task<Stream?> OpenAsync(string url, CancellationToken ct)
    {
        var resp = await _http.CreateClient("cloudinary-read").GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!resp.IsSuccessStatusCode) { resp.Dispose(); return null; }
        return await resp.Content.ReadAsStreamAsync(ct);
    }

    public async Task DeleteAsync(string publicId, CancellationToken ct)
    {
        var r = await _c.DestroyAsync(new DeletionParams(publicId) { Type = "authenticated", Invalidate = true });
        if (r.Error is not null) throw new InvalidOperationException("Delete failed: " + r.Error.Message);
    }

    private static string Safe(string s) => new(s.Where(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_').Take(40).ToArray());
}

public sealed record UploadedImage(string PublicId, string Format, int Bytes, int Width, int Height, string CanonicalUrl);
