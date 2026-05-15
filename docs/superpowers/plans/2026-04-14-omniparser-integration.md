# OmniParser v2 Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Claude Vision-based element detection with OmniParser v2, sending a pre-parsed element list to Claude and matching elements by ID instead of pixel coordinates.

**Architecture:** WPF client calls a serverless GPU OmniParser endpoint in parallel with Whisper transcription. The element list is injected as text into the Claude chat. Claude returns `[POINT:id:label]` tags referencing element IDs. The WPF client resolves IDs to bounding box centers locally, eliminating the `/locate` endpoint entirely.

**Tech Stack:** C# .NET 8 / WPF, Node.js proxy, xUnit + NSubstitute

**Spec:** `docs/superpowers/specs/2026-04-14-omniparser-integration-design.md`

**Scope note:** This plan parses only the focused screen (where the cursor is). Multi-monitor parsing (all screens in parallel) is a follow-up — it requires multiple OmniParser calls and global ID renumbering. The `ElementListFormatter.FormatAll` method is already built for that.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/Tico.App/Services/IOmniParserClient.cs` | Interface + records (`ParsedElement`, `OmniParseResult`, `IOmniParserClient`) |
| Create | `src/Tico.App/Services/OmniParserClient.cs` | HTTP client that calls `/parse` on serverless GPU |
| Create | `src/Tico.App/Services/ElementListFormatter.cs` | Formats `List<ParsedElement>` into text for Claude prompt, handles truncation |
| Create | `tests/Tico.Tests/Services/OmniParserClientTests.cs` | Tests for OmniParserClient |
| Create | `tests/Tico.Tests/Services/PointingManagerV2Tests.cs` | Tests for ParsePointTagV2 and element matching |
| Create | `tests/Tico.Tests/Services/ElementListFormatterTests.cs` | Tests for formatting and truncation |
| Modify | `src/Tico.App/Services/PointingManager.cs` | Add `ParsePointTagV2` method |
| Modify | `src/Tico.App/Core/CompanionManager.cs` | Replace `IElementLocationService` with `IOmniParserClient`, parallel parse, ID-based pointing |
| Modify | `src/Tico.App/Config/AppSettings.cs` | Add `OmniParserUrl` and `OmniParserApiKey` settings |
| Modify | `src/Tico.App/App.xaml.cs` | Wire up `OmniParserClient` instead of `ElementLocationService` |
| Modify | `tests/Tico.Tests/Core/CompanionManagerTests.cs` | Update mocks: `IOmniParserClient` instead of `IElementLocationService` |
| Delete | `src/Tico.App/Services/ElementLocationService.cs` | No longer needed |
| Modify | `proxy/local-server.js` | Remove `/locate` route and `handleLocate` function |

---

### Task 1: Add `ParsedElement`, `OmniParseResult`, and `IOmniParserClient`

**Files:**
- Create: `src/Tico.App/Services/IOmniParserClient.cs`

- [ ] **Step 1: Create the interface and records file**

```csharp
namespace Tico.App.Services;

public record ParsedElement(int Id, string Label, string Type, int[] BBox)
{
    public int CenterX => (BBox[0] + BBox[2]) / 2;
    public int CenterY => (BBox[1] + BBox[3]) / 2;
}

public record OmniParseResult(List<ParsedElement> Elements, int ParseTimeMs);

