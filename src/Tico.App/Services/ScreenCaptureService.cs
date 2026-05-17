using Tico.App.Helpers;
using WinFormsScreen = System.Windows.Forms.Screen;

namespace Tico.App.Services;

public class ScreenCaptureService : IScreenCaptureService
{
    public MultiScreenContext CaptureScreen()
    {
        var (cursorX, cursorY) = CursorHelper.GetCursorPosition();
        var (windowTitle, processName, winLeft, winTop, winWidth, winHeight) = CursorHelper.GetActiveWindowInfo();

        var allScreens = WinFormsScreen.AllScreens;
        var focusScreen = WinFormsScreen.FromPoint(new System.Drawing.Point(cursorX, cursorY));

        int focusIndex = Array.IndexOf(allScreens, focusScreen);
        if (focusIndex < 0) focusIndex = 0;

        var (bitmap, ssW, ssH, physW, physH) =
            ImageHelper.CaptureSpecificScreen(focusScreen, drawCursor: true, cursorX, cursorY);
        var base64 = ImageHelper.BitmapToBase64Jpeg(bitmap);
        bitmap.Dispose();

        var captured = new List<CapturedScreen>(1)
        {
            new CapturedScreen(
                Index: focusIndex,
                IsFocus: true,
                ImageBase64: base64,
                ScreenshotWidth: ssW,
                ScreenshotHeight: ssH,
                ScreenPhysicalWidth: physW,
                ScreenPhysicalHeight: physH,
                ScreenOffsetX: focusScreen.Bounds.X,
                ScreenOffsetY: focusScreen.Bounds.Y,
                ScreenLogicalWidth: focusScreen.Bounds.Width,
                ScreenLogicalHeight: focusScreen.Bounds.Height)
        };

        // Capture active window at native resolution for high-detail view.
        // Wrapped in try/catch — if it fails (off-screen, minimized, etc.), we skip it.
        string? activeWindowBase64 = null;
        int cropW = 0, cropH = 0;
        if (winWidth > 50 && winHeight > 50)
        {
            try
            {
                var (cropBitmap, cw, ch) = ImageHelper.CaptureRegion(winLeft, winTop, winWidth, winHeight);
                activeWindowBase64 = ImageHelper.BitmapToBase64Jpeg(cropBitmap);
                cropBitmap.Dispose();
                cropW = cw;
                cropH = ch;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Active window crop failed: {ex.Message}");
            }
        }

        return new MultiScreenContext(captured, cursorX, cursorY, windowTitle, processName,
            winLeft, winTop, winWidth, winHeight,
            activeWindowBase64, cropW, cropH);
    }
}
