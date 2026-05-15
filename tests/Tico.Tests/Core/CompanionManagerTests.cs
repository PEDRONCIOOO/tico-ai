using NSubstitute;
using Tico.App.Core;
using Tico.App.Config;
using Tico.App.Services;

namespace Tico.Tests.Core;

public class CompanionManagerTests
{
    private readonly IAudioCaptureService _audio = Substitute.For<IAudioCaptureService>();
    private readonly IScreenCaptureService _screen = Substitute.For<IScreenCaptureService>();
    private readonly IProxyClient _proxy = Substitute.For<IProxyClient>();
    private readonly IOmniParserClient _omniParser = Substitute.For<IOmniParserClient>();
    private readonly AppSettings _settings = new();
    private readonly CompanionManager _manager;

    public CompanionManagerTests()
    {
        _manager = new CompanionManager(_audio, _screen, _proxy, _settings, _omniParser, enableSystemServices: false);
    }

    private static MultiScreenContext FakeContext() => new(
        Screens: [new CapturedScreen(
            Index: 0, IsFocus: true, ImageBase64: "base64",
            ScreenshotWidth: 1280, ScreenshotHeight: 720,
            ScreenPhysicalWidth: 1920, ScreenPhysicalHeight: 1080,
            ScreenOffsetX: 0, ScreenOffsetY: 0,
            ScreenLogicalWidth: 1920, ScreenLogicalHeight: 1080)],
        CursorX: 100, CursorY: 200,
        WindowTitle: "Test", ProcessName: "test.exe",
        WindowLeft: 0, WindowTop: 0, WindowWidth: 1920, WindowHeight: 1080);

    [Fact]
    public void Initial_state_is_Idle()
    {
        Assert.Equal(CompanionState.Idle, _manager.State);
    }

    [Fact]
    public void OnHotkeyDown_transitions_to_Recording()
    {
        _screen.CaptureScreen().Returns(FakeContext());
        _manager.OnHotkeyDown();
        Assert.Equal(CompanionState.Recording, _manager.State);
    }

    [Fact]
    public void OnHotkeyDown_captures_screen_and_starts_audio()
    {
        _screen.CaptureScreen().Returns(FakeContext());
        _manager.OnHotkeyDown();
        _screen.Received(1).CaptureScreen();
        _audio.Received(1).StartRecording();
    }

    [Fact]
    public void OnHotkeyDown_while_Speaking_dismisses_and_starts_new_recording()
    {
        _screen.CaptureScreen().Returns(FakeContext());
        _manager.SetStateForTesting(CompanionState.Speaking);
        _manager.OnHotkeyDown();
        Assert.Equal(CompanionState.Recording, _manager.State);
    }

    [Fact]
    public async Task OnHotkeyUp_with_empty_transcript_returns_to_Idle()
    {
        _screen.CaptureScreen().Returns(FakeContext());
        _audio.StopRecording().Returns(new byte[100]);
        _proxy.TranscribeAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>()).Returns("");

        _manager.OnHotkeyDown();
        await _manager.OnHotkeyUpAsync();

        Assert.Equal(CompanionState.Idle, _manager.State);
    }

    [Fact]
    public void ConversationHistory_is_maintained()
    {
        Assert.NotNull(_manager.History);
        Assert.Empty(_manager.History.Messages);
    }

    [Fact]
    public async Task OnHotkeyUp_FallbackWithoutOmniParser()
    {
        // CompanionManager without OmniParser should still work (v1 flow)
        var managerNoOmni = new CompanionManager(_audio, _screen, _proxy, _settings, enableSystemServices: false);

        _screen.CaptureScreen().Returns(FakeContext());
        _audio.StopRecording().Returns(new byte[100]);
        _proxy.TranscribeAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>()).Returns("");

        managerNoOmni.OnHotkeyDown();
        await managerNoOmni.OnHotkeyUpAsync();

        Assert.Equal(CompanionState.Idle, managerNoOmni.State);
    }

    [Theory]
    [InlineData("olha aqui! [POINT:15:botão]", "olha aqui!")]
    [InlineData("resposta sem point [POINT:none]", "resposta sem point")]
    [InlineData("resposta limpa", "resposta limpa")]
    [InlineData("[POINT:100,200:menu] texto depois", "texto depois")]
    public void StripPointTags_removes_all_point_tags(string input, string expected)
    {
        Assert.Equal(expected, CompanionManager.StripPointTags(input));
    }
}
