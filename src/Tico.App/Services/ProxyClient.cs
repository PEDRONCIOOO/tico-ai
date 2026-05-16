using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using Tico.App.Config;
using Tico.App.Core;

namespace Tico.App.Services;

public class ProxyClient : IProxyClient
{
    private readonly HttpClient _http;
    private readonly AppSettings _settings;
    private readonly ISessionProvider _session;

    public ProxyClient(HttpClient http, AppSettings settings, ISessionProvider session)
    {
        _http = http;
        _settings = settings;
        _session = session;
    }

    public async IAsyncEnumerable<string> StreamChatAsync(
        string systemPrompt,
        IReadOnlyList<ChatMessage> messages,
        string model,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var apiMessages = messages.Select(m =>
        {
            if (m.Role == "user" && m.Images is { Count: > 0 } images)
            {
                // Interleave: label-text, image, label-text, image, ..., final-text
                var content = new List<object>();
                foreach (var img in images)
                {
                    content.Add(new { type = "text", text = img.Label });
                    content.Add(new
                    {
                        type = "image",
                        source = new { type = "base64", media_type = "image/jpeg", data = img.Base64 }
                    });
                }
                content.Add(new { type = "text", text = m.TextContent ?? "" });
                return new { role = m.Role, content = (object)content };
            }
            return new { role = m.Role, content = (object)(m.TextContent ?? "") };
        }).ToList();

        var body = JsonSerializer.Serialize(new { system = systemPrompt, messages = apiMessages, model });

        HttpRequestMessage MakeRequest() => new(HttpMethod.Post, $"{_settings.ProxyBaseUrl}/chat")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        var response = await SendWithAuthAsync(MakeRequest, HttpCompletionOption.ResponseHeadersRead, ct);

        if (response.StatusCode == HttpStatusCode.TooManyRequests)
        {
            await ThrowUsageLimitAsync(response, ct);
        }
        response.EnsureSuccessStatusCode();

        var stream = await response.Content.ReadAsStreamAsync(ct);
        await foreach (var token in ParseSseStream(stream, ct))
        {
            yield return token;
        }
    }

    public async Task<string> TranscribeAsync(byte[] wavData, CancellationToken ct = default)
    {
        HttpRequestMessage MakeRequest()
        {
            var content = new MultipartFormDataContent();
            var fileContent = new ByteArrayContent(wavData);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue("audio/wav");
            content.Add(fileContent, "file", "audio.wav");
            return new HttpRequestMessage(HttpMethod.Post, $"{_settings.ProxyBaseUrl}/transcribe")
            {
                Content = content
            };
        }

        var response = await SendWithAuthAsync(MakeRequest, HttpCompletionOption.ResponseContentRead, ct);
        if (!response.IsSuccessStatusCode)
        {
            var errBody = await response.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException($"Transcribe {(int)response.StatusCode}: {errBody}");
        }

        var json = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.GetProperty("text").GetString() ?? "";
    }

    public async Task<byte[]> SynthesizeSpeechAsync(string text, string voice, CancellationToken ct = default)
    {
        var body = JsonSerializer.Serialize(new { text, voice });
        HttpRequestMessage MakeRequest() => new(HttpMethod.Post, $"{_settings.ProxyBaseUrl}/tts")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        var response = await SendWithAuthAsync(MakeRequest, HttpCompletionOption.ResponseContentRead, ct);
        if (!response.IsSuccessStatusCode)
        {
            var errBody = await response.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException($"TTS {(int)response.StatusCode}: {errBody}");
        }

        return await response.Content.ReadAsByteArrayAsync(ct);
    }

    public async Task<UsageInfo> GetUsageAsync(CancellationToken ct = default)
    {
        HttpRequestMessage MakeRequest() => new(HttpMethod.Post, $"{_settings.ProxyBaseUrl}/usage");
        var response = await SendWithAuthAsync(MakeRequest, HttpCompletionOption.ResponseContentRead, ct);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(ct);
        return AuthService.ParseUsage(json);
    }

    // ─── Auth helper ─────────────────────────────────────────────────

    /// <summary>
    /// Sends a request with the current Bearer token. On 401, refreshes the
    /// session once and retries with the fresh token.
    /// </summary>
    private async Task<HttpResponseMessage> SendWithAuthAsync(
        Func<HttpRequestMessage> requestFactory,
        HttpCompletionOption option,
        CancellationToken ct)
    {
        async Task<HttpResponseMessage> SendOnce(string? token)
        {
            var req = requestFactory();
            if (token != null)
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return await _http.SendAsync(req, option, ct);
        }

        var token = await _session.GetValidAccessTokenAsync(ct);
        if (token == null)
            throw new AuthException("Sessão expirada — faça login novamente");

        var response = await SendOnce(token);
        if (response.StatusCode != HttpStatusCode.Unauthorized)
            return response;

        // 401: refresh once and retry
        response.Dispose();
        await _session.ForceRefreshAsync(ct);
        var freshToken = await _session.GetValidAccessTokenAsync(ct);
        if (freshToken == null)
            throw new AuthException("Sessão expirada — faça login novamente");

        return await SendOnce(freshToken);
    }

    private static async Task ThrowUsageLimitAsync(HttpResponseMessage response, CancellationToken ct)
    {
        var body = await response.Content.ReadAsStringAsync(ct);
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var tier = root.GetProperty("tier").GetString() ?? "free";
            var used = root.GetProperty("used").GetInt32();
            var limit = root.GetProperty("limit").GetInt32();
            var msg = root.TryGetProperty("error", out var e)
                ? e.GetString() ?? $"limite do plano {tier} atingido"
                : $"limite do plano {tier} atingido ({used}/{limit})";
            throw new UsageLimitException(tier, used, limit, msg);
        }
        catch (UsageLimitException) { throw; }
        catch
        {
            throw new UsageLimitException("unknown", 0, 0, "limite atingido");
        }
    }

    public static async IAsyncEnumerable<string> ParseSseStream(
        Stream stream,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        using var reader = new StreamReader(stream);
        while (!reader.EndOfStream && !ct.IsCancellationRequested)
        {
            var line = await reader.ReadLineAsync(ct);
            if (line == null) break;
            if (!line.StartsWith("data: ")) continue;
            var data = line["data: ".Length..];
            if (data == "[DONE]") break;

            using var doc = JsonDocument.Parse(data);
            var root = doc.RootElement;

            if (root.TryGetProperty("type", out var typeEl) &&
                typeEl.GetString() == "content_block_delta" &&
                root.TryGetProperty("delta", out var delta) &&
                delta.TryGetProperty("text", out var textEl))
            {
                var text = textEl.GetString();
                if (!string.IsNullOrEmpty(text))
                    yield return text;
            }
        }
    }
}
