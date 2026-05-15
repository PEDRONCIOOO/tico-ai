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

        var captured = new List<CapturedScreen>(allScreens.Length);

        for (int i = 0; i < allScreens.Length; i++)
        {
            var screen = allScreens[i];
            bool isFocus = screen.Equals(focusScreen);

            var (bitmap, ssW, ssH, physW, physH) =
                ImageHelper.CaptureSpecificScreen(screen, drawCursor: isFocus, cursorX, cursorY);
            var base64 = ImageHelper.BitmapToBase64Jpeg(bitmap);
            bitmap.Dispose();

            captured.Add(new CapturedScreen(
                Index: i,
                IsFocus: isFocus,
                ImageBase64: base64,
                ScreenshotWidth: ssW,
                ScreenshotHeight: ssH,
                ScreenPhysicalWidth: physW,
                ScreenPhysicalHeight: physH,
                ScreenOffsetX: screen.Bounds.X,
                ScreenOffsetY: screen.Bounds.Y,
                ScreenLogicalWidth: screen.Bounds.Width,
                ScreenLogicalHeight: screen.Bounds.Height));
        }

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
