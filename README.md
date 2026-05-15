# Tico — seu buddy de IA no Windows

Tico é um assistente de IA que vive na tela do usuário. Ele segue o cursor como um companheiro, ouve perguntas por voz, vê a tela via screenshot, e responde em voz alta apontando para elementos na tela.

## Arquitetura

```
┌──────────────────────┐
│   Tico.App (WPF)     │  Windows desktop — buddy cursor, hotkey F8,
│   C# .NET 8          │  captura de tela + áudio, TTS playback
└──────────┬───────────┘
           │ HTTP (Bearer JWT)
           ▼
┌──────────────────────┐
│   Proxy              │  Node.js (local dev) ou Cloudflare Worker (prod)
│   /chat /transcribe  │  Roteia pra Claude, Whisper, ElevenLabs TTS
│   /tts /usage        │  Valida JWT do Supabase, enforça limites de uso
└──────────┬───────────┘
           │
    ┌──────┴───────┐
    ▼              ▼
 Anthropic     OpenAI        ElevenLabs
 Claude API    Whisper       TTS (Flash v2.5)

┌──────────────────────┐
│   Web (Next.js 16)   │  Landing, login, register, dashboard, /upgrade
│   + Supabase         │  Auth, profiles, usage tracking, payments
│   + AbacatePay       │  PIX + Cartão, webhooks
└──────────────────────┘
```

## Componentes

### `src/Tico.App/` — Aplicativo desktop (WPF .NET 8)

| Pasta | Descrição |
|-------|-----------|
| `Core/` | CompanionManager (state machine principal), CompanionState, ConversationHistory |
| `Services/` | AuthService (Supabase REST), TokenStore (DPAPI), SessionManager, ProxyClient, AudioCaptureService, ScreenCaptureService, PointingManager (v1 coord-based + v2 ID-based), OmniParserClient (parse UI elements), ElementListFormatter (format element list pro prompt), WindowsSpeechService, HotkeyService |
| `UI/` | BuddyCursorWindow (buddy cursor com spring physics + Bézier flight + waveform + spinner + speech bubbles), OverlayWindow (glow underline), SettingsWindow (model/voz/conta/uso/logout), LoginWindow (email/senha), TrayIconManager |
| `Helpers/` | AudioHelper (TTS playback), CursorHelper (P/Invoke GetCursorPos), ImageHelper (screen capture + DPI + downscale) |
| `Config/` | AppSettings (JSON em %APPDATA%\Tico, Supabase URL/key, proxy URL, hotkey, model, voz) |

### `proxy/` — Proxy server

| Arquivo | Descrição |
|---------|-----------|
| `local-server.js` | Dev proxy (Node.js, porta 3000). Rotas: `/chat`, `/transcribe`, `/tts`, `/usage`. Auth via Supabase JWT, usage via RPCs `check_usage`/`increment_usage`. Só `/chat` conta como uso. |
| `worker.js` | Cloudflare Worker (produção). Mesma lógica do local-server. |
| `wrangler.toml` | Config do worker. Secrets via `wrangler secret put`. |
| `.env` / `.env.example` | Env vars: ANTHROPIC_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |

### `web/` — Site (Next.js 16 + Supabase + Tailwind 4)

| Rota | Descrição |
|------|-----------|
| `/` | Landing page com buddy animado, pricing, features |
| `/login` | Login email/senha via Supabase auth |
| `/register` | Cadastro com nome, email, senha |
| `/dashboard` | Perfil, uso, plano, próximo pagamento, histórico de pagamentos, feedback, download, token do app |
| `/upgrade` | 3 planos (Free/Pro/Unlimited), checkout via AbacatePay SDK |
| `/api/checkout/create-subscription` | Cria billing no AbacatePay, retorna URL de checkout |
| `/api/webhook/abacatepay` | Recebe webhooks v1 (billing.paid, refunded, subscription.canceled), atualiza tier |

### `web/supabase/` — Schema e migrations

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Extends auth.users: email, display_name, tier (free/pro/unlimited), subscription_id, subscription_status, abacatepay_customer_id, pending_plan, current_period_end |
| `usage` | Contagem de uso por período (unique constraint em user_id + period_start) |
| `webhook_events` | Idempotência de webhooks (PK = event id) |
| `payments` | Histórico de pagamentos (billing_id, amount, plan, paid_at) |
| `feedback` | Mensagens dos usuários (user_id, email, message) |

RPCs: `check_usage(p_user_id)` retorna tier/used/limit/remaining/allowed. `increment_usage(p_user_id)` faz upsert atômico.

### `tests/Tico.Tests/` — Testes (xUnit + NSubstitute)

