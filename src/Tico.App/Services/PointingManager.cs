using System.Text.RegularExpressions;

namespace Tico.App.Services;

public class PointingManager
{
    /// <summary>
    /// Parse [POINT:x,y:label], [POINT:x,y:label:screenN], or [POINT:none] from the
    /// end of Claude's response. ScreenIndex is 0-based; null when not specified.
    /// </summary>
    public static (string SpokenText, int X, int Y, string? Label, int? ScreenIndex) ParsePointTag(string response)
    {
        // POINT tag at end of message. Optional label, optional :screenN suffix.
        var match = Regex.Match(
            response,
            @"\[POINT:(?:none|(\d+)\s*,\s*(\d+)(?::([^\]:]+))?(?::screen(\d+))?)\]\s*$");

        if (!match.Success)
            return (response.Trim(), -1, -1, null, null);

        var spokenText = response[..match.Index].Trim();

        if (!match.Groups[1].Success)
            return (spokenText, -1, -1, null, null); // [POINT:none]

        int x = int.Parse(match.Groups[1].Value);
        int y = int.Parse(match.Groups[2].Value);
        string? label = match.Groups[3].Success ? match.Groups[3].Value.Trim() : null;
        int? screenIndex = match.Groups[4].Success ? int.Parse(match.Groups[4].Value) : null;

        return (spokenText, x, y, label, screenIndex);
    }

    /// <summary>
    /// Map screenshot pixel coordinates to absolute screen coordinates for a specific
    /// captured screen. Accounts for the screen's offset on the virtual desktop, the
    /// physical-to-screenshot downscale, and DPI scaling.
    /// </summary>
    public static (int ScreenX, int ScreenY) MapToScreen(
        int screenshotX, int screenshotY,
        CapturedScreen target)
    {
        // Clamp to screenshot bounds (like Clicky) to prevent out-of-bounds coordinates
        int clampedX = Math.Clamp(screenshotX, 0, target.ScreenshotWidth);
        int clampedY = Math.Clamp(screenshotY, 0, target.ScreenshotHeight);

        // Screenshot pixels → physical pixels of this screen
        double scaleX = (double)target.ScreenPhysicalWidth / target.ScreenshotWidth;
        double scaleY = (double)target.ScreenPhysicalHeight / target.ScreenshotHeight;

        double physX = clampedX * scaleX;
        double physY = clampedY * scaleY;

        // Physical → logical (DPI)
        double dpiScale = Helpers.ImageHelper.GetDpiScale();
        int logicalX = (int)(physX / dpiScale);
        int logicalY = (int)(physY / dpiScale);

        // Add the screen's offset on the virtual desktop
        return (target.ScreenOffsetX + logicalX, target.ScreenOffsetY + logicalY);
    }

    /// <summary>
    /// Parse [POINT:id:label] or [POINT:id:label:screenN] from Claude's response
    /// when using OmniParser element list. Returns null for [POINT:none] or no tag.
    /// Falls back to fuzzy label match if ID is not found in the element list.
    /// </summary>
    public static (string SpokenText, int X, int Y, string? Label, int? ScreenIndex)? ParsePointTagV2(
        string response, List<ParsedElement> elements)
    {
        var match = Regex.Match(
            response,
            @"\[POINT:(?:none|(\d+):([^\]:]+)(?::screen(\d+))?)\]\s*$");

        if (!match.Success) return null;

        var spokenText = response[..match.Index].Trim();

        // [POINT:none]
        if (!match.Groups[1].Success) return null;

        int id = int.Parse(match.Groups[1].Value);
        string label = match.Groups[2].Value.Trim();
        int? screenIndex = match.Groups[3].Success ? int.Parse(match.Groups[3].Value) : null;

        // Try exact ID match
        var element = elements.FirstOrDefault(e => e.Id == id);

        // Fallback: fuzzy match by label (case-insensitive contains)
        element ??= elements.FirstOrDefault(e =>
            e.Label.Contains(label, StringComparison.OrdinalIgnoreCase) ||
            label.Contains(e.Label, StringComparison.OrdinalIgnoreCase));

        if (element == null) return null;

        return (spokenText, element.CenterX, element.CenterY, label, screenIndex);
    }
}
