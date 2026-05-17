# Tico Web — ticoai.app

Next.js 16 app deployed on Vercel. Landing page, auth, dashboard, blog, and payment APIs.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

Push to `master` — Vercel auto-deploys.

## Security Hardening (2026-05-17)

Based on a full pentest report by Paulo "Extencil" Cortez. Report at `PENTEST/RELATÓRIO-SEGURANÇA.md`.

### Web (this project)

**Rate Limiting** — all API endpoints are rate-limited:

| Endpoint | Limit | Key |
|----------|-------|-----|
| `GET /api/stats` | 30/min | IP |
| `GET /api/posts` | 60/min | IP |
| `POST /api/posts` | 20/min | User |
| `POST /api/feedback` | 2/hour | User |
| `POST /api/checkout/create-subscription` | 5/min | User |
| `POST /api/checkout/customer-portal` | 5/min | User |
| Webhooks (Stripe/AbacatePay) | No limit | Signature verified |

**Supabase RLS Hardening** (`supabase/migrations/0007_rls_hardening.sql`):
- Trigger `protect_profile_fields` blocks authenticated users from modifying `tier`, `subscription_id`, `subscription_status`, `pending_plan`, `current_period_end`, `payment_provider`, `stripe_customer_id`, `abacatepay_customer_id`, `email`. Only `service_role` can change these.
- RPCs `check_usage()` and `increment_usage()` validate `auth.uid() = p_user_id` (service_role bypasses for backend proxy).

**SEO / Meta Tags**:
- Google Analytics (gtag.js `G-11HMTJDK5N`)
- `sitemap.xml`, `robots.txt` (auto-generated)
- JSON-LD `SoftwareApplication` structured data
- Favicon + Apple Touch Icon
- PWA `manifest.webmanifest`
- `metadataBase` for canonical URLs

### Desktop App (v1.1.0)

| Fix | File | What changed |
|-----|------|-------------|
| URL allowlist on update flow | `UpdateChecker.cs` | Only allows `dl.ticoai.app`, `ticoai.app`, `github.com` over HTTPS |
| Immutable critical endpoints | `AppSettings.cs` | `ProxyBaseUrl`, `SupabaseUrl`, `SupabaseAnonKey`, `WebBaseUrl` are `[JsonIgnore]` constants — can't be overridden from `settings.json` |
| Strip old screenshots from history | `ConversationHistory.cs` | `MessagesForApi` sends images only for the latest user message |
| Server-side logout | `AuthService.cs`, `SessionManager.cs` | Calls Supabase `POST /auth/v1/logout` before clearing local session |
| No sensitive data in logs | `CompanionManager.cs` | `Log()` is `[Conditional("DEBUG")]` — no-op in Release. Transcript text and API URLs removed from log messages |
| RegisterHotKey instead of global hook | `HotkeyService.cs` | Replaced `WH_KEYBOARD_LL` with `RegisterHotKey` + `GetAsyncKeyState` polling for key-up |
| Audio max duration | `AudioCaptureService.cs` | 60-second safety limit with auto-stop timer |
| Focused screen only | `ScreenCaptureService.cs` | Captures only the monitor where the cursor is, not all monitors |

### Pending

- **Authenticode code signing** — needs certificate purchase + CI integration
