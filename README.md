# Tico — seu buddy de IA no Windows

Tico é um assistente de IA que vive na tela do usuário. Ele segue o cursor como um companheiro, ouve perguntas por voz, vê a tela via screenshot, e responde em voz alta apontando para elementos na tela. Suporta múltiplos idiomas — responde na mesma língua do usuário. Pesquisa na web automaticamente quando necessário.

## URLs de produção

| Serviço | URL | Hospedagem |
|---------|-----|------------|
| Landing + Dashboard + Webhooks | `https://ticoai.app` | Vercel |
| API Proxy (Claude, Whisper, TTS) | `https://api.ticoai.app` | Cloudflare Worker |
| Downloads (installer + version.json) | `https://dl.ticoai.app` | Cloudflare R2 (bucket: `tico-downloads`) |
| Auth + Database | Supabase (Pro plan) | Supabase |
| Pagamento PIX | AbacatePay (API v1, webhook v1) | AbacatePay |
| Pagamento Cartão (USD) | Stripe | Stripe |
| Email transacional | Resend (SMTP via Supabase) | Resend |
| Contato | support@ticoai.app | Google Workspace |

## Arquitetura

```
┌──────────────────────┐
│   Tico.App (WPF)     │  Windows desktop — buddy cursor, hotkey bindável,
│   C# .NET 8          │  captura de tela + áudio, TTS playback, pause/resume
└──────────┬───────────┘
           │ HTTPS (Bearer JWT)
           ▼
┌──────────────────────┐
│   api.ticoai.app     │  Cloudflare Worker (prod) / Node.js (dev local)
│   /chat /transcribe  │  Roteia pra Claude (+ web search), Whisper, OpenAI TTS
│   /tts /usage        │  Valida JWT do Supabase, enforça limites de uso
└──────────┬───────────┘
           │
    ┌──────┴───────┐
    ▼              ▼
 Anthropic     OpenAI
 Claude API    Whisper + TTS
 + Web Search

┌──────────────────────────────────────────────────┐
│   ticoai.app (Next.js 16 + Supabase SSR)         │
│   Landing, login, register, verify email,        │
│   dashboard, /upgrade, /updates (blog),          │
│   /terms, /privacy, webhooks (Stripe+AbacatePay) │
│   i18n (PT-BR + EN), locale toggle, OG tags      │
│   Pagamento dual: PIX (BRL) + Card (USD)         │
└──────────────────────────────────────────────────┘
```

## Componentes

### `src/Tico.App/` — Aplicativo desktop (WPF .NET 8)

| Pasta | Descrição |
|-------|-----------|
| `Core/` | CompanionManager (state machine principal), CompanionState, ConversationHistory |
| `Services/` | AuthService, TokenStore (DPAPI), SessionManager, ProxyClient, AudioCaptureService, ScreenCaptureService, PointingManager (v1+v2), OmniParserClient, ElementListFormatter, WindowsSpeechService, HotkeyService (bindável), UpdateChecker |
| `UI/` | BuddyCursorWindow (spring physics + Bézier + waveform + speech bubbles), OverlayWindow, SettingsWindow (persistente na taskbar, ícone Tico), LoginWindow, TrayIconManager (ícone Tico com estados), ChatHistoryButton (pause TTS + counter badge), ChatHistoryWindow |
| `Helpers/` | AudioHelper (TTS playback com pause/resume), CursorHelper, ImageHelper |
| `Config/` | AppSettings (JSON em `%APPDATA%\Tico/settings.json`), Strings (i18n PT-BR + EN auto-detect) |

**Features do desktop:**
- Hotkey bindável (default F8, customizável no painel)
- Pause/resume TTS com botão no topo da tela
- Counter badge de conversas no histórico
- Settings persistente na taskbar com ícone Tico (minimiza em vez de fechar)
- Update checker automático no startup
- Ícone Tico (bolinha roxa com olhos) no tray e taskbar
- Não esconde a taskbar do Windows (fix `WS_EX_NOACTIVATE`)
- i18n automático (PT-BR se sistema em português, EN caso contrário)
- Web search integrado (Claude busca na web quando necessário)

### `proxy/` — Proxy server

| Arquivo | Descrição |
|---------|-----------|
| `local-server.js` | Dev proxy (Node.js, porta 3000). |
| `worker.js` | Cloudflare Worker (produção). CORS: `ticoai.app`. Web search habilitado. |
| `wrangler.toml` | Config do worker (`tico-proxy`). |

**Secrets do Worker (4 essenciais):** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**TTS:** OpenAI TTS (`tts-1`, voz `nova`). Migrado de ElevenLabs em 2026-05-15.

**Web Search:** Claude `web_search_20250305` (built-in, server-side, max 3 buscas/request).

**Whisper:** auto-detect de idioma — suporta qualquer língua.

### `web/` — Site (Next.js 16 + Supabase + Tailwind 4)

