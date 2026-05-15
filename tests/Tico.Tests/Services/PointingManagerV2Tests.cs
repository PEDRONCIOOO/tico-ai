using Tico.App.Services;

namespace Tico.Tests.Services;

public class PointingManagerV2Tests
{
    private static List<ParsedElement> SampleElements() =>
    [
        new(1, "File", "menu", [0, 0, 50, 25]),
        new(2, "Edit", "menu", [51, 0, 100, 25]),
        new(3, "Save", "button", [120, 45, 180, 65]),
    ];

    [Fact]
    public void ParsePointTagV2_MatchesById()
    {
        var result = PointingManager.ParsePointTagV2(
            "clica no save pra salvar [POINT:3:Save]", SampleElements());

        Assert.NotNull(result);
        Assert.Equal("clica no save pra salvar", result.Value.SpokenText);
        Assert.Equal(150, result.Value.X); // (120+180)/2
        Assert.Equal(55, result.Value.Y);  // (45+65)/2
        Assert.Equal("Save", result.Value.Label);
        Assert.Null(result.Value.ScreenIndex);
    }

    [Fact]
    public void ParsePointTagV2_WithScreenIndex()
    {
        var result = PointingManager.ParsePointTagV2(
            "tá ali [POINT:1:File:screen2]", SampleElements());

        Assert.NotNull(result);
        Assert.Equal(25, result.Value.X); // (0+50)/2
        Assert.Equal(12, result.Value.Y); // (0+25)/2 = 12.5, int = 12
        Assert.Equal(2, result.Value.ScreenIndex);
    }

    [Fact]
    public void ParsePointTagV2_PointNone_ReturnsNull()
    {
        var result = PointingManager.ParsePointTagV2(
            "html é a linguagem da web [POINT:none]", SampleElements());

        Assert.Null(result);
    }

    [Fact]
    public void ParsePointTagV2_NoTag_ReturnsNull()
    {
        var result = PointingManager.ParsePointTagV2(
            "só uma resposta normal", SampleElements());

        Assert.Null(result);
    }

    [Fact]
    public void ParsePointTagV2_IdNotFound_FallbackFuzzyMatch()
    {
        var result = PointingManager.ParsePointTagV2(
            "abre o menu [POINT:99:File]", SampleElements());

        // ID 99 not found, but label "File" matches element 1
        Assert.NotNull(result);
        Assert.Equal(25, result.Value.X);
        Assert.Equal(12, result.Value.Y);
    }

    [Fact]
    public void ParsePointTagV2_IdNotFound_NoLabelMatch_ReturnsNull()
    {
        var result = PointingManager.ParsePointTagV2(
            "clica ali [POINT:99:NonExistent]", SampleElements());

        Assert.Null(result);
    }
}
