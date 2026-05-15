namespace Tico.App.Core;

public record LabeledImage(string Label, string Base64);

public class ChatMessage
{
    public required string Role { get; init; }
    public string? TextContent { get; init; }

    /// <summary>
    /// Optional ordered list of labeled images for user messages. Each image is preceded
    /// by its label as a text block when serialized for Claude (so the model can tell the
    /// images apart, e.g. "screen 1 (foco principal)").
    /// </summary>
    public IReadOnlyList<LabeledImage>? Images { get; init; }
}

public class ConversationHistory
{
    private readonly int _maxMessages;
    private readonly List<ChatMessage> _messages = [];

    public IReadOnlyList<ChatMessage> Messages => _messages;

    public ConversationHistory(int maxMessages = 10)
    {
        _maxMessages = maxMessages;
    }

    public void AddUserMessage(string text, IReadOnlyList<LabeledImage>? images = null)
    {
        Add(new ChatMessage { Role = "user", TextContent = text, Images = images });
    }

    public void AddAssistantMessage(string text)
    {
        Add(new ChatMessage { Role = "assistant", TextContent = text });
    }

    public void Clear() => _messages.Clear();

    private void Add(ChatMessage message)
    {
        _messages.Add(message);
        while (_messages.Count > _maxMessages)
            _messages.RemoveAt(0);
    }
}
