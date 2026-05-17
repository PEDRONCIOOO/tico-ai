using System.Diagnostics;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;

namespace Tico.App.Services;

public static class UpdateChecker
{
    private const string VersionUrl = "https://dl.ticoai.app/version.json";

    private static readonly HashSet<string> AllowedHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "dl.ticoai.app", "ticoai.app", "github.com", "www.github.com"
    };

    private static bool IsUrlAllowed(string url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
               && uri.Scheme == "https"
               && AllowedHosts.Contains(uri.Host);
    }

    public static async Task<UpdateInfo?> CheckAsync(HttpClient http)
    {
        try
        {
            var json = await http.GetStringAsync(VersionUrl);
            var remote = JsonSerializer.Deserialize<VersionPayload>(json);
            if (remote?.version == null || remote.url == null) return null;
            if (!IsUrlAllowed(remote.url)) return null;

            var current = Assembly.GetExecutingAssembly().GetName().Version;
            if (current == null) return null;

            var latest = Version.Parse(remote.version);
            if (latest > current)
                return new UpdateInfo(remote.version, remote.url);

            return null;
        }
        catch
        {
            return null;
        }
    }

    public static void OpenDownloadPage(string url)
    {
        if (!IsUrlAllowed(url)) return;
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    public record UpdateInfo(string Version, string Url);

    private record VersionPayload(string? version, string? url);
}
