using System.Text;

namespace Tico.App.Services;

public static class ElementListFormatter
{
    public static string Format(List<ParsedElement> elements, int screenIndex, int idOffset = 0)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"[UI Elements - screen {screenIndex}]");
        foreach (var e in elements)
        {
            int globalId = e.Id + idOffset;
            var b = e.BBox;
            if (e.Label.StartsWith("icon:"))
                sb.AppendLine($"#{globalId} {e.Label} [{b[0]},{b[1]},{b[2]},{b[3]}]");
            else
                sb.AppendLine($"#{globalId} \"{e.Label}\" {e.Type} [{b[0]},{b[1]},{b[2]},{b[3]}]");
        }
        return sb.ToString().TrimEnd();
    }

    public static string FormatAll(
        IEnumerable<(int ScreenIndex, List<ParsedElement> Elements)> screens)
    {
        var sb = new StringBuilder();
        int idOffset = 0;
        foreach (var (screenIndex, elements) in screens)
        {
            if (sb.Length > 0) sb.AppendLine().AppendLine();
            sb.Append(Format(elements, screenIndex, idOffset));
            idOffset += elements.Count;
        }
        return sb.ToString();
    }

    public static List<ParsedElement> Truncate(
        List<ParsedElement> elements, int maxElements, int cursorX, int cursorY)
    {
        if (elements.Count <= maxElements) return elements;

        return elements
            .OrderBy(e => DistanceToCursor(e, cursorX, cursorY))
            .Take(maxElements)
            .OrderBy(e => e.Id)
            .ToList();
    }

    private static double DistanceToCursor(ParsedElement e, int cursorX, int cursorY)
    {
        double dx = e.CenterX - cursorX;
        double dy = e.CenterY - cursorY;
        return dx * dx + dy * dy; // squared distance is fine for sorting
    }
}
