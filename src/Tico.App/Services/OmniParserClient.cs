using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Tico.App.Config;

namespace Tico.App.Services;

public class OmniParserClient : IOmniParserClient
{
    private readonly HttpClient _http;
    private readonly AppSettings _settings;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public OmniParserClient(HttpClient http, AppSettings settings)
    {
        _http = http;
        _settings = settings;
    }

    public async Task<OmniParseResult?> ParseAsync(
        string imageBase64, int width, int height, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_settings.OmniParserUrl))
            return null;

        try
        {
            var payload = JsonSerializer.Serialize(
                new { image = imageBase64, width, height }, JsonOpts);

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"{_settings.OmniParserUrl.TrimEnd('/')}/parse")
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json"),
            };

            if (!string.IsNullOrEmpty(_settings.OmniParserApiKey))
                request.Headers.Add("X-Api-Key", _settings.OmniParserApiKey);

            var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync(ct);
            return JsonSerializer.Deserialize<OmniParseResult>(json, JsonOpts);
        }
        catch (OperationCanceledException) { return null; }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"OmniParser: {ex.Message}");
            return null;
        }
    }
}