| Rota | Descrição |
|------|-----------|
| `/` | Landing: hero + trust badges + features + how it works + testimonials + pricing + FAQ + CTA + user counter |
| `/login` | Login email/senha |
| `/register` | Cadastro (nome, email, senha + confirmação) → tela de verificação de email com timer de reenvio |
| `/dashboard` | Perfil, uso, plano, pagamentos, feedback, download, token, gerenciar assinatura |
| `/upgrade` | 3 planos, checkout dual: PIX (AbacatePay) + Card (Stripe) |
| `/updates` | Blog de atualizações (posts em markdown) |
| `/updates/[slug]` | Post individual com likes + comentários (autenticado) |
| `/terms` | Termos de uso |
| `/privacy` | Política de privacidade |
| `/api/checkout/create-subscription` | Checkout PIX ou Stripe |
| `/api/checkout/customer-portal` | Stripe Customer Portal |
| `/api/webhook/abacatepay` | Webhook AbacatePay v1/v2 |
| `/api/webhook/stripe` | Webhook Stripe (4 eventos) |
| `/api/stats` | Contador de usuários ativos (profiles + 50 base, cache 5min) |
| `/api/posts` | GET likes/comments, POST like/unlike/comment |

**i18n:** `src/lib/i18n.ts` com ~160 chaves em PT-BR e EN. Toggle PT/EN em todas as páginas.

**Blog:** Posts em `content/updates/*.md` com frontmatter. Renderizados via `gray-matter` + `marked`.

**OG/Social:** Open Graph + Twitter Card meta tags. Imagem em `dl.ticoai.app/og-image.png`.

### `web/supabase/` — Schema e migrations

| Tabela | Descrição |
|--------|-----------|
| `profiles` | tier, subscription_id, subscription_status, pending_plan, current_period_end, stripe_customer_id, payment_provider |
| `usage` | Contagem por período, RPCs check_usage/increment_usage |
| `payments` | Histórico (amount, plan, paid_at, provider, currency) |
| `feedback` | Mensagens dos usuários |
| `webhook_events` | Idempotência de webhooks |
| `post_likes` | Likes em posts (unique por user+slug) |
| `post_comments` | Comentários em posts |

**Migrations:** 0001 a 0006 (0006 = blog interactions)

**Email:** Custom SMTP via Resend (`smtp.resend.com`), sender `support@ticoai.app`. Templates HTML personalizados para todos os 6 tipos de email (confirm signup, reset password, magic link, change email, invite, reauthentication).

### `tests/Tico.Tests/` — Testes (xUnit + NSubstitute)

56 testes cobrindo: CompanionManager, ConversationHistory, AppSettings, ProxyClient SSE, AuthService JWT, TokenStore DPAPI, AudioCaptureService RMS, OmniParserClient, ElementListFormatter, PointingManager v2.

## Tiers e Preços

| Tier | BRL (PIX) | USD (Card) | Usos | Período |
|------|-----------|------------|------|---------|
| `free` | R$0 | — | 10/dia | Reseta diariamente |
| `pro` | R$45/mês | $9.99/mo | 500/mês | Reseta mensalmente |
| `unlimited` | R$99,90/mês | $19.99/mo | Ilimitado | — |

## Deploy

### Web (Vercel)
Push para o repositório → Vercel rebuilda automaticamente.

### Worker (Cloudflare)
```bash
cd proxy && npx wrangler deploy
```

### Installer (desktop app)
```bash
# 1. Bump <Version> no .csproj
# 2. Publish + build installer
dotnet publish src/Tico.App/Tico.App.csproj -c Release -r win-x64 --self-contained -o ./publish
"/c/Users/pedro/AppData/Local/Programs/Inno Setup 6/ISCC.exe" installer.iss

# 3. Upload pro R2
npx wrangler r2 object put tico-downloads/TicoSetup.exe --file=output/TicoSetup.exe --content-type="application/octet-stream" --remote
# Atualizar output/version.json e upload
npx wrangler r2 object put tico-downloads/version.json --file=output/version.json --content-type="application/json" --remote
```

### Blog (novo post)
Criar `web/content/updates/meu-post.md`:
```markdown
---
title: titulo do post
slug: meu-post
date: 2026-05-17
author: Equipe Tico
---
conteudo em markdown aqui.
```
Push → Vercel rebuilda.

## Setup local (dev)

### Pré-requisitos
- .NET 8 SDK (Windows)
- Node.js 20+
- Conta Supabase com schema aplicado
- Conta AbacatePay (PIX) + Conta Stripe (Card)
- Conta OpenAI (Whisper + TTS)
- Conta Anthropic (Claude)

### 1. Supabase
Aplique as migrations em ordem no SQL Editor (0001 a 0006).

### 2. Proxy
```bash
cd proxy
cp .env.example .env  # Edite com suas chaves
node local-server.js
```

### 3. Web
```bash
cd web
cp .env.example .env  # Edite com suas chaves
npm install && npm run dev
```

**Env vars necessárias:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ABACATEPAY_API_TOKEN=abc_pro_...  (API v1!)
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

### Proteção de dados