56 testes cobrindo: CompanionManager state machine + OmniParser fallback, ConversationHistory trimming, AppSettings roundtrip, ProxyClient SSE parsing, AuthService JWT parsing + expiration, TokenStore DPAPI roundtrip + encryption, AudioCaptureService RMS power, OmniParserClient (HTTP + timeout + error), ElementListFormatter (format + truncation), PointingManager v2 (ID match + fuzzy fallback).

### `clicky/` — Referência (macOS/Swift)

Repositório do Clicky (app macOS original) mantido como referência de design. Não é buildado — só consultado.

### `docs/superpowers/specs/`

| Spec | Status |
|------|--------|
| `2026-04-08-puckswin-clicky-rewrite.md` | **Ativo** — define spring physics, Bézier flight, POINT tag protocol, system prompt PT-BR |
| `2026-04-08-puckswin-v2-enhancements.md` | Superseded pelo clicky-rewrite |
| `2026-04-14-omniparser-integration-design.md` | **Ativo** — OmniParser v2 pra detecção de elementos UI, substitui `/locate`, match por ID |

## Tiers e Preços

| Tier | Preço | Usos | Período |
|------|-------|------|---------|
| `free` | R$0 | 10/dia | Reseta diariamente |
| `pro` | R$45/mês | 500/mês | Reseta mensalmente |
| `unlimited` | R$99,90/mês | Ilimitado | — |

Pagamento via **AbacatePay** (PIX + Cartão de Crédito).

## Setup local (dev)

### Pré-requisitos
- .NET 8 SDK (Windows)
- Node.js 20+
- Conta ElevenLabs com API key (pra TTS)
- Conta Supabase com o schema aplicado
- Conta AbacatePay (pra testar pagamentos)

### 1. Supabase
Aplique os migrations em ordem no SQL Editor:
- `web/supabase/migrations/0001_usage_unique_and_upsert.sql`
- `web/supabase/migrations/0002_abacatepay.sql`
- `web/supabase/migrations/0003_payments_history.sql`
- `web/supabase/migrations/0004_feedback.sql`

Ou use `web/supabase/schema.sql` pra fresh install.

### 2. Proxy
```bash
cd proxy
cp .env.example .env
# Edite .env com suas chaves
node local-server.js
```

### 3. Web
```bash
cd web
cp .env.example .env
# Edite .env com suas chaves
npm install
npm run dev
```

### 4. App desktop
```bash
dotnet run --project src/Tico.App/Tico.App.csproj
```

### 5. Testes
```bash
dotnet test Tico.sln
```

## Segurança

### Arquitetura de autenticação

```
Desktop App          Web App              Proxy (CF Worker)
    │                   │                       │
    │  email/senha      │  email/senha          │
    └──► Supabase ◄─────┘                       │
         Auth                                   │
           │                                    │
           ▼                                    │
      JWT (access_token)                        │
           │                                    │
           ├────── Bearer header ──────────────►│
           │                                    │ POST /auth/v1/user
           │                                    ├──► Supabase (valida JWT)
           │                                    │◄── userId
           │                                    │
           │                                    ▼
           │                               Rota autorizada
```

Toda request ao proxy exige `Authorization: Bearer <jwt>`. O proxy valida o token contra Supabase em cada request — não há cache de sessão server-side.

### Proteção de dados

| Camada | Mecanismo | Detalhe |
|--------|-----------|---------|
| **Desktop token** | Windows DPAPI | `DataProtectionScope.CurrentUser` — encriptado por usuário/máquina em `%APPDATA%\Tico\session.dat` |
| **Web session** | Supabase SSR cookies | `httpOnly`, refresh automático via `middleware.ts` em cada request |
| **Service role key** | Server-side only | Nunca exposta ao browser ou ao desktop app — usada apenas no proxy e API routes |
| **Supabase anon key** | Pública por design | Hardcoded em `AppSettings.cs` — permite apenas operações autenticadas (RLS ativo) |
| **Secrets do proxy** | Environment variables | `.env` local, `wrangler secret put` em produção — gitignored |

### CORS

| Ambiente | Política | Origens permitidas |
|----------|----------|--------------------|
| **Produção** (worker.js) | Whitelist | `https://tico.app`, `https://www.tico.app` |
| **Local** (local-server.js) | Localhost only | `http://localhost:*` |

O desktop app (WPF/HttpClient) não envia header `Origin` — CORS não se aplica. Requests de browsers em origens não autorizadas são bloqueados pela ausência do header `Access-Control-Allow-Origin` na resposta.

### Rate limiting

| Camada | Tipo | Limite | Escopo |
|--------|------|--------|--------|
| **Per-IP** | Sliding window (in-memory) | 60 req/min | Todas as rotas do proxy |
| **Per-user (tier)** | Supabase RPCs | free: 10/dia, pro: 500/mês, unlimited: sem limite | Apenas `/chat` |

