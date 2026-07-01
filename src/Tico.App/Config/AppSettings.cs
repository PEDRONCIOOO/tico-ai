using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Tico.App.Config;

public class AppSettings
{
    private const string HardcodedProxyBaseUrl = "https://api.ticoai.app";
    private const string HardcodedSupabaseUrl = "https://tzpwebrpnqqygzpqxznb.supabase.co";
    private const string HardcodedSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6cHdlYnJwbnFxeWd6cHF4em5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDgyMDUsImV4cCI6MjA5MTI4NDIwNX0.R4g4NTGy-B22V6cl1D8853uL06GD_fXNRGjEekXqgL0";
    private const string HardcodedWebBaseUrl = "https://ticoai.app";

    public string HotkeyCombo { get; set; } = "F8";
    public string TtsVoice { get; set; } = "RGymW84CSmfVugnA5tvA";
    public string ClaudeModel { get; set; } = "claude-sonnet-4-6";
    public bool StartWithWindows { get; set; } = true;
    [JsonIgnore] public string ProxyBaseUrl => HardcodedProxyBaseUrl;
    public string OmniParserUrl { get; set; } = "";
    public string OmniParserApiKey { get; set; } = "";
    public bool ChatHistoryEnabled { get; set; } = true;
    public string IconStyle { get; set; } = "default";

    // Supabase project — anon key is public-by-design (embedded in every web client).
    [JsonIgnore] public string SupabaseUrl => HardcodedSupabaseUrl;
    [JsonIgnore] public string SupabaseAnonKey => HardcodedSupabaseAnonKey;

    // Public web app — used for "create account" link in the login screen.
    [JsonIgnore] public string WebBaseUrl => HardcodedWebBaseUrl;

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
