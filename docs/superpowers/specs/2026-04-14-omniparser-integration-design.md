# OmniParser v2 Integration Design

**Date:** 2026-04-14
**Status:** Approved

## Goal

Replace Claude Vision-based element detection with Microsoft OmniParser v2, a local/serverless model that identifies UI elements (bounding boxes + labels) from screenshots. This eliminates the `/locate` precision endpoint (second Claude Vision call), reduces cost, and improves pointing accuracy — especially in dense UIs like Blender and DaVinci Resolve.

## Decisions

| Decision | Choice |
|---|---|
| What OmniParser replaces | Both `/locate` AND element identification — Claude receives a pre-parsed element list |
| Claude still receives image? | Yes — image + element list together |
| `/locate` endpoint | Eliminated — replaced by ID match from OmniParser list |
| OmniParser runs where | Serverless GPU (Replicate, RunPod, or Modal) |
| Pointing format | `[POINT:id:label]` — Claude references element IDs, not pixel coordinates |
| Parallelism | OmniParser runs in parallel with Whisper transcription — zero added latency |
| Fallback | If OmniParser fails, reverts to current flow (`[POINT:x,y:label]`, no element list) |

## Architecture

### New Flow

```
User releases F8
       |
  ┌────┴────┐
  │ Parallel │
  ├──────────┤
  │ Whisper  │  <- transcribe audio (unchanged)
  │OmniParser│  <- parse screenshot -> element list
  └────┬────┘
       |
  Both complete
       |
  WPF builds ChatMessage:
    - image (base64 JPEG, as today)
    - element list (text): "#1 "Save" button [120,45,180,65]\n..."
    - audio transcription
    - context (cursor, active window, etc.)
       |
  POST /chat to proxy (as today)
       |
  Proxy injects updated system prompt:
    "Use [POINT:id:label] referencing element IDs from the list"
       |
  Claude responds with text + [POINT:3:Save button]
       |
  WPF parses [POINT:id:label],
  looks up ID in OmniParser list -> bbox center
       |
  MapToScreen (as today) -> BuddyCursor flies there
```

### What Changes

| Component | Before | After |
|---|---|---|
| `ScreenCaptureService` | Capture + return base64 | No change |
| `CompanionManager` | capture -> transcribe -> chat -> locate | capture -> (transcribe \|\| parse) -> chat -> match ID |
| `ProxyClient` | Sends image + text | Sends image + text + element list |
| `ElementLocationService` | Calls `/locate` (2nd Claude call) | **Removed** — replaced by local ID match |
| `PointingManager` | ParsePointTag with `x,y` | ParsePointTagV2 with `id` + lookup in list |
| System prompt | "Return [POINT:x,y:label]" | "Return [POINT:id:label] from element list" |
| `/locate` endpoint | Exists in proxy | **Removed** |
| New: `IOmniParserClient` | — | Calls serverless GPU, returns element list |
| New: `ParsedElement` | — | Record with Id, Label, Type, BBox |

### What Does NOT Change

- Screen capture (ScreenCaptureService)
- Audio transcription
- TTS / voice response
- Auth / tiers / usage tracking
- BuddyCursor / flight animation
- ConversationHistory

## OmniParser Service

### Endpoint

```
POST /parse
Content-Type: application/json

{
  "image": "<base64 JPEG>",
  "width": 1280,
  "height": 720
}
```

### Response

```json
{
  "elements": [
    { "id": 1, "label": "Save", "type": "button", "bbox": [120, 45, 180, 65] },
    { "id": 2, "label": "File", "type": "menu", "bbox": [0, 0, 50, 25] },
    { "id": 3, "label": "search query", "type": "textbox", "bbox": [200, 10, 400, 35] }
  ],
  "parse_time_ms": 340
}
```

- `bbox` = `[x1, y1, x2, y2]` in screenshot pixel space (same coordinate space Tico already uses)
- `type` = element category from OmniParser (button, icon, textbox, menu, etc.)
- `label` = visible text or icon description from OmniParser OCR + detection
- Expected latency: ~300-500ms on T4/A10G (runs in parallel with Whisper, so zero added latency)
- Multi-monitor: each screen's screenshot is parsed separately, element IDs are globally unique across screens (screen 1: #1-#N, screen 2: #N+1-#M, etc.)

### Auth

Simple API key in header (`X-Api-Key`). Stored as environment variable in WPF. Cost is Tico's, not per-user.

### Platform Agnostic

Design is agnostic to provider. The contract is the `/parse` endpoint above. Initial implementation can be any serverless GPU provider. Migration = change URL.

## WPF Changes

### New: `IOmniParserClient` / `OmniParserClient`

```csharp
// Namespace: Tico.App.Services
public record ParsedElement(int Id, string Label, string Type, int[] BBox);
public record OmniParseResult(List<ParsedElement> Elements, int ParseTimeMs);

public interface IOmniParserClient
{
    Task<OmniParseResult?> ParseAsync(string imageBase64, int width, int height, CancellationToken ct);
}
```

- Calls `POST /parse` on serverless GPU
- Returns `null` on failure (timeout, error) — graceful fallback
- Configurable timeout (default 3s)

### CompanionManager Changes

`OnHotkeyUpAsync` dispatches two parallel tasks:
1. `transcribeTask` = transcribe audio (existing)
2. `parseTask` = `IOmniParserClient.ParseAsync(screenshot)`