| Camada | Mecanismo |
|--------|-----------|
| Desktop token | Windows DPAPI (`%APPDATA%\Tico\session.dat`) |
| Web session | Supabase SSR cookies, httpOnly |
| Service role key | Server-side only (proxy + API routes) |
| Secrets do proxy | `wrangler secret put` em prod, `.env` local |

### CORS, Rate Limiting, Webhooks

- **CORS prod:** `ticoai.app` only. Desktop app não envia Origin
- **Rate limit:** 60 req/min por IP (proxy), tier limits por user (apenas `/chat`)
- **AbacatePay:** HMAC-SHA256 + query string secret, `timingSafeEqual`
- **Stripe:** `stripe.webhooks.constructEvent()` com signing secret
- **Idempotência:** tabela `webhook_events`

### Security headers (Next.js)

CSP (com `unsafe-eval` apenas em dev), X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS, Referrer-Policy, Permissions-Policy.

## Custos mensais (produção)

| Serviço | Custo |
|---------|-------|
| Supabase Pro | $25/mês |
| Vercel (Hobby) | $0 |
| Cloudflare Worker + R2 | $0 (free tier) |
| Resend (SMTP) | $0 (até 3k emails/mês) |
| Anthropic (Claude) | Pay-per-use (~$0.01-0.05/request) |
| OpenAI (Whisper + TTS) | Pay-per-use (~$0.01/request) |
| Stripe | 2.9% + $0.30 por transação |
| AbacatePay | Taxa por transação PIX |
| **Fixo total** | **~$25/mês** + usage APIs |

## Histórico de sessões

### 2026-05-15/16 — Stripe, i18n, deploy completo, polimento

- [x] Stripe integration (checkout, webhook, customer portal)
- [x] Pagamento dual PIX (BRL) + Card (USD)
- [x] i18n completo (~160 chaves PT-BR + EN) — web + desktop
- [x] Deploy web (Vercel), worker (Cloudflare), downloads (R2)
- [x] Installer com Inno Setup + ícone Tico personalizado
- [x] Update checker automático (version.json no R2)
- [x] Multilingual — system prompt EN, Whisper auto-detect, Claude responde no idioma do usuário
- [x] TTS migrado de ElevenLabs para OpenAI TTS (`tts-1`, voz `nova`)
- [x] Web search integrado (Claude `web_search_20250305`, worldwide)
- [x] Settings persistente na taskbar com ícone Tico
- [x] Hotkey bindável (qualquer tecla/combo, salva e reinicia hook)
- [x] Pause/resume TTS + counter badge no histórico
- [x] Fix taskbar auto-hide (WS_EX_NOACTIVATE + bounds -1px)
- [x] Fix Settings crash (CheckBox events durante InitializeComponent)
- [x] Fix multipart/form-data incompatível entre .NET e Cloudflare Workers
- [x] Ícone Tico HD (256x256) na taskbar + tray (bolinha roxa com olhos + estados coloridos)
- [x] Favicon SVG (bolinha roxa gradient + olhos)
- [x] OG meta tags + Twitter Card (imagem 1200x630 no R2)
- [x] Trust badges, testimonials, FAQ accordion na landing
- [x] Termos de uso (`/terms`) e Política de privacidade (`/privacy`)
- [x] Blog de atualizações (`/updates`) com likes + comentários
- [x] Contador de usuários ativos na landing (API `/api/stats`)
- [x] Verificação de email pós-cadastro com timer de reenvio
- [x] Confirmação de senha no registro (double input)
- [x] Email transacional via Resend (SMTP custom, sender support@ticoai.app)
- [x] Templates de email HTML personalizados (6 tipos, inglês)
- [x] Footer com links de termos, privacidade, LinkedIn
- [x] Dashboard: logo clicável volta para landing
- [x] CSP atualizado (dl.ticoai.app, fonts.gstatic.com, api.ticoai.app, unsafe-eval dev only)
- [x] Supabase Pro plan ($25/mês) — rate limits desbloqueados

### 2026-04-16 — OmniParser v2

- [x] OmniParser v2 integration, `/locate` eliminado, parse paralelo com Whisper
- [x] Element list no prompt, system prompt dual, 15 testes novos (total: 56)

### 2026-04-11 — Security + TTS

- [x] Security hardening, ElevenLabs TTS, buddy paralelo ao TTS

### 2026-04-10 — Pointer precision + Streaming

- [x] Pointer precision, streaming TTS, crop janela ativa, JPEG quality 90

## Funcionalidades pendentes

- [ ] Deploy OmniParser v2 em serverless GPU
- [ ] Code signing (IV certificate) para eliminar SmartScreen warnings
- [ ] Subscription cancel UX no SettingsWindow do desktop
- [ ] "Lembrar login" checkbox no LoginWindow
- [ ] Error handling granular no CompanionManager
- [ ] Multi-monitor: testar com setup real
- [ ] Demo GIF/vídeo na landing page
- [ ] Google OAuth no registro/login

## Licença

Proprietário. Todos os direitos reservados.

---

feito por [trotta.dev](https://trotta.dev)
