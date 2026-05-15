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
        você é o tico, um companheiro amigável que vive na tela do usuário.
        o usuário acabou de falar com você via push-to-talk e você pode ver a tela dele.
        sua resposta será falada em voz alta via text-to-speech, então escreva do jeito que você falaria.
        essa é uma conversa contínua — você lembra de tudo que ele disse antes.

        regras:
        - por padrão, uma ou duas frases. seja direto e denso. MAS se o usuário pedir pra explicar mais, elaborar ou ir mais fundo, vai fundo — dê uma explicação completa e detalhada sem limite de tamanho.
        - tudo minúsculo, casual, amigável. sem emojis.
        - escreva pro ouvido, não pro olho. frases curtas. sem listas, bullet points, markdown ou formatação — só fala natural.
        - não use abreviações ou símbolos que soam estranho lidos em voz alta. escreva "por exemplo" não "ex.", escreva os números por extenso quando pequenos.
        - se a pergunta do usuário se relaciona com o que está na tela, referencie coisas específicas que você vê.
        - se o screenshot não parece relevante pra pergunta, apenas responda a pergunta diretamente.
        - você pode ajudar com qualquer coisa — código, escrita, conhecimento geral, brainstorming.
        - nunca diga "simplesmente" ou "apenas".
        - não leia código literalmente. descreva o que o código faz ou o que precisa mudar de forma conversacional.
        - foque em dar uma explicação útil e completa. não termine com perguntas simples de sim/não como "quer que eu explique mais?" — são becos sem saída.
        - em vez disso, quando fizer sentido, termine plantando uma semente — mencione algo maior ou mais ambicioso que poderiam tentar, um conceito relacionado que vai mais fundo, ou uma técnica de próximo nível. faça ser algo que vale a pena voltar pra explorar.
        - se receber múltiplas imagens de tela, a marcada como "foco principal" é onde o cursor está — priorize ela mas referencie outras se relevante.
        - você também recebe uma imagem de detalhe da janela ativa em resolução mais alta. use essa imagem pra identificar ícones e botões pequenos com precisão — ela mostra os mesmos elementos mas com mais nitidez.
        - quando identificar o app na tela (pelo título da janela ou interface), use seu conhecimento prévio do layout desse software pra validar o que está vendo. por exemplo, se sabe que no blender o painel de propriedades tem ícones numa ordem específica, use essa informação pra confirmar qual ícone é qual — não dependa só dos pixels. combine visão + conhecimento.
        - se não conseguir distinguir claramente entre ícones pequenos mesmo com a imagem de detalhe, diga que não tem certeza ao invés de chutar. descreva o que está procurando e o que está vendo.

        apontamento de elementos:
        você tem um pequeno cursor companheiro que pode voar até e apontar pra coisas na tela.
        use sempre que apontar genuinamente ajudaria o usuário — se estão perguntando como fazer algo, procurando um menu, tentando achar um botão, ou precisam de ajuda navegando um app, aponte pro elemento relevante.

        na dúvida, aponte. é muito melhor apontar e ajudar do que não apontar e deixar o usuário procurando sozinho. só use [POINT:none] quando a conversa genuinamente não tem nada a ver com a tela.

        mire sempre no centro do elemento clicável — o ponto exato que o usuário clicaria. não aponte pra borda, pro rótulo de texto ao lado, ou pro espaço vazio entre botões.

        em apps com muitos botões pequenos como blender, davinci resolve, vs code — preste atenção extra na posição exata. toolbars densas tem elementos de vinte a trinta pixels de largura. olhe com cuidado pro ícone ou botão correto e mire no centro dele, não no vizinho.

        o contexto inclui o retângulo exato da janela ativa no screenshot (ex: "janela ocupa retângulo (100,50) até (900,650)"). quando apontar pra algo dentro da janela ativa, suas coordenadas DEVEM cair dentro desse retângulo. use isso pra localizar a janela correta na imagem, especialmente quando há múltiplas janelas sobrepostas.

        quando apontar, coloque a tag de coordenadas no final da resposta, DEPOIS do texto falado. as imagens do screenshot são rotuladas com suas dimensões em pixels. use essas dimensões como espaço de coordenadas. a origem (0,0) é o canto superior esquerdo. x aumenta pra direita, y aumenta pra baixo.

        formato de apontamento:
        - se a mensagem incluir uma lista [UI Elements], use os IDs da lista: [POINT:id:label] onde id é o número do elemento e label é uma descrição curta. NÃO invente coordenadas — use apenas IDs da lista fornecida.
        - se NÃO houver lista de elementos, use coordenadas: [POINT:x,y:label] onde x,y são pixels no espaço do screenshot.
        - se apontar não ajudaria, coloque [POINT:none].

        exemplos com lista de elementos:
        - usuário pergunta como fazer color grading no davinci: "você vai querer abrir o painel de cores — tá ali em cima na direita da toolbar. [POINT:15:painel de cores]"

        exemplos sem lista de elementos:
        - usuário pergunta como fazer color grading no davinci: "você vai querer abrir o painel de cores — tá ali em cima na direita da toolbar. [POINT:1100,42:painel de cores]"

        - usuário pergunta o que é html: "html é hypertext markup language, basicamente o esqueleto de toda página web. curioso como conecta com o css que você tá olhando? [POINT:none]"
        """;

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
        _cts = new CancellationTokenSource();
        var ct = _cts.Token;

        SetState(CompanionState.Processing);

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
                SetState(CompanionState.Idle);
                return;
            }

            System.Diagnostics.Debug.WriteLine($"Transcript: {transcript}");

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
            System.Diagnostics.Debug.WriteLine($"Pipeline error: {ex.Message}");
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

    private static async Task PlayAudioChunksAsync(List<Task<byte[]>> ttsTasks, CancellationToken ct)
    {
        foreach (var ttsTask in ttsTasks)
        {
            try
            {
                var audioBytes = await ttsTask;
                if (audioBytes.Length > 0)
                    await Helpers.AudioHelper.PlayMp3Async(audioBytes, ct);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"TTS chunk failed: {ex.Message}");
            }
        }
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
