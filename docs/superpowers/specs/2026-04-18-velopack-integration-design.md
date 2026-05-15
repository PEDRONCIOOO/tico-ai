# Velopack Integration — Installer + Auto-Update

**Date:** 2026-04-18
**Status:** Approved

## Goal

Package Tico as a self-contained Windows installer with automatic updates via Velopack + GitHub Releases.

## Repository Structure

- `pfrfromperu/tico` (private) — source code
- `pfrfromperu/tico-releases` (public) — installer binaries and update packages

## App Metadata

- Product name: "Tico - Assistente IA"
- Velopack package ID: `TicoAI`
- Initial version: `1.0.0`
- Target: `win-x64`, self-contained

## Velopack Integration in App

### Startup hook

Add `VelopackApp.Build().Run()` as the very first call in `App.xaml.cs` startup, before mutex, auth, or any other initialization. This is required by Velopack to handle install/uninstall/update lifecycle hooks.

### Update check flow

After auth + component initialization completes:

1. Create `UpdateManager` pointing to `https://github.com/pfrfromperu/tico-releases`
2. Call `CheckForUpdatesAsync()` — non-blocking, in background
3. If update available: show `UpdateWindow` with changelog + "reiniciar e atualizar" button
4. If no update or error: continue normally, no user interruption

### UpdateWindow

Small modal window, Tico visual style:
- Title: "nova versão disponível"
- Version badge: "v{newVersion}"
- Body: changelog text (from GitHub Release description, plain text, few lines)
- Primary button: "reiniciar e atualizar" → calls `DownloadUpdatesAsync()` then `ApplyUpdatesAndRestart()`
- Secondary button: "depois" → closes window, app continues normally
- Style: matches existing Tico UI (purple #7C3AED, Bricolage Grotesque font, rounded corners)

### Error handling

- Network errors during update check: silently ignore, log to console
- Download errors: show brief error in UpdateWindow, allow retry or dismiss
- Never block app startup for updates

## Project File Changes

### Tico.App.csproj

Add version and product metadata:
```xml
<Version>1.0.0</Version>
<AssemblyVersion>1.0.0</AssemblyVersion>
<FileVersion>1.0.0</FileVersion>
<Product>Tico - Assistente IA</Product>
<Company>Tico</Company>
<Description>Assistente IA para Windows com voz e visão de tela</Description>
```

Add Velopack NuGet package:
```xml
<PackageReference Include="Velopack" Version="0.*" />
```

### App.xaml.cs

Add `VelopackApp.Build().Run()` at the start of `OnStartup` override, before existing mutex/auth logic.

Add update check method called after successful initialization.

## Build and Publish

Manual process for v1.0 (automate later with GitHub Actions):

```bash
# 1. Publish self-contained
dotnet publish src/Tico.App/Tico.App.csproj -c Release -r win-x64 --self-contained

# 2. Pack with Velopack CLI
vpk pack --packId TicoAI --packVersion 1.0.0 --packDir src/Tico.App/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish --mainExe Tico.App.exe

# 3. Upload to GitHub Release on tico-releases repo:
#    - TicoSetup.exe (installer)
#    - RELEASES (index file)
#    - TicoAI-1.0.0-full.nupkg (update package)
```

## Web Download URL

Update `DOWNLOAD_URL` in `web/src/app/page.tsx` and `dashboard/page.tsx`:
```
https://github.com/pfrfromperu/tico-releases/releases/latest/download/TicoSetup.exe
```

## Preserved Behavior

- User settings in `%APPDATA%\Tico/` — Velopack does not touch user data directories
- Single-instance mutex — unchanged
- Auth flow — unchanged
- Tray icon, hotkey, buddy cursor — unchanged

## Out of Scope

- CI/CD automation (future)
- Code signing certificate (future, optional)
- Delta updates configuration (Velopack handles automatically after v1.0.0)
