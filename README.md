# Tico — seu buddy de IA no Windows

Tico é um assistente de IA que vive na tela do usuário. Ele segue o cursor como um companheiro, ouve perguntas por voz, vê a tela via screenshot, e responde em voz alta apontando para elementos na tela. Suporta múltiplos idiomas — responde na mesma língua do usuário.

## URLs de produção

| Serviço | URL | Hospedagem |
|---------|-----|------------|
| Landing + Dashboard + Webhooks | `https://ticoai.app` | Vercel |
| API Proxy (Claude, Whisper, TTS) | `https://api.ticoai.app` | Cloudflare Worker |
| Downloads (installer + version.json) | `https://dl.ticoai.app` | Cloudflare R2 (bucket: `tico-downloads`) |
| Auth + Database | `https://tzpwebrpnqqygzpqxznb.supabase.co` | Supabase |
| Pagamento PIX | AbacatePay (webhook v2) | AbacatePay |
| Pagamento Cartão (USD) | Stripe | Stripe |

## Arquitetura

```
┌──────────────────────┐
│   Tico.App (WPF)     │  Windows desktop — buddy cursor, hotkey F8,
│   C# .NET 8          │  captura de tela + áudio, TTS playback
└──────────┬───────────┘
           │ HTTPS (Bearer JWT)
           ▼
┌──────────────────────┐
│   api.ticoai.app     │  Cloudflare Worker (prod) / Node.js (dev local)
│   /chat /transcribe  │  Roteia pra Claude, Whisper, ElevenLabs TTS
│   /tts /usage        │  Valida JWT do Supabase, enforça limites de uso
└──────────┬───────────┘
           │
    ┌──────┴───────┐
    ▼              ▼
 Anthropic     OpenAI        ElevenLabs
 Claude API    Whisper       TTS (Flash v2.5)

┌──────────────────────────────────────────────┐
│   ticoai.app (Next.js 16 + Supabase SSR)     │
│   Landing, login, register, dashboard,       │
│   /upgrade, webhooks (Stripe + AbacatePay)   │
│   i18n (PT-BR + EN), locale toggle           │
│   Pagamento dual: PIX (BRL) + Card (USD)     │
└──────────────────────────────────────────────┘
```

## Componentes

### `src/Tico.App/` — Aplicativo desktop (WPF .NET 8)

| Pasta | Descrição |
|-------|-----------|
| `Core/` | CompanionManager (state machine principal), CompanionState, ConversationHistory |
| `Services/` | AuthService (Supabase REST), TokenStore (DPAPI), SessionManager, ProxyClient, AudioCaptureService, ScreenCaptureService, PointingManager (v1 coord-based + v2 ID-based), OmniParserClient, ElementListFormatter, WindowsSpeechService, HotkeyService, UpdateChecker (verifica `dl.ticoai.app/version.json` no startup) |
| `UI/` | BuddyCursorWindow (spring physics + Bézier flight + waveform + spinner + speech bubbles), OverlayWindow (glow underline), SettingsWindow, LoginWindow, TrayIconManager (inclui notificação de update), ChatHistoryButton, ChatHistoryWindow |
| `Helpers/` | AudioHelper (TTS playback), CursorHelper (P/Invoke GetCursorPos), ImageHelper (screen capture + DPI + downscale) |
| `Config/` | AppSettings (JSON em `%APPDATA%\Tico/settings.json`) |

**Defaults de produção em AppSettings:**
- `ProxyBaseUrl` = `https://api.ticoai.app`
- `WebBaseUrl` = `https://ticoai.app`
- `SupabaseUrl` = `https://tzpwebrpnqqygzpqxznb.supabase.co`

### `proxy/` — Proxy server

| Arquivo | Descrição |
|---------|-----------|
| `local-server.js` | Dev proxy (Node.js, porta 3000). Rotas: `/chat`, `/transcribe`, `/tts`, `/usage`. |
| `worker.js` | Cloudflare Worker (produção). Mesma lógica. CORS: `ticoai.app`. |
| `wrangler.toml` | Config do worker (`tico-proxy`). Secrets via `wrangler secret put`. |
| `.env` | Env vars locais (gitignored). |

**Secrets do Worker (6):** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Whisper:** auto-detect de idioma (sem `language` hardcoded) — suporta qualquer língua.

### `web/` — Site (Next.js 16 + Supabase + Tailwind 4)

