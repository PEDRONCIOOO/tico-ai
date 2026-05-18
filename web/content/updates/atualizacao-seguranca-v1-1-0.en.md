---
title: security update — v1.1.0
slug: atualizacao-seguranca-v1-1-0
date: 2026-05-17
author: Tico Team
---

we just released tico version 1.1.0, focused on security and stability. this update was the result of a complete audit of the app and the website.

## what changed in the app?

- **safer updates** — tico now only accepts downloads from verified addresses, avoiding any redirect risk.
- **protected settings** — sensitive data like server addresses can no longer be changed by external files.
- **real logout** — when you log out, the session is terminated both in the app and on the server.
- **less data in memory** — old screenshots are removed from history before sending, saving resources and protecting your privacy.
- **cleaner logs** — sensitive information no longer appears in debug logs.
- **limited recording** — audio now has a 60-second limit to prevent accidental recordings.
- **focused screen capture** — tico now captures only the monitor you are working on, not all monitors simultaneously.

## what changed on the website?

- **spam protection** — comments and feedback now have size limits and submission limits per user.
- **verified identity** — display names in comments are fetched directly from the server, with no chance of spoofing.
- **safer forms** — fixes against content injection in feedback emails.

## how to update?

tico automatically notifies you when a new version is available. just accept the update when it appears.

we thank [paulo cortez](https://me.extencil.me/) for the security audit that motivated these improvements.

questions? send an email to support@ticoai.app.
