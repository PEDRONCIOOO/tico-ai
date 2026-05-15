using System.Text.Json.Serialization;

namespace Tico.App.Services;

public record ParsedElement(int Id, string Label, string Type, [property: JsonPropertyName("bbox")] int[] BBox)
{
    public int CenterX => (BBox[0] + BBox[2]) / 2;
    public int CenterY => (BBox[1] + BBox[3]) / 2;
}

public record OmniParseResult(List<ParsedElement> Elements, int ParseTimeMs);

public interface IOmniParserClient
{
    Task<OmniParseResult?> ParseAsync(string imageBase64, int width, int height, CancellationToken ct = default);
}