| Rota | Descrição |
|------|-----------|
| `/` | Landing page com buddy animado, pricing, features, i18n (PT/EN) |
| `/login` | Login email/senha via Supabase auth |
| `/register` | Cadastro com nome, email, senha |
| `/dashboard` | Perfil, uso, plano, pagamentos, feedback, download, token, gerenciar assinatura (Stripe portal) |
| `/upgrade` | 3 planos (Free/Pro/Unlimited), checkout dual: PIX (AbacatePay) + Card (Stripe) |
| `/api/checkout/create-subscription` | Cria checkout PIX ou Stripe conforme `paymentMethod` |
| `/api/checkout/customer-portal` | Cria sessão do Stripe Customer Portal (gerenciar/cancelar assinatura) |
| `/api/webhook/abacatepay` | Webhook v1/v2 (billing.paid, refunded, subscription.canceled) |
| `/api/webhook/stripe` | Webhook Stripe (checkout.session.completed, invoice.paid, customer.subscription.deleted/updated) |

**i18n:** `src/lib/i18n.ts` com ~120 chaves em PT-BR e EN. Toggle PT/EN na nav de todas as páginas. Detecção automática via `Accept-Language` header + cookie `locale` override.

**Componentes i18n:** `src/components/LocaleToggle.tsx` — toggle discreto PT/EN usado nas 3 páginas.

### `web/supabase/` — Schema e migrations

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Extends auth.users: email, display_name, tier, subscription_id, subscription_status, pending_plan, current_period_end, abacatepay_customer_id, **stripe_customer_id**, **payment_provider** |
| `usage` | Contagem de uso por período (unique constraint em user_id + period_start) |
| `webhook_events` | Idempotência de webhooks (PK = event id, formato: `stripe:<event.id>` ou `<event>:<data.id>`) |
| `payments` | Histórico de pagamentos (billing_id, amount, plan, paid_at, **provider**, **currency**) |
| `feedback` | Mensagens dos usuários (user_id, email, message) |

**Migrations:**
1. `0001_usage_unique_and_upsert.sql`
2. `0002_abacatepay.sql`
3. `0003_payments_history.sql`
4. `0004_feedback.sql`
5. `0005_stripe_provider.sql` — adiciona `stripe_customer_id`, `payment_provider` em profiles + `provider`, `currency` em payments

RPCs: `check_usage(p_user_id)` retorna tier/used/limit/remaining/allowed. `increment_usage(p_user_id)` faz upsert atômico.

### `tests/Tico.Tests/` — Testes (xUnit + NSubstitute)

56 testes cobrindo: CompanionManager state machine + OmniParser fallback, ConversationHistory trimming, AppSettings roundtrip, ProxyClient SSE parsing, AuthService JWT parsing + expiration, TokenStore DPAPI roundtrip + encryption, AudioCaptureService RMS power, OmniParserClient (HTTP + timeout + error), ElementListFormatter (format + truncation), PointingManager v2 (ID match + fuzzy fallback).

### `clicky/` — Referência (macOS/Swift)

Repositório do Clicky (app macOS original) mantido como referência de design. Não é buildado — só consultado.

## Tiers e Preços

| Tier | BRL (PIX) | USD (Card) | Usos | Período |
|------|-----------|------------|------|---------|
| `free` | R$0 | — | 10/dia | Reseta diariamente |
| `pro` | R$45/mês | $9.99/mo | 500/mês | Reseta mensalmente |
| `unlimited` | R$99,90/mês | $19.99/mo | Ilimitado | — |

**PIX:** AbacatePay (BRL). **Card:** Stripe (USD). Checkout unificado via `/api/checkout/create-subscription`.

**Stripe Dashboard:**
- Products: Tico Pro ($9.99/mo) e Tico Unlimited ($19.99/mo)
- Webhook: `https://ticoai.app/api/webhook/stripe` — 4 eventos: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`
- Customer Portal: ativo (ver faturas, atualizar pagamento, cancelar)

## Fluxo de pagamento

```
Usuário clica "PIX · R$45" ou "Card · $9.99"
         │
         ▼
POST /api/checkout/create-subscription
   { plan: "pro", paymentMethod: "pix" | "card" }
         │
    ┌────┴────┐
    ▼         ▼
AbacatePay   Stripe
checkout     checkout
    │         │
    ▼         ▼
Webhook      Webhook
/abacatepay  /stripe
    │         │
    └────┬────┘
         ▼
activateSubscription() — shared function
   → profiles.tier = plan
   → profiles.subscription_status = 'active'
   → profiles.payment_provider = 'abacatepay' | 'stripe'
   → payments insert (amount, currency, provider)
