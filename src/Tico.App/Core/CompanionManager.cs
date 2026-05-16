using Tico.App.Config;
using Tico.App.Services;

namespace Tico.App.Core;

public class CompanionManager
{
    private readonly IAudioCaptureService _audio;
    private readonly IScreenCaptureService _screen;
    private readonly IProxyClient _proxy;
    private readonly AppSettings _settings;
    private readonly PointingManager _pointing;
    private readonly WindowsSpeechService? _speech;

    private MultiScreenContext? _capturedScreen;
    private List<ParsedElement>? _parsedElements;
    private CancellationTokenSource? _cts;

    public CompanionState State { get; private set; } = CompanionState.Idle;
    public ConversationHistory History { get; } = new();

    // State events
    public event Action<CompanionState>? StateChanged;
    public event Action? DismissOverlay;

    // Pointing events
    public event Action<double, double, string?>? PointAtElement;  // screenX, screenY, bubbleText
    public event Action? ReturnToCursor;

    // Audio power for waveform (forwarded from the audio capture service)
    public event Action<double>? AudioPowerUpdated;

    // Surface a short message to the user via the buddy bubble (e.g. usage limit hit)
    public event Action<string>? ShowMessage;

    // Chat history: emits the user's raw transcript + clean response (no POINT tags)
    public event Action<string, string>? ChatEntryCompleted;

    private static readonly string SystemPrompt = """
        you are tico, a friendly companion that lives on the user's screen.
        the user just spoke to you via push-to-talk and you can see their screen.
        your response will be spoken aloud via text-to-speech, so write the way you would speak.
        this is an ongoing conversation — you remember everything they said before.

        CRITICAL language rule: detect the language of the user's message and ALWAYS respond in that same language. if they speak portuguese, respond in portuguese. if they speak english, respond in english. if they speak spanish, respond in spanish. match their language exactly. your personality stays the same in every language.

        rules:
        - by default, one or two sentences. be direct and dense. BUT if the user asks you to explain more, elaborate, or go deeper, go deep — give a complete and detailed explanation with no size limit.
        - all lowercase, casual, friendly. no emojis.
        - write for the ear, not the eye. short sentences. no lists, bullet points, markdown, or formatting — just natural speech.
        - don't use abbreviations or symbols that sound weird read aloud. write "for example" not "e.g.", spell out small numbers.
        - if the user's question relates to what's on screen, reference specific things you see.
        - if the screenshot doesn't seem relevant to the question, just answer the question directly.
        - you can help with anything — code, writing, general knowledge, brainstorming.
        - never say "simply" or "just".
        - don't read code literally. describe what the code does or what needs to change conversationally.
        - focus on giving a useful and complete explanation. don't end with simple yes/no questions like "want me to explain more?" — those are dead ends.
        - instead, when it makes sense, end by planting a seed — mention something bigger or more ambitious they could try, a related concept that goes deeper, or a next-level technique. make it something worth coming back to explore.
        - if you receive multiple screen images, the one marked as "main focus" is where the cursor is — prioritize it but reference others if relevant.
        - you also receive a detail crop of the active window at higher resolution. use this image to identify small icons and buttons accurately — it shows the same elements but with more clarity.
        - when you identify the app on screen (by window title or interface), use your prior knowledge of that software's layout to validate what you're seeing. for example, if you know blender's properties panel has icons in a specific order, use that info to confirm which icon is which — don't rely only on pixels. combine vision + knowledge.
        - if you can't clearly distinguish between small icons even with the detail image, say you're not sure instead of guessing. describe what you're looking for and what you see.

        element pointing:
        you have a small companion cursor that can fly to and point at things on screen.
        use it whenever pointing would genuinely help the user — if they're asking how to do something, looking for a menu, trying to find a button, or need help navigating an app, point to the relevant element.

        when in doubt, point. it's much better to point and help than to not point and leave the user searching alone. only use [POINT:none] when the conversation genuinely has nothing to do with the screen.

        always aim at the center of the clickable element — the exact spot the user would click. don't point at the edge, the text label next to it, or the empty space between buttons.

        in apps with many small buttons like blender, davinci resolve, vs code — pay extra attention to the exact position. dense toolbars have elements twenty to thirty pixels wide. look carefully at the correct icon or button and aim at its center, not the neighbor.

        the context includes the exact rectangle of the active window in the screenshot (e.g.: "window occupies rectangle (100,50) to (900,650)"). when pointing at something inside the active window, your coordinates MUST fall within that rectangle. use this to locate the correct window in the image, especially when there are multiple overlapping windows.

        when pointing, place the coordinate tag at the end of the response, AFTER the spoken text. the screenshot images are labeled with their pixel dimensions. use those dimensions as coordinate space. origin (0,0) is the top-left corner. x increases to the right, y increases downward.

        pointing format:
        - if the message includes a [UI Elements] list, use IDs from the list: [POINT:id:label] where id is the element number and label is a short description. DO NOT invent coordinates — only use IDs from the provided list.
        - if there is NO element list, use coordinates: [POINT:x,y:label] where x,y are pixels in the screenshot space.
        - if pointing wouldn't help, use [POINT:none].

        examples with element list:
        - user asks how to color grade in davinci: "you'll want to open the color panel — it's up there on the right side of the toolbar. [POINT:15:color panel]"

        examples without element list:
        - user asks how to color grade in davinci: "you'll want to open the color panel — it's up there on the right side of the toolbar. [POINT:1100,42:color panel]"

        - user asks what html is: "html is hypertext markup language, basically the skeleton of every web page. curious how it connects with the css you're looking at? [POINT:none]"
        """;

