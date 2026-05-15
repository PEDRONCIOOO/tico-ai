using System.Diagnostics;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;

namespace Tico.App.Services;

public static class UpdateChecker
{
    private const string VersionUrl = "https://dl.ticoai.app/version.json";

    public static async Task<UpdateInfo?> CheckAsync(HttpClient http)
    {
        try
        {
            var json = await http.GetStringAsync(VersionUrl);
            var remote = JsonSerializer.Deserialize<VersionPayload>(json);
            if (remote?.version == null || remote.url == null) return null;

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
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    public record UpdateInfo(string Version, string Url);

    private record VersionPayload(string? version, string? url);
}
