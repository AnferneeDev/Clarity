# Project Brief: Clarity

## Overview

`Clarity` is a modern productivity application featuring a Pomodoro timer, stats tracking, and notes synchronization. It consists of a web application and a mobile application, providing a consistent, synchronized, and premium cross-platform user experience. 

*(Note: The desktop version is currently out of scope and will be ignored for now).*

## Technical Stack

* **Web Frontend:** Next.js (App Router), React, Tailwind CSS, Radix UI
* **Mobile Frontend:** React Native (Expo), NativeWind (Tailwind CSS)
* **State Management:** Zustand
* **Backend & Auth:** Supabase
* **Language:** TypeScript

## Core Architecture

The application is structured as a monorepo with the following layers:

1. **Web (`apps/web`):** Next.js web client handling desktop-class web UI, server-side rendering, and responsive layouts.
2. **Mobile (`apps/mobile`):** Expo React Native application delivering a native-feeling mobile experience for iOS and Android.
3. **Data Layer & Synchronization:** Supabase acts as the single source of truth, replacing offline-only storage patterns with cloud-synced API calls. Zustand manages local state (e.g., active Pomodoro timer) and syncs with Supabase.

## Primary Conventions

* **Code Organization:** Web code lives in `apps/web/src`, Mobile code lives in `apps/mobile/src` and `apps/mobile/app` (Expo Router).
* **Styling:** Tailwind CSS is the primary styling engine across both platforms (via NativeWind on mobile).
* **State:** Zustand is used for global state (timer, stats, notes), abstracting away direct Supabase calls from UI components.

## Key Files & Directories

* **`apps/web/`** - Next.js application
  * **`src/app/`** - Next.js App Router entry points.
  * **`src/components/`** - Radix UI and Tailwind CSS components.
* **`apps/mobile/`** - Expo React Native application
  * **`app/`** - Expo Router navigation layout and screens.
  * **`src/components/screens/`** - Mobile screen content (e.g., `StatsScreen.tsx`, `TasksScreen.tsx`, `NotesScreen.tsx`).
  * **`src/hooks/`** - Shared mobile logic (e.g., `usePomodoroTimer.ts`).

## Development & Testing

* **Web:** `cd apps/web && npm run dev`
* **Mobile:** `cd apps/mobile && npm run start` (or `npm run ios` / `npm run android`)
* **Linting:** Both projects enforce strict ESLint rules (`npm run lint`).

---

## 1. Architecture Audit — Mandatory Gate (Pre-Merge Checklist)

Before merging into `main`, ensure the codebase maintains strict architectural boundaries to prevent technical debt.

### Audit Command

From the project root, prompt the AI:
```text
Run a comprehensive architecture audit on this branch using the skills at ~/projects/personal/SKILLS/antigravity-awesome-skills/skills/comprehensive-review-full-review/ and ~/projects/personal/SKILLS/antigravity-awesome-skills/skills/clean-code/. Also reference Google's code review standards at ~/personal/tmp/eng-practices/review/. Report findings by priority (P0-P3). Block merge on any P0 or P1 issues.
```

### Audit Resources

Three layers of audit criteria, applied together:

| Source | Location | Focus |
|--------|----------|-------|
| Full-Review Skill | `~/projects/personal/SKILLS/antigravity-awesome-skills/skills/comprehensive-review-full-review/` | Structural: dependencies, file sizes, navigation violations, crash recovery |
| Clean-Code Skill | `~/projects/personal/SKILLS/antigravity-awesome-skills/skills/clean-code/` | Readability: naming, comments, style, consistency, DRY |
| Google Code Review Standards | `~/personal/tmp/eng-practices/review/` | Design, functionality, complexity, tests, documentation |

### Severity Classification

| Tier | Meaning | Merge Gate |
|------|---------|-----------|
| **P0** | Critical | **BLOCK** — hierarchy violations (components handling navigation or data fetching), missing error boundaries |
| **P1** | High | **BLOCK** — god components (>300 lines), missing React.memo on FlatList items, missing useCallback on event handlers, inline renderItem |
| **P2** | Medium | **WARN** — duplicated code, inline utilities, stale useCallback deps, dynamic arrays in component bodies |
| **P3** | Low | **LOG** — magic numbers, untyped navigators, dead code |

### Enforced Rules

**Dependency rules:**
- **ABSOLUTE RULE:** Reusable components under `src/components/` MUST NOT handle their own navigation or data fetching. They receive data and callback props (e.g., `onPress`, `onNavigate`). Only Screens/Pages are allowed to fetch data and trigger navigation.
- Web Pages and Mobile Screens MUST NOT import from each other.

**Performance rules:**
- Heavy lists in React Native must use `FlatList` with `React.memo` for items, and `useCallback` for `renderItem`.
- Avoid unnecessary re-renders in Zustand by using granular selectors (e.g., `useStore(state => state.specificField)`).

**Structural rules:**
- Decompose large files (>300 lines) into smaller hooks or sub-components.
- Keep business logic (timer intervals, syncing) in hooks or Zustand stores, out of the UI components.

**Functionality rules:**
- Every interactive element MUST provide user feedback (e.g., active state, loading spinner, toast notification).
- Gracefully handle offline states, especially on Mobile.

**Theme & Styling rules:**
- Use Tailwind classes for styling. No magic numbers or hardcoded hex colors unless defined in `tailwind.config.js`.
- On mobile, avoid `StyleSheet.create` unless you need complex animations or unsupported Native properties. Rely on NativeWind.

## 2. Behavioral Rule: Flag Rule Violations Before Acting

When proposing an action that violates established project rules (architecture, dependencies, performance, or styling), the assistant MUST:
1. Immediately flag the violation.
2. Clearly explain which rule is being broken and why.
3. Ask the user for explicit confirmation before proceeding with the rule-breaking action.

## 3. Backend-First Data Contract (Supabase)

Always mirror the Supabase database schema in your TypeScript types. 
- Never rename fields, change status values, or restructure the data model on the frontend unless the database schema changes first. 
- Types should reflect the exact contract provided by Supabase.

## 4. Navigation Rule — Components Must Not Own Navigation

**Component (leaf):** Accepts callback props. Knows nothing about navigation.
**Screen/Page (parent):** Owns the navigation. Passes callbacks down.

If a generic `Button` or `Card` component calls `router.push()` or `navigation.navigate()`, it destroys reusability and makes testing difficult. Always pass routing actions as props to shared components.

## 5. Linting — Run It Constantly, Keep Imports Clean

Unused imports add noise and confuse readers. Run `npm run lint` frequently in the respective `apps/web` or `apps/mobile` directories to catch unused variables, unused imports, and strict type errors.

## 6. Shared Types

Types that map to the Supabase database must be kept strictly consistent across web and mobile. Treat database type definitions as forbidden ground for arbitrary changes — they must exactly match the backend schema.
