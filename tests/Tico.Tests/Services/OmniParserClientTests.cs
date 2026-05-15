using System.Net;
using System.Text;
using NSubstitute;
using Tico.App.Config;
using Tico.App.Services;

namespace Tico.Tests.Services;

public class OmniParserClientTests
{
    private static AppSettings Settings(string url = "http://omni.test") =>
        new() { OmniParserUrl = url, OmniParserApiKey = "test-key" };

    private static HttpClient MockHttp(HttpStatusCode status, string body)
    {
        var handler = new FakeHandler(status, body);
        return new HttpClient(handler);
    }

    [Fact]
    public async Task ParseAsync_ReturnsElements_OnSuccess()
    {
        var json = """
        {
          "elements": [
            { "id": 1, "label": "Save", "type": "button", "bbox": [100, 200, 150, 220] },
            { "id": 2, "label": "File", "type": "menu", "bbox": [0, 0, 50, 25] }
          ],
          "parse_time_ms": 300
        }
        """;
        var client = new OmniParserClient(MockHttp(HttpStatusCode.OK, json), Settings());

        var result = await client.ParseAsync("base64img", 1280, 720);

        Assert.NotNull(result);
        Assert.Equal(2, result!.Elements.Count);
        Assert.Equal("Save", result.Elements[0].Label);
        Assert.Equal(125, result.Elements[0].CenterX);
        Assert.Equal(210, result.Elements[0].CenterY);
        Assert.Equal(300, result.ParseTimeMs);
    }

    [Fact]
    public async Task ParseAsync_ReturnsNull_OnHttpError()
    {
        var client = new OmniParserClient(MockHttp(HttpStatusCode.InternalServerError, "err"), Settings());

        var result = await client.ParseAsync("base64img", 1280, 720);

        Assert.Null(result);
    }

    [Fact]
    public async Task ParseAsync_ReturnsNull_OnTimeout()
    {
        var handler = new SlowHandler();
        var http = new HttpClient(handler);
        var client = new OmniParserClient(http, Settings());

        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));
        var result = await client.ParseAsync("base64img", 1280, 720, cts.Token);

        Assert.Null(result);
    }

    [Fact]
    public async Task ParseAsync_ReturnsNull_WhenUrlEmpty()
    {
        var client = new OmniParserClient(MockHttp(HttpStatusCode.OK, "{}"), Settings(url: ""));

        var result = await client.ParseAsync("base64img", 1280, 720);

        Assert.Null(result);
    }

    // ─── Test helpers ──────────────────────────────────────────────

    private class FakeHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly string _body;
        public FakeHandler(HttpStatusCode status, string body) { _status = status; _body = body; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            return Task.FromResult(new HttpResponseMessage(_status)
            {
                Content = new StringContent(_body, Encoding.UTF8, "application/json")
            });
        }
    }

    private class SlowHandler : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            await Task.Delay(TimeSpan.FromSeconds(10), ct);
            return new HttpResponseMessage(HttpStatusCode.OK);
        }
    }
}