Rate limiting por IP protege contra brute-force e abuse de rede. Rate limiting por tier (usage) protege contra uso excessivo por usuário autenticado.

### Proteção contra injection

| Vetor | Proteção | Arquivo |
|-------|----------|---------|
| **XSS** (web) | CSP header (`script-src 'self'`, `frame-ancestors 'none'`) | `next.config.ts` |
| **Clickjacking** | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | `next.config.ts` |
| **MIME sniffing** | `X-Content-Type-Options: nosniff` | `next.config.ts` |

### Security headers (Next.js)

Headers configurados em `next.config.ts` para todas as rotas:

- `Content-Security-Policy` — restringe scripts, styles, connections, frames
- `X-Frame-Options: DENY` — bloqueia embedding em iframes
- `X-Content-Type-Options: nosniff` — previne MIME type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — limita leak de referrer
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — desativa APIs desnecessárias no browser
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — força HTTPS

### Webhook verification

Webhooks da AbacatePay são verificados por duas vias (qualquer uma válida):
1. **HMAC-SHA256** — `X-Webhook-Signature` header, comparado com `crypto.timingSafeEqual()` (previne timing attacks)
2. **Query string secret** — fallback via `?webhookSecret=...`

Idempotência garantida via tabela `webhook_events` (PK = event id) — reprocessar o mesmo webhook é no-op.

### Senhas

Mínimo de **8 caracteres** validado no frontend (register) e enforçado pelo Supabase Auth no backend.

## Regras de código e boas práticas

### C# (Tico.App)
- **Namespace** = `Tico.App.*` (Config, Core, Services, UI, Helpers)
- **Dependency injection manual** via construtores (sem container IoC — o app é simples o suficiente)
- **Interfaces pra serviços mockáveis**: IAudioCaptureService, IScreenCaptureService, IProxyClient, IAuthService, ISessionProvider
- **InternalsVisibleTo** de Tico.App → Tico.Tests pra testar helpers internos (ex: ComputeRmsPower)
- **Testes**: lógica pura em métodos static (ParseSession, ParseUsage, IsExpired, ParsePointTag, ComputeRmsPower) testados unitariamente; integração HTTP mockada via NSubstitute nas interfaces
- **Threading**: NAudio callbacks rodam em worker thread. Audio power (double) é atomic em x64 — não precisa de Dispatcher.Invoke. Mas UI updates (ShowSpeechBubble, UpdateState) DEVEM usar Dispatcher.Invoke
- **Async/sync boundary**: NUNCA usar `.GetAwaiter().GetResult()` na UI thread do WPF (deadlock). Use `Task.Run(() => ...).GetAwaiter().GetResult()` ou async void event handlers
- **DPAPI** pra tokens (DataProtectionScope.CurrentUser) — encripta no %APPDATA%\Tico\session.dat

### TypeScript (Web)
- **Next.js 16** — `middleware.ts` (renomear pra `proxy.ts` quando migrar pro novo convention)
- **Supabase SSR** via `@supabase/ssr`: `createBrowserClient` no client, `createServerClient` no server, `createServiceClient` com service role key pra webhooks/admin
- **Session em cookies** (não localStorage) — `middleware.ts` refresha cookies em cada request
- **API routes**: POST only, auth via cookie session, erros retornam `{error: string}` + status code
- **Webhook handler**: verifica HMAC-SHA256 OU query string secret, idempotente via `webhook_events` table
- **AbacatePay SDK** (`abacatepay-nodejs-sdk`) pra billing — usa inline customer com placeholders, AbacatePay coleta CPF real no checkout deles

### Geral
- **Sem commits de .env** — sempre gitignored, secrets em .env.example como template
- **Supabase anon key** pode ser commitada (é pública por design) — já está hardcoded em AppSettings.cs
- **Service role key** NUNCA no client — só em proxy server-side e web API routes
- **Português brasileiro** em toda UI (tudo minúsculo, casual, sem formatação markdown no TTS)

## Feito nesta sessão (2026-04-16)

- [x] **OmniParser v2 integration**: substitui Claude Vision como detector de elementos UI. Serverless GPU recebe screenshot, retorna bounding boxes + labels + IDs. Claude passa a referenciar elementos por ID em vez de coordenadas pixel-precise.
- [x] **`/locate` endpoint eliminado**: segunda chamada a Claude Vision não existe mais — match de ID feito localmente via `ParsePointTagV2` com fallback fuzzy por label.
- [x] **Parse em paralelo com Whisper**: `Task.WhenAll(transcribeTask, parseTask)` — zero latência adicional. Timeout dedicado de 3s no OmniParser.
- [x] **Element list no prompt**: `ElementListFormatter` formata lista textual (`#id "label" type [x1,y1,x2,y2]`) injetada no contexto. Trunca a 200 elementos priorizando proximidade ao cursor pra UIs densas.
- [x] **System prompt dual**: instruções condicionais — usa `[POINT:id:label]` quando há lista, `[POINT:x,y:label]` quando não. Fallback graceful se OmniParser falhar.
- [x] **15 testes novos**: `OmniParserClientTests` (4), `ElementListFormatterTests` (5), `PointingManagerV2Tests` (6). Total: 56 testes passando.
- [x] **Settings OmniParser**: `OmniParserUrl` + `OmniParserApiKey` em AppSettings. Quando URL vazia, OmniParser desabilitado e app funciona como antes.

