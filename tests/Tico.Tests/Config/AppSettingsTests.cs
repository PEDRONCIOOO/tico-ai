using Tico.App.Config;

namespace Tico.Tests.Config;

public class AppSettingsTests
{
    private readonly string _testDir;

    public AppSettingsTests()
    {
        _testDir = Path.Combine(Path.GetTempPath(), $"tico_test_{Guid.NewGuid()}");
        Directory.CreateDirectory(_testDir);
    }

    [Fact]
    public void Defaults_are_set_correctly()
    {
        var settings = new AppSettings();
        Assert.Equal("F8", settings.HotkeyCombo);
        Assert.Equal("RGymW84CSmfVugnA5tvA", settings.TtsVoice);
        Assert.Equal("claude-sonnet-4-6", settings.ClaudeModel);
        Assert.True(settings.StartWithWindows);
    }

    [Fact]
    public void Save_and_load_roundtrip()
    {
        var path = Path.Combine(_testDir, "settings.json");
        var settings = new AppSettings { HotkeyCombo = "Alt+Z", TtsVoice = "pt-BR-AntonioNeural" };
        settings.SaveTo(path);
        var loaded = AppSettings.LoadFrom(path);
        Assert.Equal("Alt+Z", loaded.HotkeyCombo);
        Assert.Equal("pt-BR-AntonioNeural", loaded.TtsVoice);
    }

    [Fact]
    public void LoadFrom_missing_file_returns_defaults()
    {
        var loaded = AppSettings.LoadFrom(Path.Combine(_testDir, "nonexistent.json"));
        Assert.Equal("F8", loaded.HotkeyCombo);
    }

    [Fact]
    public void ProxyBaseUrl_has_sensible_default()
    {
        var settings = new AppSettings();
        Assert.False(string.IsNullOrEmpty(settings.ProxyBaseUrl));
    }

    [Fact]
    public void Supabase_defaults_are_set()
    {
        var settings = new AppSettings();
        Assert.StartsWith("https://", settings.SupabaseUrl);
        Assert.False(string.IsNullOrEmpty(settings.SupabaseAnonKey));
    }
}
