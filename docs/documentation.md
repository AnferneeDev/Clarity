# Clarity v2 - System Documentation

This document provides a comprehensive overview of the Clarity v2 codebase, its architecture, data structures, and key feature implementations. It is designed to be a reference for future development and maintenance.

## 1. System Architecture

Clarity v2 is a **local-first** Electron application built with React, Vite, and TypeScript. It uses a "Hybrid" architecture where:

- **Frontend (Renderer):** Handles UI and user interaction (React/Shadcn).
- **Backend (Main Process):** Handles persistence, accessing the file system, and heavy logic (Node.js).
- **Communication:** Uses Electron IPC (Inter-Process Communication) via a strictly typed `preload.ts` bridge.

### Directory Structure

```
root
├── src
│   ├── main.ts         # Main process entry point (Node.js)
│   ├── preload.ts      # IPC Bridge (Exposes API to Renderer)
│   ├── storage.ts      # Local JSON Data Persistence Logic
│   ├── timeUtils.ts    # Date/Time Utilities (Shared)
│   ├── App.tsx         # Main React Component
│   ├── hooks/          # React Hooks (useBackground, etc.)
│   └── components/     # UI Components (Views, Sidebar, etc.)
└── ...
```

---

## 2. Data Persistence (Local JSON) -> `storage.ts`

The application stores all user data in a single JSON file located at `%APPDATA%/clarity/clarity-data.json`.
The logic for reading/writing this file is encapsulated in `src/storage.ts`.

### JSON Schema (`AppData`)

The root object `AppData` contains:

| Key           | Type                     | Description                                             |
| :------------ | :----------------------- | :------------------------------------------------------ |
| `users`       | `User[]`                 | List of registered users (password hashed with PBKDF2). |
| `subjects`    | `Subject[]`              | Activities tracked (e.g., Programming, Work).           |
| `sessions`    | `TimerSession[]`         | Log of completed focus sessions.                        |
| `todos`       | `Todo[]`                 | User tasks.                                             |
| `notes`       | `Note[]`                 | Simple text notes.                                      |
| `chapters`    | `Chapter[]`              | Life Chapters/boards (New Feature).                     |
| `backgrounds` | `Record<string, string>` | Custom backgrounds per view.                            |
| `settings`    | `Record<string, ...>`    | User-specific settings (timers, etc).                   |

### Important Implementation Details

- **Seeding:** If the data file is missing or empty, `storage.ts` automatically runs `seedInitialData()` to populate it with default user 'Anfernee' and historical data.
- **Daily Distribution Logic:** The seeding logic distributes ~45k minutes of historical "Programming" time across dates from June 2025 to Jan 2026. _Note: Ensure this does not overlap with real-time usage (fixed in Jan 2026)._

---

## 3. "Life Chapters" Feature

A specialized view for high-level life management, inspired by Notion boards.

- **View:** `ChaptersView.tsx` (Gallery Grid Layout).
- **Data Model:**
  ```typescript
  interface Chapter {
    id: string; // UUID
    userId: string;
    title: string;
    coverImage?: string; // Path to image (initially local)
    icon?: string; // Emoji
    clear: boolean; // "Done/Archived" state
    createdAt: string;
  }
  ```
- **Image Handling:** Cover images are uploaded via `ipcRenderer.invoke("chapters:uploadImage", file)`. The main process saves these files to `%APPDATA%/clarity/uploads/` and returns the path.

---

## 4. Supabase Integration Strategy

The application is "Supabase Ready". We use UUIDs and structure our local data to mirror the planned SQL schema.

### Database Schema (SQL)

To be deployed to Supabase:

- **`profiles`**: Extends `auth.users`.
- **`subjects`**: Tracked activities.
- **`sessions`**: Time logs.
- **`todos`**: Tasks.
- **`notes`**: Notes.
- **`chapters`**: Life Chapters.

### SQL Migration

Use the provided `supabase_setup.sql` (or `chapters_migration.sql`) to create these tables. RLS (Row Level Security) is enabled on ALL tables to ensure users only access their own data.

```sql
-- Example Chapters Table
CREATE TABLE public.chapters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
     ...
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own chapters" ON public.chapters FOR SELECT USING (auth.uid() = user_id);
```

---

## 5. Time Tracking & Analytics

- **Tracking:** `TimerView.tsx` uses a React Context (`TimerContext`) to manage the countdown. When a session completes, it calls `window.electronAPI.timerDb.addSession(...)`.
- **Analytics:** `StatsDisplay.tsx` fetches aggregated data via IPC:
  - `getSubjectTotals`: Total minutes per subject.
  - `getDailyAggregated`: Total minutes per day (for heatmaps/graphs).
- **Timezones:** All dates are stored as `YYYY-MM-DD` strings based on the _user's local time_ (handled by `timeUtils.ts`). This avoids UTC shifting issues where late-night work counts as the "next day".

## 6. API Reference (IPC)

The `window.electronAPI` object exposed to the frontend includes:

- **`auth`**: `login`, `register`, `verify`, `logout`.
- **`timerDb`**: `addSession`, `getSubjects`, `getDailyAggregatedData`, etc.
- **`todos`**: `getAll`, `add`, `update`, `delete`.
- **`notes`**: `getAll`, `add`, `update`, `delete`.
- **`chapters`**: `getAll`, `add`, `update`, `delete`, `uploadImage`.
- **`system`**: `minimizeWindow`, `closeWindow`, `toggleMaximize`, `isMaximized`.

---

## 7. Development & Debugging

- **Run Dev:** `npm run dev` (starts Vite server & Electron).
- **Data Location:** `%APPDATA%\roaming\clarity` (Windows).
- **Logs:** Check the terminal for Main process logs, and DevTools Console for Renderer logs.
