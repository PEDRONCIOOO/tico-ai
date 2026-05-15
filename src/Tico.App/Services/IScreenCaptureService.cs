namespace Tico.App.Services;

/// <summary>
/// One captured display.
/// - Index: 0-based screen number (matches the order of Screen.AllScreens at capture time)
/// - IsFocus: true for the screen that contains the cursor (the only one with the cursor marker drawn)
/// - ScreenshotWidth/Height: dimensions of the captured (possibly downscaled) JPEG
/// - ScreenPhysicalWidth/Height: physical resolution of the display before any downscale
/// - ScreenOffsetX/Y: top-left of this display in the virtual desktop (logical pixels)
/// </summary>
public record CapturedScreen(
    int Index,
    bool IsFocus,
    string ImageBase64,
    int ScreenshotWidth, int ScreenshotHeight,
    int ScreenPhysicalWidth, int ScreenPhysicalHeight,
    int ScreenOffsetX, int ScreenOffsetY,
    int ScreenLogicalWidth, int ScreenLogicalHeight);

public record MultiScreenContext(
    IReadOnlyList<CapturedScreen> Screens,
    int CursorX, int CursorY,
    string WindowTitle, string ProcessName,
    int WindowLeft, int WindowTop, int WindowWidth, int WindowHeight,
    string? ActiveWindowImageBase64 = null,
    int ActiveWindowCropWidth = 0, int ActiveWindowCropHeight = 0)
{
    public CapturedScreen FocusedScreen => Screens.First(s => s.IsFocus);
}

public interface IScreenCaptureService
{
    MultiScreenContext CaptureScreen();
}
