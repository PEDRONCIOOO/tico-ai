# ElevenLabs TTS Migration

**Data:** 2026-04-11
**Status:** Aprovado

## Objetivo

Substituir Azure TTS (produção) e Edge TTS via Python (dev local) por ElevenLabs em ambos os ambientes. Motivação: vozes mais naturais e de maior qualidade.

## Configuração ElevenLabs

| Parâmetro | Valor |
|-----------|-------|
| Voice ID | `RGymW84CSmfVugnA5tvA` (env var `ELEVENLABS_VOICE_ID`) |
| Model | `eleven_flash_v2_5` (~300ms latência) |
| Stability | 0.5 |
| Similarity Boost | 0.75 |
| Output Format | `mp3_44100_128` |
| API Endpoint | `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` |
| Auth | Header `xi-api-key` |

## Arquitetura

A interface do proxy `/tts` permanece idêntica: recebe `{ text, voice }`, retorna `audio/mpeg`. O desktop app não precisa de mudança no código — apenas o default de voice muda no `AppSettings.cs`.

```
Desktop App                    Proxy                         ElevenLabs
    │                            │                               │
    │ POST /tts                  │                               │
    │ { text, voice }            │                               │
    │ ──────────────────────────►│                               │
    │                            │ POST /v1/text-to-speech/{id}  │
    │                            │ { text, model_id,             │
    │                            │   voice_settings }            │
    │                            │ ─────────────────────────────►│
    │                            │                               │
    │                            │◄───────── audio/mpeg ─────────│
    │◄───────── audio/mpeg ──────│                               │
```

## Mudanças por arquivo

### `proxy/worker.js` — handleTts

- Remover: chamada Azure TTS, validação SSML, `escapeXml()` no TTS
- Adicionar: `fetch` pra ElevenLabs API com `xi-api-key` header
- Body: `{ text, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }`
- Response: passthrough do `response.body` (sem buffering, igual Clicky)
- Novos secrets: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`

### `proxy/local-server.js` — handleTts

- Remover: `execFileSync python edge_tts`, temp file management
- Adicionar: `fetch` pra ElevenLabs API (mesma lógica do worker)
- Novos env vars: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`
- Remover `msedge-tts` do requires (linha 13) se não usado em outro lugar

### `src/Tico.App/Config/AppSettings.cs`

- Mudar default de `TtsVoice` de `"pt-BR-FranciscaNeural"` para o voice ID ElevenLabs

### `proxy/.env.example`

- Adicionar: `ELEVENLABS_API_KEY=`, `ELEVENLABS_VOICE_ID=RGymW84CSmfVugnA5tvA`

### `proxy/wrangler.toml`

- Documentar novos secrets: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`

### Validação de voice

- Regex de voice muda de `/^[a-zA-Z0-9\-]+$/` para `/^[a-zA-Z0-9]+$/` (IDs ElevenLabs são alfanuméricos, sem hífens)

## O que NÃO muda

- Interface do proxy `/tts` (request/response format)
- ProxyClient.cs no desktop app
- Streaming per-sentence no CompanionManager (já é melhor que o Clicky que envia tudo junto)
- AudioHelper.cs (continua recebendo MP3 bytes)

## Latência esperada

O Tico já faz TTS per-sentence. Com ElevenLabs Flash v2.5 (~300ms por request), a primeira frase começa a tocar ~300ms após streaming iniciar vs ~1-2s com Azure/Edge TTS.

## Cleanup

- Remover `AZURE_SPEECH_KEY` e `AZURE_SPEECH_REGION` do worker.js
- Remover dependência de Python `edge-tts` das instruções de setup
- Remover `msedge-tts` require do local-server.js
- Atualizar README: referências a Azure/Edge TTS → ElevenLabs
