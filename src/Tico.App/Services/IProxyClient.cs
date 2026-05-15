namespace Tico.App.Services;

public interface IProxyClient
{
    IAsyncEnumerable<string> StreamChatAsync(string systemPrompt, IReadOnlyList<Core.ChatMessage> messages, string model, CancellationToken ct = default);
    Task<string> TranscribeAsync(byte[] wavData, CancellationToken ct = default);
    Task<byte[]> SynthesizeSpeechAsync(string text, string voice, CancellationToken ct = default);
    Task<UsageInfo> GetUsageAsync(CancellationToken ct = default);
}

public class UsageLimitException : Exception
{
    public string Tier { get; }
    public int Used { get; }
    public int Limit { get; }

    public UsageLimitException(string tier, int used, int limit, string message) : base(message)
    {
        Tier = tier;
        Used = used;
        Limit = limit;
    }
}
