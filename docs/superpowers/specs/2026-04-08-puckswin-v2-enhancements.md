# PucksWin v2 Enhancements — Design Spec

## Overview

Three enhancements to PucksWin: buddy cursor companion, smart contextual overlay with step-by-step guidance, and Windows Speech Recognition for free STT.

## 1. Buddy Cursor

A small circular mascot (purple with eyes) that follows the user's real cursor with ~150ms delay.

**Visual:**
- 36px circle with gradient (purple idle, red recording, yellow thinking, green speaking)
- Two white dot "eyes" that track cursor movement direction
- Soft glow matching current color
- Always visible on screen as a companion

**Behavior:**
- Smooth interpolation (lerp) following cursor at ~150ms delay
- During step-by-step guidance: animates to target element instead of following cursor
- Click-through (WS_EX_TRANSPARENT) — never blocks interaction
- Rendered on a fullscreen transparent WPF overlay window

**Implementation:**
- New `BuddyCursorWindow.xaml/.cs` — fullscreen transparent overlay
- Uses `CompositionTarget.Rendering` for 60fps smooth animation
- P/Invoke `GetCursorPos` each frame for real cursor position
- Lerp formula: `buddyPos += (cursorPos - buddyPos) * 0.12` per frame
- Eye direction calculated from movement vector

## 2. Smart Overlay — Step-by-Step Guidance

Context-aware response positioning with interactive step-by-step navigation.

**Claude Response Format:**
- Single response: `just regular text` → tooltip near buddy cursor
- Multi-step: `[STEP:1:832,45:Settings] clica em Settings [STEP:2:900,120:Dark Mode] seleciona Dark Mode`
- Coordinates are pixel positions on the captured screenshot

**Per-Step Visual:**
- Purple glow border (2px, border-radius 12px, box-shadow) highlighting target element
- Small tooltip (dark bg, purple accent) with step text positioned near the element
- Step counter: "PASSO 1 DE 3"
- Progress dots at bottom of screen
- Buddy cursor animates to the highlighted element

**Step Advancement:**
- Monitor mouse clicks via Win32 `SetWindowsHookEx` (WH_MOUSE_LL)
- When click detected within ~50px radius of current step's target coordinates, advance to next step
- After last step, dismiss overlay with fade-out after 2s
- User can press hotkey again to dismiss and start new interaction

**Coordinate Mapping:**
- Screenshot coordinates need mapping to screen coordinates
- Screenshot is of one display; map relative to that display's bounds
- Same logic as cursor marker drawing but in reverse

**Implementation:**
- Modify `OverlayWindow.xaml/.cs` — add glow highlight, step tooltip, progress dots
- New `StepGuideManager.cs` — parses STEP tags, manages current step, monitors clicks
- Modify `CompanionManager.cs` — detect steps in response, route to StepGuideManager
- Update system prompt to instruct Claude to use STEP tags when guiding

## 3. Windows Speech Recognition

Replace mock transcription with Windows built-in speech recognition.

**Implementation:**
- New `WindowsSpeechService.cs` using `System.Speech.Recognition`
- Add NuGet: `System.Speech` (Windows-only, .NET 8 compatible)
- Detect available languages: use PT-BR if installed, fallback to EN-US
- Integrates with existing `IAudioCaptureService` flow
- Replace `WhisperTranscriptionService` call in `CompanionManager` with local recognition
- Update local proxy: remove mock `/transcribe`, app handles STT locally now

**Flow Change:**
- Before: Record → Send WAV to proxy /transcribe → Get text
- After: Record → System.Speech recognizes locally → Get text (free, offline)

## Updated System Prompt

```
você é um assistente que vive na tela do usuário. você pode ver a tela dele através de screenshots e ouvir as perguntas por voz. você é como um amigo inteligente sentado do lado, ajudando com qualquer coisa.

fale de forma casual e natural em português brasileiro. use letras minúsculas. frases curtas. sem formatação (nada de markdown, bullets, ou listas). escreva como se estivesse falando em voz alta — porque a resposta vai ser lida por text-to-speech.

o screenshot mostra a tela do usuário. o cursor está marcado com um círculo vermelho e crosshair. use a posição do cursor para entender o que o usuário está olhando ou referenciando. se ele disser "isso" ou "aqui", ele provavelmente está falando sobre o que está perto do cursor.

responda em no máximo 3-4 frases. seja direto. se o usuário pedir pra ensinar algo, guie passo a passo mas um passo de cada vez. nunca diga "como uma IA" ou "não tenho acesso". você PODE ver a tela — use essa informação.

IMPORTANTE: quando o usuário pedir ajuda pra fazer algo na tela (clicar, configurar, encontrar algo), identifique os elementos visuais relevantes e use tags de passo com coordenadas em pixels baseadas no screenshot:
[STEP:1:x,y:label] instrução do passo
[STEP:2:x,y:label] instrução do passo
as coordenadas x,y devem apontar pro centro do elemento visual no screenshot. o label é o nome do elemento.

se a resposta for simples e não envolver cliques na tela, responda normalmente sem tags STEP.
```

## Files Changed/Created

| File | Action |
|------|--------|
| `src/PucksWin.App/UI/BuddyCursorWindow.xaml/.cs` | Create — buddy cursor overlay |
| `src/PucksWin.App/Services/StepGuideManager.cs` | Create — step parsing, click detection, step advancement |
| `src/PucksWin.App/Services/WindowsSpeechService.cs` | Create — System.Speech recognition |
| `src/PucksWin.App/UI/OverlayWindow.xaml/.cs` | Modify — add glow highlight, step tooltip, progress dots |
| `src/PucksWin.App/Core/CompanionManager.cs` | Modify — integrate steps + local STT + buddy control |
| `src/PucksWin.App/App.xaml.cs` | Modify — wire new components |
| `proxy/local-server.js` | Modify — remove mock /transcribe |
