# Pointer Precision Improvement — Design Spec

**Data:** 2026-04-10
**Status:** Ativo
**Problema:** Coordenadas `[POINT:x,y:label]` retornadas pelo Claude são imprecisas em apps com UI densa (Blender, DaVinci Resolve, VS Code). Dois sintomas: (B) erra por poucos pixels e acerta o elemento vizinho, (C) às vezes não tenta apontar quando deveria.

## Abordagem escolhida

**Resolução nativa + prompt engineering + JPEG quality bump.** Sem cursor crop, sem quadrantes, sem metadata extra.

## Mudança 1: Remover downscale de 1280px (ImageHelper)

**Arquivo:** `src/Tico.App/Helpers/ImageHelper.cs`

**O que muda:**
- Remover o bloco de downscale condicional (`if (physW > maxWidth)`, linhas 66-78)
- O método `CaptureSpecificScreen` passa a retornar o bitmap na resolução física nativa
- `ScreenshotWidth`/`ScreenshotHeight` serão iguais a `ScreenPhysicalWidth`/`ScreenPhysicalHeight`

**JPEG quality:**
- `BitmapToBase64Jpeg` muda o default de `quality = 80L` para `quality = 90L`
- Preserva melhor o detalhe em ícones pequenos e texto de toolbars

**Impacto no coordinate mapping:** Nenhum. O `PointingManager.MapToScreen` usa `physicalWidth / screenshotWidth` — sem downscale, esse ratio é 1.0 e a transformação continua correta.

**Impacto em tokens:**
- Monitor 1080p: ~1.020 → ~1.530 tokens por imagem (+50%)
- Monitor 1440p+: ~1.020 → ~1.360 tokens (+33%, API do Claude limita a ~1568px)

## Mudança 2: Prompt engineering (CompanionManager)

**Arquivo:** `src/Tico.App/Core/CompanionManager.cs` (campo `SystemPrompt`)

**Seção "apontamento de elementos" — texto revisado:**

```
apontamento de elementos:
você tem um pequeno cursor companheiro que pode voar até e apontar pra coisas na tela.
use sempre que apontar genuinamente ajudaria o usuário — se estão perguntando como fazer algo, procurando um menu, tentando achar um botão, ou precisam de ajuda navegando um app, aponte pro elemento relevante.

na dúvida, aponte. é muito melhor apontar e ajudar do que não apontar e deixar o usuário procurando sozinho. só use [POINT:none] quando a conversa genuinamente não tem nada a ver com a tela.

mire sempre no centro do elemento clicável — o ponto exato que o usuário clicaria. não aponte pra borda, pro rótulo de texto ao lado, ou pro espaço vazio entre botões.

em apps com muitos botões pequenos como blender, davinci resolve, vs code — preste atenção extra na posição exata. toolbars densas tem elementos de vinte a trinta pixels de largura. olhe com cuidado pro ícone ou botão correto e mire no centro dele, não no vizinho.

quando apontar, coloque a tag de coordenadas no final da resposta, DEPOIS do texto falado. as imagens do screenshot são rotuladas com suas dimensões em pixels. use essas dimensões como espaço de coordenadas. a origem (0,0) é o canto superior esquerdo. x aumenta pra direita, y aumenta pra baixo.

formato: [POINT:x,y:label] onde x,y são coordenadas inteiras em pixels no espaço do screenshot, e label é uma descrição curta de 1-3 palavras do elemento.

se apontar não ajudaria, coloque [POINT:none].

exemplos:
- usuário pergunta como fazer color grading no davinci: "você vai querer abrir o painel de cores — tá ali em cima na direita da toolbar. clica lá e vai ter todas as rodas de cor e curvas. [POINT:1100,42:painel de cores]"
- usuário pergunta o que é html: "html é hypertext markup language, basicamente o esqueleto de toda página web. curioso como conecta com o css que você tá olhando? [POINT:none]"
```

**Diferenças do prompt atual:**
1. Adicionado: "na dúvida, aponte" — frase mais forte que o atual "erre pro lado de apontar"
2. Adicionado: instrução de mirar no centro do elemento clicável
3. Adicionado: instrução específica pra UIs densas (Blender, DaVinci, VS Code)
4. Removido: parágrafo "não aponte quando seria inútil" — absorvido no "só use [POINT:none] quando..."

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/Tico.App/Helpers/ImageHelper.cs` | Remover bloco de downscale (linhas 66-78), quality 80→90 |
| `src/Tico.App/Core/CompanionManager.cs` | Substituir seção "apontamento de elementos" no SystemPrompt |

## Fora de escopo

- Cursor crop como segunda imagem (pode ser adicionado depois se a precisão ainda for insuficiente)
- Quadrantes (4 imagens por tela)
- Metadata estruturada (DPI, resolução, app context)
- Mudanças no formato do POINT tag
- Mudanças no PointingManager ou ScreenCaptureService
- Mudanças no proxy

## Testes

- Testes existentes do `PointingManager` continuam passando (coordinate mapping é backward-compatible)
- Testes existentes do `ProxyClient` continuam passando (formato de request inalterado)
- Teste manual: rodar Tico com Blender/DaVinci/VS Code aberto, pedir pra apontar pra elementos específicos
