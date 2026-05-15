using System.IO;
using System.Text.Json;

namespace Tico.App.Config;

public class AppSettings
{
    public string HotkeyCombo { get; set; } = "F8";
    public string TtsVoice { get; set; } = "RGymW84CSmfVugnA5tvA";
    public string ClaudeModel { get; set; } = "claude-sonnet-4-6";
    public bool StartWithWindows { get; set; } = true;
    public string ProxyBaseUrl { get; set; } = "http://localhost:3000";
    public string OmniParserUrl { get; set; } = "";
    public string OmniParserApiKey { get; set; } = "";
    public bool ChatHistoryEnabled { get; set; } = true;

    // Supabase project — anon key is public-by-design (embedded in every web client).
    public string SupabaseUrl { get; set; } = "https://tzpwebrpnqqygzpqxznb.supabase.co";
    public string SupabaseAnonKey { get; set; } = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6cHdlYnJwbnFxeWd6cHF4em5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDgyMDUsImV4cCI6MjA5MTI4NDIwNX0.R4g4NTGy-B22V6cl1D8853uL06GD_fXNRGjEekXqgL0";

    // Public web app — used for "create account" link in the login screen.
    public string WebBaseUrl { get; set; } = "https://tico.app";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public void SaveTo(string path)
    {
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);
        File.WriteAllText(path, JsonSerializer.Serialize(this, JsonOptions));
    }

    public static AppSettings LoadFrom(string path)
    {
        if (!File.Exists(path))
            return new AppSettings();
        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<AppSettings>(json, JsonOptions) ?? new AppSettings();
    }

    public static string DefaultPath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Tico", "settings.json");
}
