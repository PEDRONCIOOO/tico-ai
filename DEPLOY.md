# Deploy Guide

## Infraestrutura

| Componente | Onde | Como |
|---|---|---|
| App WPF (.exe) | Cloudflare R2 (`tico-downloads`) | `wrangler r2 object put --remote` |
| Proxy API | Cloudflare Workers (`tico-proxy`) | `wrangler deploy` na pasta `proxy/` |
| version.json | Cloudflare R2 (`tico-downloads`) | `wrangler r2 object put --remote` |
| Website | Vercel / Next.js | push to main (auto-deploy) |

- Dominio de download: `https://dl.ticoai.app` (aponta para R2 `tico-downloads`)
- GitHub releases: `PEDRONCIOOO/tico-ai` (backup, nao usado para auto-update)
- Auto-update do app: consulta `https://dl.ticoai.app/version.json`, notifica o usuario

## Deploy do App (mudancas em C#)

### 1. Bump da versao

Editar `src/Tico.App/Tico.App.csproj`:
```xml
<Version>X.Y.Z</Version>
```

### 2. Build

```bash
dotnet publish src/Tico.App/Tico.App.csproj -c Release -r win-x64 --self-contained
```

### 3. Empacotar com Velopack

```bash
vpk pack \
  --packId TicoAI \
  --packVersion X.Y.Z \
  --packDir src/Tico.App/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish \
  --mainExe Tico.App.exe \
  --skipVeloAppCheck
```

Artefatos gerados em `Releases/`:
- `TicoAI-win-Setup.exe` — instalador
- `TicoAI-X.Y.Z-full.nupkg` — pacote de update
- `RELEASES` — indice
- `assets.win.json`, `releases.win.json`

### 4. Upload para R2 (REMOTE, nao local)

```bash
# version.json — SEMPRE usar --remote
echo '{"version":"X.Y.Z","url":"https://dl.ticoai.app/TicoSetup.exe"}' > /tmp/version.json
npx wrangler r2 object put tico-downloads/version.json --file /tmp/version.json --content-type application/json --remote

# Setup.exe — SEMPRE usar --remote
npx wrangler r2 object put tico-downloads/TicoSetup.exe --file Releases/TicoAI-win-Setup.exe --content-type application/octet-stream --remote
```

**IMPORTANTE:** sem `--remote` o wrangler sobe para o emulador local, nao para producao.

### 5. Verificar

```bash
curl -s https://dl.ticoai.app/version.json
# Deve retornar: {"version":"X.Y.Z","url":"https://dl.ticoai.app/TicoSetup.exe"}
```

### 6. GitHub Release (opcional, backup)

```bash
gh release create vX.Y.Z \
  --repo PEDRONCIOOO/tico-ai \
  --title "vX.Y.Z — descricao curta" \
  --notes "changelog aqui" \
  Releases/TicoAI-win-Setup.exe \
  Releases/RELEASES \
  Releases/TicoAI-X.Y.Z-full.nupkg \
  Releases/assets.win.json \
  Releases/releases.win.json
```

## Deploy do Proxy (mudancas em worker.js)

```bash
cd proxy && npx wrangler deploy
```

Secrets gerenciados via:
```bash
cd proxy
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

## Deploy do Website (mudancas em web/)

Push para main — Vercel faz deploy automatico.

## Pre-requisitos

- `dotnet` SDK 8
- `vpk` (Velopack CLI): `dotnet tool install -g vpk`
- `wrangler`: vem via `npx wrangler`
- `gh` (GitHub CLI): autenticado com scope `workflow`
  - Se falhar: `gh auth refresh -h github.com -s workflow`

## Checklist rapido

- [ ] Versao bumpada no `.csproj`
- [ ] `dotnet publish` sem erros
- [ ] `vpk pack` gerou artefatos em `Releases/`
- [ ] R2 upload com `--remote` (version.json + TicoSetup.exe)
- [ ] `curl` confirma versao nova em `dl.ticoai.app/version.json`
- [ ] Git commit (usuario faz manualmente)
