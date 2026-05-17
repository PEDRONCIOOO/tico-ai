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

    /// <summary>
    /// Returns messages with images stripped from all user messages except the last one,
    /// so old screenshots are not resent to the API.
    /// </summary>
    public IReadOnlyList<ChatMessage> MessagesForApi
    {
        get
        {
            var lastUserIdx = -1;
            for (var i = _messages.Count - 1; i >= 0; i--)
            {
                if (_messages[i].Role == "user") { lastUserIdx = i; break; }
            }

            var result = new List<ChatMessage>(_messages.Count);
            for (var i = 0; i < _messages.Count; i++)
            {
                var msg = _messages[i];
                if (msg.Role == "user" && i != lastUserIdx && msg.Images is not null)
                    result.Add(new ChatMessage { Role = msg.Role, TextContent = msg.TextContent });
                else
                    result.Add(msg);
            }
            return result;
        }
    }

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
