using Tico.App.Services;

namespace Tico.Tests.Services;

public class ElementListFormatterTests
{
    [Fact]
    public void Format_SingleScreen_ProducesCorrectOutput()
    {
        var elements = new List<ParsedElement>
        {
            new(1, "File", "menu", [0, 0, 50, 25]),
            new(2, "Save", "button", [120, 45, 180, 65]),
        };

        var result = ElementListFormatter.Format(elements, screenIndex: 1);

        Assert.Contains("[UI Elements - screen 1]", result);
        Assert.Contains("#1 \"File\" menu [0,0,50,25]", result);
        Assert.Contains("#2 \"Save\" button [120,45,180,65]", result);
    }

    [Fact]
    public void Format_IconWithoutText_UsesIconPrefix()
    {
        var elements = new List<ParsedElement>
        {
            new(1, "icon:gear", "icon", [10, 10, 30, 30]),
        };

        var result = ElementListFormatter.Format(elements, screenIndex: 1);

        Assert.Contains("#1 icon:gear [10,10,30,30]", result);
    }

    [Fact]
    public void FormatAll_MultipleScreens_ConcatenatesWithGlobalIds()
    {
        var screen1 = new List<ParsedElement>
        {
            new(1, "File", "menu", [0, 0, 50, 25]),
            new(2, "Edit", "menu", [51, 0, 100, 25]),
        };
        var screen2 = new List<ParsedElement>
        {
            new(1, "Play", "button", [200, 300, 250, 330]),
        };

        var result = ElementListFormatter.FormatAll(
            new[] { (ScreenIndex: 1, Elements: screen1), (ScreenIndex: 2, Elements: screen2) });

        Assert.Contains("#1 \"File\" menu", result);
        Assert.Contains("#2 \"Edit\" menu", result);
        Assert.Contains("#3 \"Play\" button", result);
        Assert.Contains("[UI Elements - screen 1]", result);
        Assert.Contains("[UI Elements - screen 2]", result);
    }

    [Fact]
    public void Truncate_OverLimit_KeepsClosestToCursor()
    {
        var elements = new List<ParsedElement>();
        for (int i = 1; i <= 250; i++)
            elements.Add(new(i, $"btn{i}", "button", [i * 5, i * 5, i * 5 + 20, i * 5 + 20]));

        var result = ElementListFormatter.Truncate(elements, maxElements: 200, cursorX: 10, cursorY: 10);

        Assert.Equal(200, result.Count);
        // Element 1 is at (5,5)-(25,25), closest to cursor (10,10) — should be first
        Assert.Equal(1, result[0].Id);
    }

    [Fact]
    public void Truncate_UnderLimit_ReturnsAll()
    {
        var elements = new List<ParsedElement>
        {
            new(1, "A", "button", [0, 0, 10, 10]),
            new(2, "B", "button", [50, 50, 60, 60]),
        };

        var result = ElementListFormatter.Truncate(elements, maxElements: 200, cursorX: 0, cursorY: 0);

        Assert.Equal(2, result.Count);
    }
}
