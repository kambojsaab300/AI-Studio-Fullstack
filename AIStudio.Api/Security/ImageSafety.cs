using System.Net;
using System.Net.Sockets;

namespace AIStudio.Api.Security;

/// <summary>File ke pehle bytes se asli type pehchano. Extension / Content-Type header pe bharosa nahi.</summary>
public static class ImageSniffer
{
    public const int MaxBytes = 10 * 1024 * 1024;

    public static string? DetectContentType(ReadOnlySpan<byte> b)
    {
        if (b.Length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return "image/jpeg";
        if (b.Length >= 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47
            && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return "image/png";
        if (b.Length >= 12 && b[0] == (byte)'R' && b[1] == (byte)'I' && b[2] == (byte)'F' && b[3] == (byte)'F'
            && b[8] == (byte)'W' && b[9] == (byte)'E' && b[10] == (byte)'B' && b[11] == (byte)'P') return "image/webp";
        return null;   // SVG, GIF, HTML, EXE... sab reject
    }
}

/// <summary>
/// H1 SSRF guard. Sirf legacy tasks ke URL ke liye (naye tasks me asset id aata hai).
/// Sirf https://res.cloudinary.com/{cloud}/image/..., private / localhost IPs block, redirect band, size limit.
/// </summary>
public sealed class ImageUrlGuard(IHttpClientFactory httpFactory, IConfiguration cfg)
{
    public const string HttpClientName = "image-guard";   // Program.cs me AllowAutoRedirect = false ke saath register
    private const long MaxDownload = 15 * 1024 * 1024;

    private readonly string _cloud = cfg["Cloudinary:CloudName"] ?? "draaqjcre";

    public bool IsAllowed(string? url, out Uri? uri)
    {
        uri = null;
        if (string.IsNullOrWhiteSpace(url) || url.Length > 1000) return false;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var u)) return false;
        if (u.Scheme != Uri.UriSchemeHttps || !u.IsDefaultPort) return false;
        if (!string.Equals(u.Host, "res.cloudinary.com", StringComparison.OrdinalIgnoreCase)) return false;
        if (!u.AbsolutePath.StartsWith($"/{_cloud}/image/", StringComparison.Ordinal)) return false;
        if (u.AbsolutePath.Contains("..") || !string.IsNullOrEmpty(u.UserInfo)) return false;
        uri = u;
        return true;
    }

    public async Task<(byte[] Bytes, string ContentType)?> DownloadAsync(string url, CancellationToken ct)
    {
        if (!IsAllowed(url, out var uri) || uri is null) return null;

        // DNS rebinding se bachne ke liye resolve karke private range check
        foreach (var ip in await Dns.GetHostAddressesAsync(uri.Host, ct))
            if (IsPrivate(ip)) return null;

        var http = httpFactory.CreateClient(HttpClientName);
        using var resp = await http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!resp.IsSuccessStatusCode) return null;
        if (resp.Content.Headers.ContentLength is > MaxDownload) return null;

        await using var stream = await resp.Content.ReadAsStreamAsync(ct);
        using var ms = new MemoryStream();
        var buffer = new byte[81920];
        int read;
        while ((read = await stream.ReadAsync(buffer, ct)) > 0)
        {
            ms.Write(buffer, 0, read);
            if (ms.Length > MaxDownload) return null;
        }
        var bytes = ms.ToArray();
        var type = ImageSniffer.DetectContentType(bytes);
        return type is null ? null : (bytes, type);
    }

    public static bool IsPrivate(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip)) return true;
        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            return ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6UniqueLocal
                   || (ip.IsIPv4MappedToIPv6 && IsPrivate(ip.MapToIPv4()));
        var b = ip.GetAddressBytes();
        return b[0] == 10 || b[0] == 127 || b[0] == 0
               || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
               || (b[0] == 192 && b[1] == 168)
               || (b[0] == 169 && b[1] == 254)       // cloud metadata
               || (b[0] == 100 && b[1] >= 64 && b[1] <= 127);
    }
}
