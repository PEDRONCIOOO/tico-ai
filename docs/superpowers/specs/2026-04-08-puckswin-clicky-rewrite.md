# PucksWin Clicky Rewrite — Design Spec

## Goal

Rewrite PucksWin to replicate Clicky's exact behavior, adapted for Windows with C# WPF .NET 8. Keep our buddy cursor (circle with eyes) and Edge TTS (free).

## Changes from Clicky

| Clicky | PucksWin Rewrite |
|--------|-----------------|
| Blue triangle cursor | Purple circle with eyes (keep) |
| ElevenLabs TTS | Edge TTS via Python CLI (keep) |
| macOS (Swift/AppKit) | Windows (C# WPF .NET 8) |
| Ctrl+Option hotkey | Ctrl+Shift+Space (keep) |
| AssemblyAI streaming | Whisper batch via proxy (keep) |

Everything else replicates Clicky exactly.

## 1. Buddy Cursor — Replicate Clicky Behavior

**Following:**
- Spring animation: response 0.2s, damping 0.6 (NOT lerp)
- Offset from mouse: +35px right, +25px down
- 60fps update via CompositionTarget.Rendering
- Eyes track movement direction (keep our design)
- Color changes by state (keep: purple/red/yellow/green)

**Bézier Arc Flight (Pointing):**
- Quadratic Bézier from cursor position → target element
- Control point offset upward by 20% of distance (max 80px arc)
- Flight speed: distance / 800 px/sec, clamped 0.6–1.4s
- Hermite smoothstep interpolation (3t² - 2t³)
- Scale pulse: sin(progress * π) → 1.0x to 1.3x at midpoint
- Eyes look toward target during flight
- On arrival: speech bubble pops in

**Return Flight:**
- After bubble holds 3s, fly back to cursor position
- Cancel if user moves cursor >100px during return
- Resume normal cursor following after return

## 2. Voice State Indicators (On Buddy)

Replace current pill/text indicators with Clicky-style overlays on the buddy itself:

**Listening (Waveform):**
- 5 vertical bars next to buddy
- Heights respond to real audio power level
- Profile: [0.4, 0.7, 1.0, 0.7, 0.4] (center peak)
- Audio power: normalized, eased with pow(x, 0.76), multiplied by 2.85
- Idle pulse: sin wave for continuous bob even in silence
- Bars: 2px wide, 2px spacing, color matches buddy state

**Processing (Spinner):**
- Circular arc (15%–85% trim) rotating at 0.8s/revolution
- 14x14px, stroke 2.5px, rounded caps
- Gradient from dark to bright purple
- Shows during transcription + Claude processing

**Speaking:**
- Buddy visible with current color (green)
- No extra indicator

## 3. Overlay — No Streaming Text

Replicate Clicky: do NOT show Claude's response text. Only show:
- Waveform during recording
- Spinner during processing
- Speech bubble when pointing at element
- TTS audio plays the response

Remove the BubbleBorder/ResponseText/StatusLabel from OverlayWindow.

## 4. Speech Bubbles (Pointing)

When buddy arrives at target element:
- Background: buddy's current color (#7C3AED purple)
- Padding: 8px horizontal, 4px vertical
- Corner radius: 6px
- Text: 11pt, white, medium weight
- Pop-in: scale 0.5x → 1.0x with spring (0.4s, 0.6 damping)
- Characters stream in at 30-60ms intervals
- Position: x+10, y+18 relative to buddy
- Hold 3 seconds, then fade out
- Random phrases: "bem aqui!", "esse aqui!", "olha aqui!", "clica aqui!", "achei!", "é esse!"

## 5. System Prompt — Portuguese Adaptation of Clicky's

```
você é o puckswin, um companheiro amigável que vive na tela do usuário.
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

apontamento de elementos:
você tem um pequeno cursor companheiro que pode voar até e apontar pra coisas na tela.
use sempre que apontar genuinamente ajudaria o usuário — se estão perguntando como fazer algo, procurando um menu, tentando achar um botão, ou precisam de ajuda navegando um app, aponte pro elemento relevante.

não aponte quando seria inútil — como se o usuário fizer uma pergunta de conhecimento geral, ou a conversa não tem nada a ver com o que está na tela.

quando apontar, coloque a tag de coordenadas no final da resposta, DEPOIS do texto falado. as imagens do screenshot são rotuladas com suas dimensões em pixels. use essas dimensões como espaço de coordenadas. a origem (0,0) é o canto superior esquerdo. x aumenta pra direita, y aumenta pra baixo.

formato: [POINT:x,y:label] onde x,y são coordenadas inteiras em pixels no espaço do screenshot, e label é uma descrição curta de 1-3 palavras do elemento. se o elemento está em outra tela, adicione :screenN.

se apontar não ajudaria, coloque [POINT:none].

exemplos:
- usuário pergunta como fazer color grading no davinci: "você vai querer abrir o painel de cores — tá ali em cima na direita da toolbar. clica lá e vai ter todas as rodas de cor e curvas. [POINT:1100,42:painel de cores]"
- usuário pergunta o que é html: "html é hypertext markup language, basicamente o esqueleto de toda página web. curioso como conecta com o css que você tá olhando? [POINT:none]"
```

## 6. Screen Capture — Multi-Monitor

- Capture ALL displays (not just cursor display)
- Label each with screen number and cursor status
- Max dimension: 1280px (downscale maintaining aspect ratio)
- JPEG quality: 0.8
- Include pixel dimensions in label for Claude

## 7. Pointing Coordinate System

- Parse: `[POINT:x,y:label]` or `[POINT:x,y:label:screenN]` or `[POINT:none]`
- Transform: screenshot pixels → screen coordinates
  - Scale by aspect ratio (screenshot px vs display px)
  - Account for display offset in multi-monitor
- Validate coordinates are within screen bounds

## 8. Conversation History

- Keep last 10 exchanges (user + assistant pairs)
- Include in every Claude request

## 9. Transient Cursor Mode

- Settings toggle: "Mostrar PucksWin" (default: on)
- When OFF: buddy hidden, appears transiently on hotkey press
- After TTS + pointing animation + 1s, fade out
- Cancel fade if user presses hotkey again

## Files to Rewrite

| File | Change |
|------|--------|
| `Core/CompanionManager.cs` | Full rewrite — Clicky state machine |
| `UI/BuddyCursorWindow.xaml/.cs` | Spring animation, Bézier flight, waveform, spinner |
| `UI/OverlayWindow.xaml/.cs` | Remove text display, add speech bubbles only |
| `UI/RecordingIndicator.xaml/.cs` | Delete — waveform is on buddy now |
| `Services/ScreenCaptureService.cs` | Multi-monitor capture |
| `Services/StepGuideManager.cs` | Rename to PointingManager, Clicky format |
| `Helpers/ImageHelper.cs` | Multi-monitor support |
| `App.xaml.cs` | Rewire for new architecture |