After `Task.WhenAll`:
- If `parseTask` returned result -> include element list in `ChatMessage`
- If `parseTask` failed -> send without list (Claude works as today with `[POINT:x,y:label]`)

### ChatMessage Changes

New optional field:

```csharp
public string? ElementListText { get; set; }
```

### ProxyClient Changes

`StreamChatAsync` content array: if `ElementListText` is not null, insert as text block before user transcription.

### PointingManager Changes

New method:

```csharp
// Before: [POINT:x,y:label] or [POINT:x,y:label:screenN]
// After:  [POINT:id:label]  or [POINT:id:label:screenN]

public static ParsedPointTag? ParsePointTagV2(string response, List<ParsedElement> elements)
```

- Parses `[POINT:id:label]` — extracts `id` (int)
- Looks up `id` in `ParsedElement` list
- Computes bbox center: `cx = (x1+x2)/2`, `cy = (y1+y2)/2`
- Returns coordinates in screenshot space (as today)
- If `id` not found -> fallback: fuzzy match by label

### Removal

- `IElementLocationService` and `ElementLocationService` removed
- DI references in `App.xaml.cs` removed
- `/locate` references in `CompanionManager` removed

## Element List Format in Prompt

```
[UI Elements - screen 1]
#1 "File" menu [0,0,50,25]
#2 "Edit" menu [51,0,100,25]
#3 "Save" button [120,45,180,65]
#4 "search query" textbox [200,10,400,35]
#5 icon:gear [950,5,970,25]
...

[UI Elements - screen 2]
#38 "Timeline" panel [0,600,1280,720]
...
```

- `#id` prefix for direct match with `[POINT:id:label]`
- Label in quotes for visible text, `icon:description` for icons without text
- Element type after label
- BBox at end — Claude uses it for relative position understanding
- Grouped by screen (multi-monitor)

### Truncation

If OmniParser returns >200 elements, truncate farthest from cursor (using cursor position from `MultiScreenContext`).

### Token Estimate

- Typical UIs (30-80 elements): ~150-800 tokens
- Dense UIs (100-200 elements): ~500-2000 tokens
- Compared to ~1600 tokens for a 1280px image, the list is similar or smaller

## Proxy Changes

### System Prompt

Two variants, selected based on presence of element list in request:

**With element list (OmniParser available):**
```
When pointing to UI elements, reference them by their ID from the [UI Elements] list.
Format: [POINT:id:label] — where id is the element number from the list.
Example: [POINT:3:Save button]
If the element you want is not in the list, use [POINT:none].
Do NOT guess coordinates. Only use IDs from the provided list.
```

**Without element list (fallback):**
Current system prompt, unchanged (`[POINT:x,y:label]`).

### `/chat` Endpoint

- Receives new optional field in body: `elementList` (string or null)
- If present -> uses system prompt v2 (with IDs)
- If absent -> uses system prompt v1 (as today)

### `/locate` Endpoint

Removed from `local-server.js` and `worker.js`.

## Fallback (Graceful Degradation)

If OmniParser fails (timeout, service down):
1. `parseTask` returns `null`
2. No element list included in chat
3. System prompt uses v1 instructions (`[POINT:x,y:label]`)
4. `PointingManager` detects old format and uses existing `ParsePointTag`
5. Experience identical to today — zero breakage

## Tests

### New Unit Tests

| Test | Validates |
|---|---|
| `OmniParserClient_ParseAsync_ReturnsElements` | Deserializes JSON response correctly |
| `OmniParserClient_ParseAsync_ReturnsNull_OnTimeout` | Timeout -> null, no exception |
| `OmniParserClient_ParseAsync_ReturnsNull_OnError` | HTTP 500 -> null, no exception |
| `PointingManager_ParsePointTagV2_MatchesById` | `[POINT:3:Save]` + list -> bbox center of #3 |
| `PointingManager_ParsePointTagV2_FuzzyFallback` | ID not found -> tries label match |
| `PointingManager_ParsePointTagV2_PointNone` | `[POINT:none]` -> no coordinates |
| `PointingManager_ParsePointTagV2_MultiScreen` | `[POINT:3:Save:screen2]` -> correct screen index |
| `FormatElementList_TypicalUI` | 50 elements -> correct text format |
| `FormatElementList_TruncatesAt200` | 250 elements -> truncates to 200, prioritizing near cursor |
| `CompanionManager_FallbackWithoutOmniParser` | Parse returns null -> uses v1 flow |

### Affected Existing Tests

- `PointingManager.ParsePointTag` tests — kept (v1 format still used in fallback)
- `ElementLocationService` tests — removed with the service
- `CompanionManager` tests mocking `IElementLocationService` — updated to mock `IOmniParserClient`

### No Integration Tests with Real OmniParser

GPU service is external. Unit tests mock HttpClient. Real OmniParser testing is manual or a separate smoke test.

## Cost Impact

| Item | Before | After |
|---|---|---|
| Main chat (image) | ~1600 tokens | ~1600 tokens (no change) |
| Main chat (element list) | — | ~150-2000 tokens (new) |
| `/locate` (2nd Claude Vision call) | ~1600 tokens + output | **Eliminated** |
| OmniParser (serverless GPU) | — | ~$0.001-0.005 per parse |

**Net result:** Eliminates entire second Claude Vision call. OmniParser cost per inference is orders of magnitude lower. Text list adds few tokens. Pointing accuracy improves significantly, especially in dense UIs.
