# Clarity

Modern Pomodoro timer and productivity app. Built with Electron (desktop), Next.js (web), and Expo (mobile).

## Apps

| App | Stack | Location |
|-----|-------|----------|
| Desktop | Electron + React + Supabase | `apps/desktop/` |
| Web | Next.js 15 + Tailwind | `apps/web/` |
| Mobile | Expo + React Native | `apps/mobile/` |

## Getting Started

```bash
npm install
npm run dev:desktop   # Start Electron app
npm run dev:web       # Start Next.js (localhost:3000)
npm run dev:mobile    # Start Expo
```

## Architecture

- `apps/desktop/src/main/` — Electron main process (IPC handlers, Supabase, cache)
- `apps/desktop/src/preload/` — Secure bridge between main and renderer
- `apps/desktop/src/renderer/` — React UI (views, hooks, components)
- `apps/desktop/infrastructure/` — Database schema + RLS policies

## License

All rights reserved. Proprietary software.