public interface IOmniParserClient
{
    Task<OmniParseResult?> ParseAsync(string imageBase64, int width, int height, CancellationToken ct = default);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `dotnet build src/Tico.App/Tico.App.csproj`
Expected: Build succeeded

- [ ] **Step 3: Commit**

```
git add src/Tico.App/Services/IOmniParserClient.cs
git commit -m "feat: add IOmniParserClient interface and ParsedElement records"
```

---

### Task 2: Add `OmniParserUrl` and `OmniParserApiKey` to AppSettings

**Files:**
- Modify: `src/Tico.App/Config/AppSettings.cs:7-13`

- [ ] **Step 1: Add the two new properties**

In `AppSettings.cs`, after the `ProxyBaseUrl` property (line 12), add:

```csharp
    public string OmniParserUrl { get; set; } = "";
    public string OmniParserApiKey { get; set; } = "";
```

- [ ] **Step 2: Verify it compiles**

Run: `dotnet build src/Tico.App/Tico.App.csproj`
Expected: Build succeeded

- [ ] **Step 3: Commit**

```
git add src/Tico.App/Config/AppSettings.cs
git commit -m "feat: add OmniParser URL and API key settings"
```

---

### Task 3: Implement `OmniParserClient`

**Files:**
- Create: `src/Tico.App/Services/OmniParserClient.cs`
- Create: `tests/Tico.Tests/Services/OmniParserClientTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
using System.Net;
using System.Text;
using NSubstitute;
using Tico.App.Config;
using Tico.App.Services;

namespace Tico.Tests.Services;

public class OmniParserClientTests
{
    private static AppSettings Settings(string url = "http://omni.test") =>
        new() { OmniParserUrl = url, OmniParserApiKey = "test-key" };

    private static HttpClient MockHttp(HttpStatusCode status, string body)
    {
        var handler = new FakeHandler(status, body);
        return new HttpClient(handler);
    }

    [Fact]
    public async Task ParseAsync_ReturnsElements_OnSuccess()
    {
        var json = """
        {
          "elements": [
            { "id": 1, "label": "Save", "type": "button", "bbox": [100, 200, 150, 220] },
            { "id": 2, "label": "File", "type": "menu", "bbox": [0, 0, 50, 25] }
          ],
          "parse_time_ms": 300
        }
        """;
        var client = new OmniParserClient(MockHttp(HttpStatusCode.OK, json), Settings());

        var result = await client.ParseAsync("base64img", 1280, 720);

        Assert.NotNull(result);
        Assert.Equal(2, result!.Elements.Count);
        Assert.Equal("Save", result.Elements[0].Label);
        Assert.Equal(125, result.Elements[0].CenterX);
        Assert.Equal(210, result.Elements[0].CenterY);
        Assert.Equal(300, result.ParseTimeMs);
    }

    [Fact]
    public async Task ParseAsync_ReturnsNull_OnHttpError()
    {
        var client = new OmniParserClient(MockHttp(HttpStatusCode.InternalServerError, "err"), Settings());

        var result = await client.ParseAsync("base64img", 1280, 720);

        Assert.Null(result);
    }

    [Fact]
    public async Task ParseAsync_ReturnsNull_OnTimeout()
    {
        var handler = new SlowHandler();
        var http = new HttpClient(handler);
        var client = new OmniParserClient(http, Settings());

        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));
        var result = await client.ParseAsync("base64img", 1280, 720, cts.Token);

        Assert.Null(result);
    }

    [Fact]
    public async Task ParseAsync_ReturnsNull_WhenUrlEmpty()
    {
        var client = new OmniParserClient(MockHttp(HttpStatusCode.OK, "{}"), Settings(url: ""));

        var result = await client.ParseAsync("base64img", 1280, 720);

        Assert.Null(result);
    }

    // ─── Test helpers ──────────────────────────────────────────────

    private class FakeHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly string _body;
        public FakeHandler(HttpStatusCode status, string body) { _status = status; _body = body; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            return Task.FromResult(new HttpResponseMessage(_status)
            {
                Content = new StringContent(_body, Encoding.UTF8, "application/json")
            });
        }
    }

    private class SlowHandler : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            await Task.Delay(TimeSpan.FromSeconds(10), ct);
            return new HttpResponseMessage(HttpStatusCode.OK);
        }
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test tests/Tico.Tests/ --filter "FullyQualifiedName~OmniParserClientTests" -v n`
Expected: FAIL — `OmniParserClient` does not exist

- [ ] **Step 3: Implement `OmniParserClient`**

```csharp
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Tico.App.Config;

namespace Tico.App.Services;

public class OmniParserClient : IOmniParserClient
{
    private readonly HttpClient _http;
    private readonly AppSettings _settings;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public OmniParserClient(HttpClient http, AppSettings settings)
    {
        _http = http;
        _settings = settings;
    }

    public async Task<OmniParseResult?> ParseAsync(
        string imageBase64, int width, int height, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_settings.OmniParserUrl))
            return null;

        try
        {
            var payload = JsonSerializer.Serialize(
                new { image = imageBase64, width, height }, JsonOpts);

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"{_settings.OmniParserUrl.TrimEnd('/')}/parse")
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json"),
            };

            if (!string.IsNullOrEmpty(_settings.OmniParserApiKey))
                request.Headers.Add("X-Api-Key", _settings.OmniParserApiKey);

            var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync(ct);
            return JsonSerializer.Deserialize<OmniParseResult>(json, JsonOpts);
        }
        catch (OperationCanceledException) { return null; }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"OmniParser: {ex.Message}");
            return null;
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test tests/Tico.Tests/ --filter "FullyQualifiedName~OmniParserClientTests" -v n`
Expected: 4 passed

- [ ] **Step 5: Commit**

```
git add src/Tico.App/Services/OmniParserClient.cs tests/Tico.Tests/Services/OmniParserClientTests.cs
git commit -m "feat: implement OmniParserClient with tests"
```

---

### Task 4: Implement `ElementListFormatter`

**Files:**
- Create: `src/Tico.App/Services/ElementListFormatter.cs`
- Create: `tests/Tico.Tests/Services/ElementListFormatterTests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test tests/Tico.Tests/ --filter "FullyQualifiedName~ElementListFormatterTests" -v n`
Expected: FAIL — `ElementListFormatter` does not exist

- [ ] **Step 3: Implement `ElementListFormatter`**

```csharp
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test tests/Tico.Tests/ --filter "FullyQualifiedName~ElementListFormatterTests" -v n`
Expected: 5 passed

- [ ] **Step 5: Commit**

```
git add src/Tico.App/Services/ElementListFormatter.cs tests/Tico.Tests/Services/ElementListFormatterTests.cs
git commit -m "feat: implement ElementListFormatter with truncation"
```

---

### Task 5: Add `ParsePointTagV2` to `PointingManager`

**Files:**
- Modify: `src/Tico.App/Services/PointingManager.cs`
- Create: `tests/Tico.Tests/Services/PointingManagerV2Tests.cs`

- [ ] **Step 1: Write failing tests**

```csharp
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test tests/Tico.Tests/ --filter "FullyQualifiedName~PointingManagerV2Tests" -v n`
Expected: FAIL — `ParsePointTagV2` does not exist

- [ ] **Step 3: Implement `ParsePointTagV2`**

Add this method to `src/Tico.App/Services/PointingManager.cs`, after the existing `MapToScreen` method (line 61):

```csharp
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test tests/Tico.Tests/ --filter "FullyQualifiedName~PointingManagerV2Tests" -v n`
Expected: 6 passed

- [ ] **Step 5: Commit**

```
git add src/Tico.App/Services/PointingManager.cs tests/Tico.Tests/Services/PointingManagerV2Tests.cs
git commit -m "feat: add ParsePointTagV2 for OmniParser element ID matching"
```

---

### Task 6: Update `CompanionManager` — replace ElementLocationService with OmniParser

**Files:**
- Modify: `src/Tico.App/Core/CompanionManager.cs`

This is the largest change. The orchestrator needs to:
1. Accept `IOmniParserClient` instead of `IElementLocationService`
2. Run OmniParser in parallel with transcription
3. Build the element list text and include it in the chat message
4. Use `ParsePointTagV2` when elements are available, fall back to `ParsePointTag`

- [ ] **Step 1: Replace `IElementLocationService` with `IOmniParserClient` in constructor**

In `CompanionManager.cs`, replace:

```csharp
    private readonly IElementLocationService? _locate;

    public CompanionManager(
        IAudioCaptureService audio,
        IScreenCaptureService screen,
        IProxyClient proxy,
        AppSettings settings,
        IElementLocationService? locate = null,
        bool enableSystemServices = true)
    {
        _audio = audio;
        _screen = screen;
        _proxy = proxy;
        _settings = settings;
        _locate = locate;
        _pointing = new PointingManager();
```

with:

```csharp
    private readonly IOmniParserClient? _omniParser;

    public CompanionManager(
        IAudioCaptureService audio,
        IScreenCaptureService screen,
        IProxyClient proxy,
        AppSettings settings,
        IOmniParserClient? omniParser = null,
        bool enableSystemServices = true)
    {
        _audio = audio;
        _screen = screen;
        _proxy = proxy;
        _settings = settings;
        _omniParser = omniParser;
        _pointing = new PointingManager();
```

- [ ] **Step 2: Add field to store parsed elements**

After the `_capturedScreen` field (line 15), add:

```csharp
    private List<ParsedElement>? _parsedElements;
```

- [ ] **Step 3: Update `OnHotkeyUpAsync` — parallel parse + transcribe**

Replace the transcription block in `OnHotkeyUpAsync` (lines 150-163):

```csharp
        try
        {
            // Transcribe
            string transcript = "";
            if (_speech is { IsAvailable: true })
                transcript = await _speech.StopListeningAsync();
            if (string.IsNullOrWhiteSpace(transcript))
                transcript = await _proxy.TranscribeAsync(audioData, ct);

            if (string.IsNullOrWhiteSpace(transcript))
            {
                SetState(CompanionState.Idle);
                return;
            }
```

with:

```csharp
        try
        {
            // Transcribe + OmniParser in parallel
            Task<string> transcribeTask;
            if (_speech is { IsAvailable: true })
            {
                var sttResult = await _speech.StopListeningAsync();
                transcribeTask = string.IsNullOrWhiteSpace(sttResult)
                    ? _proxy.TranscribeAsync(audioData, ct)
                    : Task.FromResult(sttResult);
            }
            else
            {
                transcribeTask = _proxy.TranscribeAsync(audioData, ct);
            }

            // Launch OmniParser on the focused screen while transcription runs
            Task<OmniParseResult?> parseTask = Task.FromResult<OmniParseResult?>(null);
            if (_omniParser != null && _capturedScreen != null)
            {
                var focusScreen = _capturedScreen.FocusedScreen;
                parseTask = _omniParser.ParseAsync(
                    focusScreen.ImageBase64,
                    focusScreen.ScreenshotWidth,
                    focusScreen.ScreenshotHeight, ct);
            }

            await Task.WhenAll(transcribeTask, parseTask);

            string transcript = await transcribeTask;
            var parseResult = await parseTask;
            _parsedElements = parseResult?.Elements;

            if (string.IsNullOrWhiteSpace(transcript))
            {
                SetState(CompanionState.Idle);
                return;
            }
```

- [ ] **Step 4: Build element list and include in chat context**

After the existing context-building block (after line 194 `context = $"[cursor em ...`), add the element list:

Replace:

```csharp
                context = $"[cursor em ({_capturedScreen.CursorX},{_capturedScreen.CursorY}), janela: {_capturedScreen.WindowTitle} ({_capturedScreen.ProcessName}), janela ocupa retângulo ({winX},{winY}) até ({winX + winW},{winY + winH}) no screenshot]\n{transcript}";
```

with:

```csharp
                var contextParts = new List<string>
                {
                    $"[cursor em ({_capturedScreen.CursorX},{_capturedScreen.CursorY}), janela: {_capturedScreen.WindowTitle} ({_capturedScreen.ProcessName}), janela ocupa retângulo ({winX},{winY}) até ({winX + winW},{winY + winH}) no screenshot]"
                };

                if (_parsedElements is { Count: > 0 })
                {
                    var truncated = ElementListFormatter.Truncate(
                        _parsedElements, maxElements: 200,
                        cursorX: _capturedScreen.CursorX, cursorY: _capturedScreen.CursorY);
                    var fs = _capturedScreen.FocusedScreen;
                    contextParts.Add(ElementListFormatter.Format(truncated, fs.Index + 1));
                }

                contextParts.Add(transcript);
                context = string.Join("\n\n", contextParts);
```

- [ ] **Step 5: Update system prompt — add v2 pointing instructions**

Replace the pointing format instructions in `SystemPrompt` (around lines 70-78). Replace:

```csharp
        formato: [POINT:x,y:label] onde x,y são coordenadas inteiras em pixels no espaço do screenshot, e label é uma descrição curta de 1-3 palavras do elemento.

        se apontar não ajudaria, coloque [POINT:none].

        exemplos:
        - usuário pergunta como fazer color grading no davinci: "você vai querer abrir o painel de cores — tá ali em cima na direita da toolbar. clica lá e vai ter todas as rodas de cor e curvas. [POINT:1100,42:painel de cores]"
        - usuário pergunta o que é html: "html é hypertext markup language, basicamente o esqueleto de toda página web. curioso como conecta com o css que você tá olhando? [POINT:none]"
```

with:

```csharp
        formato de apontamento:
        - se a mensagem incluir uma lista [UI Elements], use os IDs da lista: [POINT:id:label] onde id é o número do elemento e label é uma descrição curta. NÃO invente coordenadas — use apenas IDs da lista fornecida.
        - se NÃO houver lista de elementos, use coordenadas: [POINT:x,y:label] onde x,y são pixels no espaço do screenshot.
        - se apontar não ajudaria, coloque [POINT:none].

        exemplos com lista de elementos:
        - usuário pergunta como fazer color grading no davinci: "você vai querer abrir o painel de cores — tá ali em cima na direita da toolbar. [POINT:15:painel de cores]"

        exemplos sem lista de elementos:
        - usuário pergunta como fazer color grading no davinci: "você vai querer abrir o painel de cores — tá ali em cima na direita da toolbar. [POINT:1100,42:painel de cores]"

        - usuário pergunta o que é html: "html é hypertext markup language, basicamente o esqueleto de toda página web. curioso como conecta com o css que você tá olhando? [POINT:none]"
```

- [ ] **Step 6: Update pointing logic — use ParsePointTagV2 when elements available**

Replace the pointing section (lines 243-310):

```csharp
            // Parse pointing coordinates
            var (spokenText, pointX, pointY, pointLabel, pointScreenIdx) = PointingManager.ParsePointTag(responseText);
            History.AddAssistantMessage(responseText);

            SetState(CompanionState.Speaking);

            // Start locate in parallel with audio playback
            Task<(int X, int Y)?> locateResultTask = Task.FromResult<(int X, int Y)?>(null);
            CapturedScreen? targetScreen = null;

            if (pointX >= 0 && pointY >= 0 && _capturedScreen != null)
            {
                targetScreen = pointScreenIdx is int idx
                    && idx >= 1
                    && idx <= _capturedScreen.Screens.Count
                        ? _capturedScreen.Screens[idx - 1]
                        : _capturedScreen.FocusedScreen;

                if (_locate != null && !string.IsNullOrEmpty(pointLabel))
                {
                    var locateCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                    locateCts.CancelAfter(TimeSpan.FromSeconds(5));
                    locateResultTask = _locate.LocateElementAsync(
                        targetScreen.ImageBase64,
                        targetScreen.ScreenshotWidth,
                        targetScreen.ScreenshotHeight,
                        pointLabel, locateCts.Token);
                }
            }

            // Start audio playback in background — buddy moves in parallel
            var audioPlaybackTask = PlayAudioChunksAsync(ttsTasks, ct);

            // Handle pointing immediately — don't wait for audio to finish
            if (pointX >= 0 && pointY >= 0 && targetScreen != null)
            {
                var (fallbackX, fallbackY) = PointingManager.MapToScreen(pointX, pointY, targetScreen);
                int finalX = fallbackX, finalY = fallbackY;

                // Give locate a brief window to improve accuracy, but don't block movement too long
                var graceDelay = Task.Delay(500, ct);
                var completed = await Task.WhenAny(locateResultTask, graceDelay);

                if (completed == locateResultTask)
                {
                    try
                    {
                        var locResult = await locateResultTask;
                        if (locResult is var (locX, locY))
                        {
                            var (sx, sy) = PointingManager.MapToScreen(locX, locY, targetScreen);
                            finalX = sx;
                            finalY = sy;
                            System.Diagnostics.Debug.WriteLine($"LOCATE: ({locX},{locY}) → screen({finalX},{finalY})");
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"LOCATE: failed ({ex.Message}), using fallback");
                    }
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"LOCATE: not ready in 500ms, using fallback coords");
                }

                System.Diagnostics.Debug.WriteLine($"POINT: final ({finalX},{finalY}) [label={pointLabel}]");
                PointAtElement?.Invoke(finalX, finalY, pointLabel);
            }
```

with:

```csharp
            // Parse pointing — try v2 (ID-based) first if we have elements, fall back to v1 (coordinate-based)
            int pointX = -1, pointY = -1;
            string? pointLabel = null;
            int? pointScreenIdx = null;

            if (_parsedElements is { Count: > 0 })
            {
                var v2 = PointingManager.ParsePointTagV2(responseText, _parsedElements);
                if (v2 != null)
                {
                    pointX = v2.Value.X;
                    pointY = v2.Value.Y;
                    pointLabel = v2.Value.Label;
                    pointScreenIdx = v2.Value.ScreenIndex;
                }
            }
            else
            {
                var v1 = PointingManager.ParsePointTag(responseText);
                pointX = v1.X;
                pointY = v1.Y;
                pointLabel = v1.Label;
                pointScreenIdx = v1.ScreenIndex;
            }

            History.AddAssistantMessage(responseText);
            SetState(CompanionState.Speaking);

            // Start audio playback in background — buddy moves in parallel
            var audioPlaybackTask = PlayAudioChunksAsync(ttsTasks, ct);

            // Handle pointing
            if (pointX >= 0 && pointY >= 0 && _capturedScreen != null)
            {
                var targetScreen = pointScreenIdx is int idx
                    && idx >= 1
                    && idx <= _capturedScreen.Screens.Count
                        ? _capturedScreen.Screens[idx - 1]
                        : _capturedScreen.FocusedScreen;

                var (finalX, finalY) = PointingManager.MapToScreen(pointX, pointY, targetScreen);
                System.Diagnostics.Debug.WriteLine($"POINT: ({pointX},{pointY}) → screen({finalX},{finalY}) [label={pointLabel}]");
                PointAtElement?.Invoke(finalX, finalY, pointLabel);
            }
```

- [ ] **Step 7: Verify it compiles**

Run: `dotnet build src/Tico.App/Tico.App.csproj`
Expected: Build succeeded

- [ ] **Step 8: Commit**

```
git add src/Tico.App/Core/CompanionManager.cs
git commit -m "feat: integrate OmniParser into CompanionManager, remove ElementLocationService dependency"
```

---

### Task 7: Update `App.xaml.cs` — wire OmniParser, remove ElementLocationService

**Files:**
- Modify: `src/Tico.App/App.xaml.cs`

- [ ] **Step 1: Replace ElementLocationService with OmniParserClient in DI**

In `App.xaml.cs`, replace lines 65-70:

```csharp
        _proxy = new ProxyClient(http, _settings, _sessionManager);
        var locate = new ElementLocationService(http, _settings, _sessionManager);
        var audio = new AudioCaptureService();
        var screen = new ScreenCaptureService();

        _manager = new CompanionManager(audio, screen, _proxy, _settings, locate);
```

with:

```csharp
        _proxy = new ProxyClient(http, _settings, _sessionManager);
        var omniParser = !string.IsNullOrEmpty(_settings.OmniParserUrl)
            ? new OmniParserClient(http, _settings)
            : null;
        var audio = new AudioCaptureService();
        var screen = new ScreenCaptureService();

        _manager = new CompanionManager(audio, screen, _proxy, _settings, omniParser);
```

- [ ] **Step 2: Remove the `using Tico.App.Helpers;` if it was only for ImageHelper used by locate (check — likely still needed for AudioHelper)**

Check: `Tico.App.Helpers` is used at line 122 for `AudioHelper.StopPlayback()` — keep it.

No using changes needed. Remove the now-unused `ElementLocationService` import if the compiler warns.

- [ ] **Step 3: Verify it compiles**

Run: `dotnet build src/Tico.App/Tico.App.csproj`
Expected: Build succeeded

- [ ] **Step 4: Commit**

```
git add src/Tico.App/App.xaml.cs
git commit -m "feat: wire OmniParserClient in App.xaml.cs DI"
```

---

### Task 8: Delete `ElementLocationService.cs`

**Files:**
- Delete: `src/Tico.App/Services/ElementLocationService.cs`

- [ ] **Step 1: Delete the file**

```
rm src/Tico.App/Services/ElementLocationService.cs
```

- [ ] **Step 2: Verify the solution compiles**

Run: `dotnet build src/Tico.App/Tico.App.csproj`
Expected: Build succeeded (no remaining references to `IElementLocationService` or `ElementLocationService`)

- [ ] **Step 3: Commit**

```
git add -u src/Tico.App/Services/ElementLocationService.cs
git commit -m "chore: remove ElementLocationService (replaced by OmniParser)"
```

---

### Task 9: Update `CompanionManagerTests`

**Files:**
- Modify: `tests/Tico.Tests/Core/CompanionManagerTests.cs`

- [ ] **Step 1: Update the test to mock `IOmniParserClient` instead of `IElementLocationService`**

Replace the full file contents:

```csharp
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
}
```

- [ ] **Step 2: Run all tests**

Run: `dotnet test tests/Tico.Tests/ -v n`
Expected: All tests pass

- [ ] **Step 3: Commit**

```
git add tests/Tico.Tests/Core/CompanionManagerTests.cs
git commit -m "test: update CompanionManagerTests for OmniParser integration"
```

---

### Task 10: Remove `/locate` from proxy

**Files:**
- Modify: `proxy/local-server.js`

- [ ] **Step 1: Remove the `/locate` route from the switch**

In `local-server.js`, remove lines 100-101:

```javascript
      case "/locate":
        return await handleLocate(req, res, userId);
```

- [ ] **Step 2: Remove the `handleLocate` function**

Delete the entire function block (lines 375-444):

```javascript
// ─── /locate → Precision vision call (not metered) ──────────────────

async function handleLocate(req, res, userId) {
  ...
}
```

- [ ] **Step 3: Verify the proxy starts**

Run: `node proxy/local-server.js`
Expected: Server starts without errors on port 3000. Ctrl+C to stop.

- [ ] **Step 4: Commit**

```
git add proxy/local-server.js
git commit -m "chore: remove /locate endpoint from proxy (replaced by OmniParser)"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run full build**

Run: `dotnet build src/Tico.App/Tico.App.csproj`
Expected: Build succeeded, 0 warnings related to removed types

- [ ] **Step 2: Run all tests**

Run: `dotnet test tests/Tico.Tests/ -v n`
Expected: All tests pass (existing + new)

- [ ] **Step 3: Verify no dangling references to ElementLocationService**

Search the codebase for `ElementLocation` or `IElementLocation` — should find zero hits in `.cs` files (only in git history and this plan doc).

Run: `grep -r "ElementLocation" src/ tests/ --include="*.cs"`
Expected: No matches

- [ ] **Step 4: Commit (if any fixups needed)**

Only if previous steps required fixes.
