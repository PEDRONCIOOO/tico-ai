# Computer Use API — Pixel-Perfect Pointing

**Data:** 2026-04-10
**Status:** Ativo
**Problema:** Coordenadas `[POINT:x,y:label]` via visão padrão não são precisas o suficiente para ícones pequenos (~10-20px) em apps como Blender, DaVinci Resolve. Claude chuta ao invés de identificar corretamente.
**Solução:** Usar a Computer Use API do Claude como segunda passagem de precisão quando um POINT tag é detectado.

## Arquitetura

```
Fluxo atual:
  F8 → captura tela → /chat (Claude Vision) → [POINT:x,y:label] → buddy voa

Fluxo novo:
  F8 → captura tela → /chat (Claude Vision) → [POINT:x,y:label]
                                                      ↓
                                               /locate (Computer Use API)
                                                      ↓
                                              coordenadas pixel-perfect → buddy voa
```

A chamada `/locate` roda em paralelo com o TTS — enquanto o áudio começa a tocar, as coordenadas precisas são calculadas. O buddy só voa quando ambos (coordenadas + início do TTS) estão prontos.

## Componente 1: ElementLocationService (C#)

**Arquivo novo:** `src/Tico.App/Services/ElementLocationService.cs`

**Interface:**
```csharp
public interface IElementLocationService
{
    Task<(int X, int Y)?> LocateElementAsync(
        string imageBase64, int displayWidth, int displayHeight,
        string elementLabel, CancellationToken ct);
}
```

**Responsabilidades:**
1. Escolher a resolução Computer Use mais próxima do aspect ratio da tela:
   - 1024×768 (4:3 = 1.333)
   - 1280×800 (16:10 = 1.600)
   - 1366×768 (16:9 = 1.779)
   - Algoritmo: menor diferença absoluta entre aspect ratios
2. Redimensionar o screenshot (da tela focada) pra a resolução escolhida via bicubic
3. Converter pra base64 JPEG quality 90
4. Chamar `/locate` no proxy com: image, width, height, label
5. Parsear resposta `{ x, y }` — retornar null se x == -1 ou request falhou

**Não faz:** coordinate mapping (isso fica no CompanionManager).

## Componente 2: Endpoint `/locate` no proxy

**Arquivo:** `proxy/local-server.js`

**Endpoint:** `POST /locate`

**Request body:**
```json
{
  "image": "<base64 JPEG>",
  "width": 1280,
  "height": 800,
  "label": "painel de materiais",
  "model": "claude-sonnet-4-6"
}
```

**Claude API request:**
```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 256,
  "tools": [{
    "type": "computer_20251124",
    "name": "computer",
    "display_width_px": 1280,
    "display_height_px": 800
  }],
  "messages": [{
    "role": "user",
    "content": [
      {
        "type": "image",
        "source": {
          "type": "base64",
          "media_type": "image/jpeg",
          "data": "<base64>"
        }
      },
      {
        "type": "text",
        "text": "clique no elemento: <label>"
      }
    ]
  }]
}
```

**Headers extras pro Claude API:**
```
anthropic-beta: computer-use-2025-11-24
```

**Response parsing:**
- Procura bloco `content[].type == "tool_use"` na resposta do Claude
- Extrai `input.coordinate` → `[x, y]`
- Se não encontrar tool_use → retorna `{ x: -1, y: -1 }`

**Response pro client:**
```json
{ "x": 640, "y": 412 }
```

**Regras:**
- NÃO conta como uso (não incrementa usage) — o `/chat` já contou
- Auth: mesmo Bearer JWT do Supabase
- Não faz streaming (request simples, response simples)

## Componente 3: Integração no CompanionManager

**Arquivo:** `src/Tico.App/Core/CompanionManager.cs`

**Fluxo atualizado do `OnHotkeyUpAsync`:**

```
1. Transcreve áudio → transcript
2. Envia pra Claude via /chat → responseText (streaming)
3. Parseia [POINT:x,y:label] do responseText
4. Inicia TTS download + playback (não espera locate)
5. SE tem POINT com coordenadas válidas (x >= 0, y >= 0):
   a. Em paralelo com TTS:
      - Pega screenshot da tela focada (já capturado)
      - Chama ElementLocationService.LocateElementAsync(screenshot, displayW, displayH, label)
   b. SE locate retornou coordenadas:
      - Mapeia Computer Use coords → screen coords
      - Usa essas coordenadas pro buddy
   c. SE locate falhou (null / timeout):
      - Fallback: mapeia coordenadas do POINT original → screen coords
6. Buddy voa pro target
```

**Coordinate mapping (Computer Use → screen):**
```csharp
// Computer Use coords → display logical coords
int clampedX = Math.Clamp(cuX, 0, cuWidth);
int clampedY = Math.Clamp(cuY, 0, cuHeight);

double logicalX = (double)clampedX / cuWidth * displayLogicalWidth;
double logicalY = (double)clampedY / cuHeight * displayLogicalHeight;

// Display local → global screen coords
int screenX = (int)logicalX + screenOffsetX;
int screenY = (int)logicalY + screenOffsetY;
```

**Paralelismo:** TTS e locate rodam ao mesmo tempo. O buddy espera pelo locate (com timeout de 5s) antes de voar.

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/Tico.App/Services/ElementLocationService.cs` | **Novo** — serviço Computer Use |
| `src/Tico.App/Services/IScreenCaptureService.cs` | Adicionar `IElementLocationService` interface |
| `src/Tico.App/Core/CompanionManager.cs` | Integrar locate no fluxo, paralelismo com TTS |
| `proxy/local-server.js` | Novo endpoint `/locate` |
| `tests/Tico.Tests/` | Testes pro ElementLocationService (mock do proxy) |

## Fallback e error handling

- `/locate` timeout (5s) → usa coordenadas do POINT original
- `/locate` retorna -1,-1 (Claude não encontrou elemento) → usa POINT original
- Proxy offline → usa POINT original
- Qualquer exceção → usa POINT original, log debug

## Fora de escopo

- Mudanças no formato do POINT tag
- Mudanças no system prompt (já melhorado nesta sessão)
- Mudanças no PointingManager.MapToScreen (continua sendo usado pro fallback)
- Deploy no Cloudflare Worker (worker.js) — só local-server.js por agora

## Custo estimado

- ~$0.003-0.005 por chamada `/locate` (Sonnet, 256 max tokens, 1 imagem)
- Só chamado quando POINT tag existe na resposta (nem toda interação aponta)
- Estimativa: ~60-70% das interações tem pointing → custo extra de ~$0.003/request em média
