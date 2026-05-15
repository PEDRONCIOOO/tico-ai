using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Tico.App.Config;

namespace Tico.App.Services;

public class AuthService : IAuthService
{
    private readonly HttpClient _http;
    private readonly AppSettings _settings;

    public AuthService(HttpClient http, AppSettings settings)
    {
        _http = http;
        _settings = settings;
    }

    public async Task<Session> LoginAsync(string email, string password, CancellationToken ct = default)
    {
        var body = JsonSerializer.Serialize(new { email, password });
        var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_settings.SupabaseUrl}/auth/v1/token?grant_type=password")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("apikey", _settings.SupabaseAnonKey);

        var response = await _http.SendAsync(request, ct);
        var responseText = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new AuthException(ParseError(responseText) ?? $"Login falhou ({(int)response.StatusCode})");

        return ParseSession(responseText);
    }

    public async Task<Session> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var body = JsonSerializer.Serialize(new { refresh_token = refreshToken });
        var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_settings.SupabaseUrl}/auth/v1/token?grant_type=refresh_token")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        request.Headers.Add("apikey", _settings.SupabaseAnonKey);

        var response = await _http.SendAsync(request, ct);
        var responseText = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
            throw new AuthException(ParseError(responseText) ?? $"Refresh falhou ({(int)response.StatusCode})");

        return ParseSession(responseText);
    }

    // ─── Static helpers (pure logic, easily testable) ────────────────

    /// <summary>
    /// Parse a Supabase auth token response into a Session.
    /// Expected fields: access_token, refresh_token, expires_at (unix seconds),
    /// user.id, user.email.
    /// </summary>
    public static Session ParseSession(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var accessToken = root.GetProperty("access_token").GetString()
            ?? throw new AuthException("Resposta sem access_token");
        var refreshToken = root.GetProperty("refresh_token").GetString()
            ?? throw new AuthException("Resposta sem refresh_token");
        var expiresAt = root.GetProperty("expires_at").GetInt64();
        var user = root.GetProperty("user");
        var userId = user.GetProperty("id").GetString()
            ?? throw new AuthException("Resposta sem user.id");
        var email = user.GetProperty("email").GetString() ?? "";

        return new Session(
            accessToken,
            refreshToken,
            DateTimeOffset.FromUnixTimeSeconds(expiresAt).UtcDateTime,
            userId,
            email);
    }

    /// <summary>
    /// Parse the check_usage RPC response.
    /// </summary>
    public static UsageInfo ParseUsage(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        return new UsageInfo(
            root.GetProperty("tier").GetString() ?? "free",
            root.GetProperty("used").GetInt32(),
            root.GetProperty("limit").GetInt32(),
            root.GetProperty("remaining").GetInt32(),
            root.GetProperty("allowed").GetBoolean());
    }

    /// <summary>
    /// True if the session has expired or will expire within the skew window.
    /// Used to proactively refresh before making authenticated calls.
    /// </summary>
    public static bool IsExpired(DateTime expiresAtUtc, DateTime nowUtc, int skewSeconds = 30)
    {
        return expiresAtUtc <= nowUtc.AddSeconds(skewSeconds);
    }

    /// <summary>
    /// Extract a human-readable error message from a Supabase error response.
    /// Supabase returns either {error, error_description} or {code, msg} depending on endpoint.
    /// </summary>
    public static string? ParseError(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("error_description", out var desc))
                return TranslateError(desc.GetString());
            if (root.TryGetProperty("msg", out var msg))
                return TranslateError(msg.GetString());
            if (root.TryGetProperty("error", out var err))
                return TranslateError(err.GetString());
            return null;
        }
        catch
        {
            return null;
        }
    }

    private static string? TranslateError(string? msg)
    {
        if (msg == null) return null;
        return msg switch
        {
            "Invalid login credentials" => "email ou senha incorretos",
            "Email not confirmed" => "confirme seu email antes de entrar",
            _ => msg
        };
    }
}

public class AuthException : Exception
{
    public AuthException(string message) : base(message) { }
}