```

## Update checker (auto-notificação)

O app verifica `https://dl.ticoai.app/version.json` 3s após o startup. Se houver versão mais nova, mostra mensagem no buddy + notificação clicável no tray que abre o browser pro download.

**`version.json` format:**
```json
{"version":"1.0.0","url":"https://dl.ticoai.app/TicoSetup.exe"}
```

**Versão atual do app:** definida em `src/Tico.App/Tico.App.csproj` → `<Version>1.0.0</Version>`

### Como lançar um update

```bash
# 1. Bump version no .csproj
#    <Version>1.1.0</Version>

# 2. Publish + build installer
dotnet publish src/Tico.App/Tico.App.csproj -c Release -r win-x64 --self-contained -o ./publish
"/c/Users/pedro/AppData/Local/Programs/Inno Setup 6/ISCC.exe" installer.iss

# 3. Upload installer e version.json pro R2
npx wrangler r2 object put tico-downloads/TicoSetup.exe --file=output/TicoSetup.exe --content-type="application/octet-stream" --remote
# Atualizar output/version.json com a nova versão
npx wrangler r2 object put tico-downloads/version.json --file=output/version.json --content-type="application/json" --remote
```

### Como redeploy o Worker

```bash
cd proxy
npx wrangler deploy
```

### Como redeploy o Web

Push para o repositório → Vercel rebuilda automaticamente.

## Installer

**Inno Setup 6** — gera `output/TicoSetup.exe` (~53MB). Script em `installer.iss`.

- Self-contained .NET 8 (win-x64)
- Instala em `%LOCALAPPDATA%\Programs\Tico` (não requer admin)
- Opções: atalho na área de trabalho, iniciar com Windows
- Abre o app após instalar

## Setup local (dev)

### Pré-requisitos
- .NET 8 SDK (Windows)
- Node.js 20+
- Conta ElevenLabs com API key
- Conta Supabase com o schema aplicado
- Conta AbacatePay (PIX) + Conta Stripe (Card)

### 1. Supabase
Aplique os migrations em ordem no SQL Editor (0001 a 0005) ou use `web/supabase/schema.sql` pra fresh install.

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
# Edite .env com suas chaves (Supabase + AbacatePay + Stripe)
npm install
npm run dev
```

**Env vars necessárias no web/.env:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ABACATEPAY_API_TOKEN=
ABACATEPAY_WEBHOOK_SECRET=
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_UNLIMITED=price_...
NEXT_PUBLIC_WEB_BASE_URL=http://localhost:3001
```

### 4. App desktop
```bash
dotnet run --project src/Tico.App/Tico.App.csproj
```
Para dev local, editar `%APPDATA%/Tico/settings.json` e trocar `proxyBaseUrl` para `http://localhost:3000`.

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

### Proteção de dados

| Camada | Mecanismo | Detalhe |
|--------|-----------|---------|
| **Desktop token** | Windows DPAPI | `DataProtectionScope.CurrentUser` em `%APPDATA%\Tico\session.dat` |
| **Web session** | Supabase SSR cookies | `httpOnly`, refresh automático via `middleware.ts` |
| **Service role key** | Server-side only | Proxy + API routes apenas |
| **Supabase anon key** | Pública por design | Hardcoded em `AppSettings.cs` — RLS ativo |
| **Secrets do proxy** | Environment variables | `.env` local, `wrangler secret put` em prod |

### CORS

| Ambiente | Origens permitidas |
|----------|--------------------|
| **Produção** (worker.js) | `https://ticoai.app`, `https://www.ticoai.app` |
| **Local** (local-server.js) | `http://localhost:*` |

### Rate limiting

| Camada | Limite | Escopo |
|--------|--------|--------|
| **Per-IP** | 60 req/min | Todas as rotas do proxy |
| **Per-user (tier)** | free: 10/dia, pro: 500/mês, unlimited: ilimitado | Apenas `/chat` |

### Webhook verification

**AbacatePay:** HMAC-SHA256 (`X-Webhook-Signature`) OU query string secret. `crypto.timingSafeEqual()`.

**Stripe:** `stripe.webhooks.constructEvent()` com `STRIPE_WEBHOOK_SECRET` (signing secret).

Idempotência: tabela `webhook_events` (PK = event id) — reprocessar é no-op.

### Security headers (Next.js)

`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`.

## Regras de código e boas práticas