## Feito em sessões anteriores (2026-04-11)

- [x] **Buddy paralelo ao TTS**: buddy voa pro alvo ao mesmo tempo que o áudio toca (era sequencial)
- [x] **Security hardening**: CORS restrito, rate limiting por IP, security headers, SSML/command injection fix
- [x] **Olhos do Tico no login**: olhos seguem o cursor do usuário na página de login (mesma lógica da landing)
- [x] **Senha mínima 8 chars**: fortalecida de 6 pra 8 no registro
- [x] **Seção de segurança no README**: documentação completa de auth, CORS, rate limiting, injection prevention
- [x] **ElevenLabs TTS**: migração de Azure/Edge TTS → ElevenLabs Flash v2.5 (vozes mais naturais, ~300ms latência)

## Feito em sessões anteriores (2026-04-10)

- [x] **Pointer precision**: prompt engineering (mirar no centro, assertividade, UIs densas)
- [x] **Crop da janela ativa**: segunda imagem em alta resolução pra identificar ícones pequenos
- [x] **Window bounds no contexto**: Claude sabe exatamente onde a janela ativa está no screenshot
- [x] **Coordinate clamping**: previne coordenadas fora dos limites do screenshot
- [x] **Buddy offset separado**: PointOffset (0,0) no voo, cursor-follow inalterado
- [x] **Glow underline removido**: buddy indica o elemento sem cobrir ele
- [x] **JPEG quality 90**: mais detalhe em ícones e texto pequeno
- [x] **Precision locate (/locate)**: segunda chamada de visão focada pra coordenadas pixel-precise
- [x] **Streaming TTS**: áudio toca por frase enquanto Claude ainda streama, reduz latência ~3s
- [x] **LoginWindow loading**: spinner animado + campos desabilitados durante auth
- [x] **Cross-reference de conhecimento**: prompt instrui Claude a usar conhecimento do app pra validar ícones

## Próximos passos — rumo à produção

### Deploy (bloqueiam lançamento)
- [ ] Cloudflare Worker deploy com secrets configurados (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, etc.)
- [ ] **Deploy do OmniParser v2** em serverless GPU (Replicate, RunPod ou Modal) — endpoint `/parse` com API key, ~300-500ms por inferência em T4/A10G
- [ ] Configurar `OmniParserUrl` e `OmniParserApiKey` em `AppSettings` do app em produção
- [ ] Deploy do web (Vercel ou similar)
- [ ] Domínio tico.app configurado (DNS, HTTPS)
- [ ] Installer/updater (MSIX ou Squirrel.Windows)
- [ ] Landing page: botão "baixar" com link real pro installer

### Funcionalidades pendentes
- [ ] Subscription cancel UX (botão "Cancelar assinatura" no SettingsWindow + API route)
- [ ] Adicionar ao Login do App.cs a caixinha de 'Lembrar' e salvar o login do usuário dentro do app.
- [ ] Renovação automática (MULTIPLE_PAYMENTS na AbacatePay quando disponível na v1)

### Polimento geral (próxima sessão)
- [ ] Error handling mais granular no CompanionManager (network timeout vs auth expired vs usage limit — mensagens diferentes)
- [ ] "Mostrar Tico" toggle precisa funcionar com transient mode corretamente
- [ ] Settings: mostrar current_period_end formatado
- [ ] Tratar `middleware.ts` deprecation → renomear pra `proxy.ts` (Next.js 16)
- [ ] Multi-monitor: testar com setup real de 2+ monitores
- [ ] Return flight: testar cancelamento por cursor move >100px
- [ ] Audio waveform: validar com microfones diferentes
- [ ] Testar ElevenLabs TTS end-to-end (latência, qualidade, edge cases)

### Marca e lançamento (2026-04-12)
- [ ] Criar perfil LinkedIn da marca Tico
- [ ] Criar perfil X (Twitter) da marca Tico
- [ ] Estratégia de divulgação orgânica (conteúdo, demos, posts)
- [ ] Separar logins de teste para beta testers de áreas específicas
- [ ] Coletar feedback dos primeiros testers

## Licença

Proprietário. Todos os direitos reservados.

---

feito por [trotta.dev](https://trotta.dev)