    private readonly IOmniParserClient? _omniParser;

    private static readonly string LogPath = System.IO.Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Tico", "debug.log");

    private static void Log(string msg)
    {
        try { System.IO.File.AppendAllText(LogPath, $"[{DateTime.Now:HH:mm:ss}] {msg}\n"); } catch { }
    }

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

        // Forward audio level updates so the buddy waveform can react to real input.
        _audio.AudioPowerChanged += power => AudioPowerUpdated?.Invoke(power);

        if (enableSystemServices)
        {
            _speech = new WindowsSpeechService();
        }
    }

    public void CancelCurrentOperation()
    {
        _cts?.Cancel();
        SetState(CompanionState.Idle);
    }

    public void OnHotkeyDown()
    {
        if (State == CompanionState.Speaking)
        {
            _cts?.Cancel();
            DismissOverlay?.Invoke();
            ReturnToCursor?.Invoke();
        }

        // Capture screen + start recording simultaneously
        try
        {
            _capturedScreen = _screen.CaptureScreen();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Screen capture failed: {ex.Message}");
            _capturedScreen = null;
        }
        _audio.StartRecording();

        if (_speech is { IsAvailable: true })
            _ = _speech.StartListeningAsync();

        SetState(CompanionState.Recording);
    }

    public async Task OnHotkeyUpAsync()
    {
        if (State != CompanionState.Recording) return;

        var audioData = _audio.StopRecording();
        Log($"Audio captured: {audioData?.Length ?? 0} bytes");
        _cts = new CancellationTokenSource();
        var ct = _cts.Token;

        SetState(CompanionState.Processing);

        try
        {
            // Transcribe + OmniParser in parallel
            Log($"Speech available: {_speech?.IsAvailable}, ProxyBaseUrl: {_settings.ProxyBaseUrl}");
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

            // Launch OmniParser on the focused screen while transcription runs (3s timeout)
            Task<OmniParseResult?> parseTask = Task.FromResult<OmniParseResult?>(null);
            if (_omniParser != null && _capturedScreen != null)
            {
                var parseCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                parseCts.CancelAfter(TimeSpan.FromSeconds(3));
                var focusScreen = _capturedScreen.FocusedScreen;
                parseTask = _omniParser.ParseAsync(
                    focusScreen.ImageBase64,
                    focusScreen.ScreenshotWidth,
                    focusScreen.ScreenshotHeight, parseCts.Token);
            }

            await Task.WhenAll(transcribeTask, parseTask);

            string transcript = await transcribeTask;
            var parseResult = await parseTask;
            _parsedElements = parseResult?.Elements;

            if (string.IsNullOrWhiteSpace(transcript))
            {
                Log("Empty transcript — going idle");
                SetState(CompanionState.Idle);
                return;
            }

            Log($"Transcript: {transcript}");

            // Build labeled images and context text for Claude
            List<LabeledImage>? images = null;
            string context = transcript;
            if (_capturedScreen != null)
            {
                images = _capturedScreen.Screens.Select(s =>
                {
                    var focusTag = s.IsFocus ? " (foco principal)" : "";
                    var label = $"screen {s.Index + 1}{focusTag} — {s.ScreenshotWidth}x{s.ScreenshotHeight} pixels";
                    return new LabeledImage(label, s.ImageBase64);
                }).ToList();

                // Add high-detail crop of the active window
                if (_capturedScreen.ActiveWindowImageBase64 != null)
                {
                    var cropLabel = $"janela ativa em detalhe — {_capturedScreen.ActiveWindowCropWidth}x{_capturedScreen.ActiveWindowCropHeight} pixels (use esta imagem pra identificar elementos pequenos como ícones e botões)";
                    images.Add(new LabeledImage(cropLabel, _capturedScreen.ActiveWindowImageBase64));
                }

                // Convert window bounds to screenshot pixel space so Claude knows
                // exactly where the active window is in the image
                var fs = _capturedScreen.FocusedScreen;
                int winX = (int)((_capturedScreen.WindowLeft - fs.ScreenOffsetX) * (double)fs.ScreenshotWidth / fs.ScreenLogicalWidth);
                int winY = (int)((_capturedScreen.WindowTop - fs.ScreenOffsetY) * (double)fs.ScreenshotHeight / fs.ScreenLogicalHeight);
                int winW = (int)(_capturedScreen.WindowWidth * (double)fs.ScreenshotWidth / fs.ScreenLogicalWidth);
                int winH = (int)(_capturedScreen.WindowHeight * (double)fs.ScreenshotHeight / fs.ScreenLogicalHeight);

                var contextParts = new List<string>
                {
                    $"[cursor em ({_capturedScreen.CursorX},{_capturedScreen.CursorY}), janela: {_capturedScreen.WindowTitle} ({_capturedScreen.ProcessName}), janela ocupa retângulo ({winX},{winY}) até ({winX + winW},{winY + winH}) no screenshot]"
                };

                if (_parsedElements is { Count: > 0 })
                {
                    var truncated = ElementListFormatter.Truncate(
                        _parsedElements, maxElements: 200,
                        cursorX: _capturedScreen.CursorX, cursorY: _capturedScreen.CursorY);
                    contextParts.Add(ElementListFormatter.Format(truncated, fs.Index + 1));
                }

                contextParts.Add(transcript);
                context = string.Join("\n\n", contextParts);
            }

            History.AddUserMessage(context, images);

            // Stream Claude response — fire TTS per sentence for low latency
            var fullResponse = new System.Text.StringBuilder();
            var sentenceBuffer = new System.Text.StringBuilder();
            var ttsTasks = new List<Task<byte[]>>();

            await foreach (var token in _proxy.StreamChatAsync(
                SystemPrompt, History.Messages, _settings.ClaudeModel, ct))
            {
                fullResponse.Append(token);
                sentenceBuffer.Append(token);

                // Detect sentence boundary: ". " or "? " or "! "
                var buf = sentenceBuffer.ToString();
                int splitIdx = FindSentenceEnd(buf);
                if (splitIdx >= 0)
                {
                    var sentence = buf[..(splitIdx + 1)].Trim();
                    sentenceBuffer.Clear();
                    sentenceBuffer.Append(buf[(splitIdx + 1)..]);

                    if (sentence.Length > 0)
                    {
                        ttsTasks.Add(_proxy.SynthesizeSpeechAsync(sentence, _settings.TtsVoice, ct));

                        // Start playing as soon as first sentence is ready
                        if (ttsTasks.Count == 1)
                            SetState(CompanionState.Speaking);
                    }
                }
            }

            // Flush remaining buffer — strip POINT tag before sending to TTS
            var remaining = sentenceBuffer.ToString().Trim();
            var pointTagMatch = System.Text.RegularExpressions.Regex.Match(
                remaining, @"\[POINT:[^\]]+\]\s*$");
            if (pointTagMatch.Success)
                remaining = remaining[..pointTagMatch.Index].Trim();
            if (remaining.Length > 0)
                ttsTasks.Add(_proxy.SynthesizeSpeechAsync(remaining, _settings.TtsVoice, ct));

            var responseText = fullResponse.ToString();
            System.Diagnostics.Debug.WriteLine($"Claude: {responseText[..Math.Min(100, responseText.Length)]}");

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
            ChatEntryCompleted?.Invoke(transcript, StripPointTags(responseText));
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

            // Wait for audio playback to complete
            await audioPlaybackTask;

            // Wait for pointing animation to complete + 1s
            await Task.Delay(1000, ct);

            // If no pointing happened, dismiss after 7s
            if (pointX < 0 || pointY < 0)
            {
                await Task.Delay(6000, ct);
            }

            ReturnToCursor?.Invoke();
            SetState(CompanionState.Idle);
        }
        catch (OperationCanceledException) { }
        catch (UsageLimitException ex)
        {
            await HandleUsageLimitAsync(ex);
        }
        catch (Exception ex)
        {
            Log($"Pipeline error: {ex}");
            SetState(CompanionState.Idle);
        }
    }

    private async Task HandleUsageLimitAsync(UsageLimitException ex)
    {
        System.Diagnostics.Debug.WriteLine($"Usage limit reached: {ex.Tier} {ex.Used}/{ex.Limit}");

        var message = ex.Tier switch
        {
            "free" => "você usou seus dez usos do dia. faz upgrade pro plano pro pra continuar usando.",
            "pro" => "você usou seus quinhentos usos do mês. faz upgrade pro plano ilimitado.",
            _ => $"limite do plano {ex.Tier} atingido."
        };

        SetState(CompanionState.Speaking);
        ShowMessage?.Invoke(message);

        // /tts is auth-gated but not metered, so this still works at the limit.
        try
        {
            var audioBytes = await _proxy.SynthesizeSpeechAsync(message, _settings.TtsVoice);
            await Helpers.AudioHelper.PlayMp3Async(audioBytes);
        }
        catch (Exception ttsEx)
        {
            System.Diagnostics.Debug.WriteLine($"Limit message TTS failed: {ttsEx.Message}");
        }

        // Bubble holds for ~3s; give it a beat to fade before going idle.
        await Task.Delay(3500);
        SetState(CompanionState.Idle);
    }

    private async Task PlayAudioChunksAsync(List<Task<byte[]>> ttsTasks, CancellationToken ct)
    {
        Log($"TTS: {ttsTasks.Count} chunks to play");
        foreach (var ttsTask in ttsTasks)
        {
            try
            {
                var audioBytes = await ttsTask;
                Log($"TTS chunk: {audioBytes.Length} bytes");
                if (audioBytes.Length > 0)
                    await Helpers.AudioHelper.PlayMp3Async(audioBytes, ct);
            }
            catch (Exception ex)
            {
                Log($"TTS chunk failed: {ex}");
            }
        }
        Log("TTS playback done");
    }

    /// <summary>
    /// Find the index of a sentence-ending punctuation followed by a space.
    /// Returns the index of the space after the punctuation, or -1 if none found.
    /// </summary>
    private static int FindSentenceEnd(string text)
    {
        for (int i = 1; i < text.Length; i++)
        {
            if (text[i] == ' ' && (text[i - 1] == '.' || text[i - 1] == '?' || text[i - 1] == '!'))
            {
                // Avoid splitting on numbers like "3.5" or abbreviations
                if (text[i - 1] == '.' && i >= 2 && char.IsDigit(text[i - 2]))
                    continue;
                return i;
            }
        }
        return -1;
    }

    private void SetState(CompanionState state)
    {
        State = state;
        StateChanged?.Invoke(state);
    }

    internal void SetStateForTesting(CompanionState state) => State = state;

    /// <summary>
    /// Strip [POINT:...] tags from a response to produce clean text for display.
    /// </summary>
    internal static string StripPointTags(string text)
    {
        return System.Text.RegularExpressions.Regex.Replace(text, @"\[POINT:[^\]]*\]", "").Trim();
    }
}
