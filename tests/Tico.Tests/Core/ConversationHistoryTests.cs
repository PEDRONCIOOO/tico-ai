using Tico.App.Core;

namespace Tico.Tests.Core;

public class ConversationHistoryTests
{
    [Fact]
    public void New_history_is_empty()
    {
        var history = new ConversationHistory();
        Assert.Empty(history.Messages);
    }

    [Fact]
    public void AddUserMessage_adds_message_with_role_user()
    {
        var history = new ConversationHistory();
        history.AddUserMessage("olá", [new LabeledImage("screen 1", "base64screenshot")]);
        Assert.Single(history.Messages);
        Assert.Equal("user", history.Messages[0].Role);
    }

    [Fact]
    public void AddAssistantMessage_adds_message_with_role_assistant()
    {
        var history = new ConversationHistory();
        history.AddAssistantMessage("oi, tudo bem?");
        Assert.Single(history.Messages);
        Assert.Equal("assistant", history.Messages[0].Role);
    }

    [Fact]
    public void History_trims_to_max_10_messages()
    {
        var history = new ConversationHistory(maxMessages: 10);
        for (int i = 0; i < 12; i++)
            history.AddUserMessage($"msg {i}");
        Assert.Equal(10, history.Messages.Count);
        Assert.Equal("msg 2", history.Messages[0].TextContent);
    }

    [Fact]
    public void Clear_removes_all_messages()
    {
        var history = new ConversationHistory();
        history.AddUserMessage("teste");
        history.Clear();
        Assert.Empty(history.Messages);
    }

    [Fact]
    public void UserMessage_includes_labeled_images()
    {
        var history = new ConversationHistory();
        history.AddUserMessage("o que é isso?", [
            new LabeledImage("screen 1 (foco principal)", "abc123base64"),
            new LabeledImage("screen 2", "def456base64"),
        ]);
        var msg = history.Messages[0];
        Assert.NotNull(msg.Images);
        Assert.Equal(2, msg.Images!.Count);
        Assert.Equal("screen 1 (foco principal)", msg.Images[0].Label);
        Assert.Equal("abc123base64", msg.Images[0].Base64);
        Assert.Equal("def456base64", msg.Images[1].Base64);
        Assert.Equal("o que é isso?", msg.TextContent);
    }
}
