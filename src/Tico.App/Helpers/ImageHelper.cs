using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

namespace Tico.App.Helpers;

public static class ImageHelper
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetDC(IntPtr hwnd);

    [DllImport("gdi32.dll")]
    private static extern int GetDeviceCaps(IntPtr hdc, int index);

    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);

    private const int DESKTOPHORZRES = 118; // Physical width
    private const int DESKTOPVERTRES = 117; // Physical height
    private const int HORZRES = 8;          // Logical width
    private const int VERTRES = 10;         // Logical height

    /// <summary>
    /// Get DPI scale factor for the desktop.
    /// </summary>
    public static double GetDpiScale()
    {
        var hdc = GetDC(IntPtr.Zero);
        int physicalW = GetDeviceCaps(hdc, DESKTOPHORZRES);
        int logicalW = GetDeviceCaps(hdc, HORZRES);
        ReleaseDC(IntPtr.Zero, hdc);
        return (double)physicalW / logicalW;
    }

    /// <summary>
    /// Capture a specific display at physical resolution, downscale to max 1568px wide
    /// (matches Claude's internal vision processing limit for 1:1 coordinate accuracy).
    /// If drawCursor is true, draws the red cursor marker at the cursor's relative position
    /// on this screen (only meaningful for the screen that contains the cursor).
    /// </summary>
    public static (Bitmap Bitmap, int ScreenshotWidth, int ScreenshotHeight, int ScreenPhysicalWidth, int ScreenPhysicalHeight)
        CaptureSpecificScreen(System.Windows.Forms.Screen screen, bool drawCursor, int cursorX, int cursorY)
    {
        var bounds = screen.Bounds;
        double dpiScale = GetDpiScale();

        int physW = (int)(bounds.Width * dpiScale);
        int physH = (int)(bounds.Height * dpiScale);

        var fullBitmap = new Bitmap(physW, physH, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(fullBitmap))
        {
            g.CopyFromScreen(
                (int)(bounds.X * dpiScale), (int)(bounds.Y * dpiScale),
                0, 0,
                new Size(physW, physH));

            if (drawCursor)
            {
                int relX = (int)((cursorX - bounds.X) * dpiScale);
                int relY = (int)((cursorY - bounds.Y) * dpiScale);
                DrawCursorMarker(g, relX, relY);
            }
        }

        // Downscale to max 1280px wide (same as Clicky — proven precise with Claude's vision).
        const int maxWidth = 1280;
        if (physW > maxWidth)
        {
            double scale = (double)maxWidth / physW;
            int newH = (int)(physH * scale);
            var scaled = new Bitmap(maxWidth, newH, PixelFormat.Format32bppArgb);
            using var gs = Graphics.FromImage(scaled);
            gs.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            gs.DrawImage(fullBitmap, 0, 0, maxWidth, newH);
            fullBitmap.Dispose();
            return (scaled, maxWidth, newH, physW, physH);
        }

        return (fullBitmap, physW, physH, physW, physH);
    }

    /// <summary>
    /// Capture a rectangular region of the screen at physical resolution.
    /// Used to get a high-detail crop of the active window.
    /// Coordinates are in logical (desktop) space.
    /// </summary>
    public static (Bitmap Bitmap, int Width, int Height) CaptureRegion(
        int logicalX, int logicalY, int logicalW, int logicalH)
    {
        double dpiScale = GetDpiScale();

        int physX = (int)(logicalX * dpiScale);
        int physY = (int)(logicalY * dpiScale);
        int physW = (int)(logicalW * dpiScale);
        int physH = (int)(logicalH * dpiScale);

        // Clamp to at least 1px
        physW = Math.Max(physW, 1);
        physH = Math.Max(physH, 1);

        var bitmap = new Bitmap(physW, physH, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(bitmap))
        {
            g.CopyFromScreen(physX, physY, 0, 0, new Size(physW, physH));
        }

        // Downscale if larger than 1568px (Claude's vision limit) to keep 1:1 mapping
        const int maxDim = 1568;
        if (physW > maxDim || physH > maxDim)
        {
            double scale = Math.Min((double)maxDim / physW, (double)maxDim / physH);
            int newW = (int)(physW * scale);
            int newH = (int)(physH * scale);
            var scaled = new Bitmap(newW, newH, PixelFormat.Format32bppArgb);
            using var gs = Graphics.FromImage(scaled);
            gs.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            gs.DrawImage(bitmap, 0, 0, newW, newH);
            bitmap.Dispose();
            return (scaled, newW, newH);
        }

        return (bitmap, physW, physH);
    }

    private static void DrawCursorMarker(Graphics g, int x, int y)
    {
        using var pen = new Pen(Color.Red, 3);
        int radius = 20;
        g.DrawEllipse(pen, x - radius, y - radius, radius * 2, radius * 2);
        int crossLen = 10;
        g.DrawLine(pen, x - crossLen, y, x + crossLen, y);
        g.DrawLine(pen, x, y - crossLen, x, y + crossLen);
    }

    public static string BitmapToBase64Jpeg(Bitmap bitmap, long quality = 90L)
    {
        using var ms = new MemoryStream();
        var encoder = ImageCodecInfo.GetImageEncoders()
            .First(e => e.FormatID == ImageFormat.Jpeg.Guid);
        var encoderParams = new EncoderParameters(1);
        encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
        bitmap.Save(ms, encoder, encoderParams);
        return Convert.ToBase64String(ms.ToArray());
    }
}
