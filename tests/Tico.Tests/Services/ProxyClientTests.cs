using System.Text;
using Tico.App.Services;

namespace Tico.Tests.Services;

public class ProxyClientTests
{
    [Fact]
    public async Task ParseSseStream_extracts_text_deltas()
    {
        var sseData = "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"olá\"}}\n\nevent: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\" mundo\"}}\n\nevent: message_stop\ndata: {\"type\":\"message_stop\"}\n\n";

        var stream = new MemoryStream(Encoding.UTF8.GetBytes(sseData));
        var tokens = new List<string>();
        await foreach (var token in ProxyClient.ParseSseStream(stream))
            tokens.Add(token);

        Assert.Equal(2, tokens.Count);
        Assert.Equal("olá", tokens[0]);
        Assert.Equal(" mundo", tokens[1]);
    }

    [Fact]
    public async Task ParseSseStream_ignores_non_delta_events()
    {
        var sseData = "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_123\"}}\n\nevent: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":0}\n\nevent: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"teste\"}}\n\nevent: message_stop\ndata: {\"type\":\"message_stop\"}\n\n";

        var stream = new MemoryStream(Encoding.UTF8.GetBytes(sseData));
        var tokens = new List<string>();
        await foreach (var token in ProxyClient.ParseSseStream(stream))
            tokens.Add(token);

        Assert.Single(tokens);
        Assert.Equal("teste", tokens[0]);
    }

    [Fact]
    public async Task ParseSseStream_handles_empty_stream()
    {
        var stream = new MemoryStream(Encoding.UTF8.GetBytes(""));
        var tokens = new List<string>();
        await foreach (var token in ProxyClient.ParseSseStream(stream))
            tokens.Add(token);

        Assert.Empty(tokens);
    }
}