### C# (Tico.App)
- **Namespace** = `Tico.App.*` (Config, Core, Services, UI, Helpers)
- **DI manual** via construtores (sem container IoC)
- **Interfaces pra serviços mockáveis**: IAudioCaptureService, IScreenCaptureService, IProxyClient, IAuthService, ISessionProvider
- **Testes**: lógica pura em métodos static testados unitariamente; HTTP mockado via NSubstitute
- **Threading**: audio power (double) é atomic em x64 — sem Dispatcher. UI updates DEVEM usar Dispatcher.Invoke
- **Async/sync boundary**: NUNCA `.GetAwaiter().GetResult()` na UI thread (deadlock). Use `Task.Run(...).GetAwaiter().GetResult()`
- **System prompt em inglês** com regra de detecção de idioma — Claude responde na língua do usuário

### TypeScript (Web)
- **Next.js 16** — `middleware.ts` pra refresh de sessão
- **Supabase SSR** — `createBrowserClient`, `createServerClient`, `createServiceClient`
- **i18n** — flat dictionary em `src/lib/i18n.ts`, ~120 chaves, PT-BR + EN
- **Pagamento dual** — shared functions `activateSubscription()` / `deactivateSubscription()` em `src/lib/payments.ts`
- **Checkout unificado** — rota única com `paymentMethod: 'pix' | 'card'`

## Histórico de sessões

### 2026-05-15 — Stripe, i18n, deploy produção, installer

- [x] **Stripe integration** — checkout card (USD), webhook (4 eventos), customer portal
- [x] **Pagamento dual** — PIX (AbacatePay, BRL) + Card (Stripe, USD) na mesma página de upgrade
- [x] **Migration 0005** — `stripe_customer_id`, `payment_provider` em profiles; `provider`, `currency` em payments
- [x] **Shared payment functions** — `activateSubscription()` / `deactivateSubscription()` usadas por ambos webhooks
- [x] **i18n completo** — ~120 chaves PT-BR + EN cobrindo landing, dashboard, upgrade
- [x] **Locale toggle** — componente PT/EN na nav das 3 páginas, cookie-based, auto-detect por Accept-Language
- [x] **Deploy web** — Vercel, domínio `ticoai.app`
- [x] **Deploy worker** — Cloudflare Worker, custom domain `api.ticoai.app`, 6 secrets configurados
- [x] **CORS atualizado** — `tico.app` → `ticoai.app`
- [x] **Installer** — Inno Setup 6, `TicoSetup.exe` (~53MB), self-contained .NET 8 win-x64
- [x] **R2 downloads** — bucket `tico-downloads`, custom domain `dl.ticoai.app`, TicoSetup.exe + version.json
- [x] **Update checker** — app verifica `dl.ticoai.app/version.json` no startup, notifica via buddy + tray balloon
- [x] **Multilingual** — system prompt em EN com regra de detecção de idioma, Whisper auto-detect (sem `language: "pt"` hardcoded)
- [x] **ProxyBaseUrl e WebBaseUrl** — defaults atualizados para produção (`api.ticoai.app`, `ticoai.app`)
- [x] **AbacatePay webhook** — configurado v2 em `ticoai.app/api/webhook/abacatepay`

### 2026-04-16 — OmniParser v2

- [x] OmniParser v2 integration (substitui Claude Vision para detecção de elementos)
- [x] `/locate` endpoint eliminado
- [x] Parse em paralelo com Whisper
- [x] Element list no prompt (ElementListFormatter, trunca a 200)
- [x] System prompt dual (POINT por ID ou coordenadas)
- [x] 15 testes novos (total: 56)

### 2026-04-11 — Security + TTS

- [x] Buddy paralelo ao TTS
- [x] Security hardening (CORS, rate limiting, headers)
- [x] ElevenLabs TTS (Flash v2.5)
- [x] Senha mínima 8 chars

### 2026-04-10 — Pointer precision + Streaming

- [x] Pointer precision (prompt engineering, crop da janela ativa, window bounds)
- [x] Streaming TTS (áudio por frase)
- [x] JPEG quality 90
- [x] Precision locate, cross-reference de conhecimento

## Funcionalidades pendentes

- [ ] Deploy OmniParser v2 em serverless GPU (Replicate/RunPod/Modal)
- [ ] Configurar `OmniParserUrl` + `OmniParserApiKey` em prod
- [ ] Subscription cancel UX no SettingsWindow
- [ ] "Lembrar login" checkbox no LoginWindow
- [ ] Error handling granular no CompanionManager (network timeout vs auth expired vs usage limit)
- [ ] Multi-monitor: testar com setup real de 2+ monitores
- [ ] `middleware.ts` → `proxy.ts` (Next.js 16 convention)

## Licença

Proprietário. Todos os direitos reservados.

---

feito por [trotta.dev](https://trotta.dev)
