using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Tico.App.Services;

/// <summary>
/// Persists the Supabase Session encrypted with Windows DPAPI.
/// Default location: %APPDATA%\Tico\session.dat
/// </summary>
public class TokenStore
{
    private readonly string _path;

    public TokenStore(string? path = null)
    {
        _path = path ?? DefaultPath;
    }

    public static string DefaultPath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Tico", "session.dat");

    public void Save(Session session)
    {
        var json = JsonSerializer.Serialize(session);
        var plaintext = Encoding.UTF8.GetBytes(json);
        var encrypted = ProtectedData.Protect(plaintext, optionalEntropy: null, DataProtectionScope.CurrentUser);

        var dir = Path.GetDirectoryName(_path);
        if (!string.IsNullOrEmpty(dir))
            Directory.CreateDirectory(dir);

        File.WriteAllBytes(_path, encrypted);
    }

    public Session? Load()
    {
        if (!File.Exists(_path))
            return null;

        try
        {
            var encrypted = File.ReadAllBytes(_path);
            var plaintext = ProtectedData.Unprotect(encrypted, optionalEntropy: null, DataProtectionScope.CurrentUser);
            var json = Encoding.UTF8.GetString(plaintext);
            return JsonSerializer.Deserialize<Session>(json);
        }
        catch
        {
            // Corrupted, wrong user, or wrong machine — treat as no session.
            return null;
        }
    }

    public void Clear()
    {
        if (File.Exists(_path))
        {
            try { File.Delete(_path); } catch { }
        }
    }
}
