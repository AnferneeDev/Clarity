# Clarity v2 - System Documentation

This document provides a comprehensive overview of the Clarity v2 codebase, its architecture, data structures, and key feature implementations.

## 1. System Architecture

Clarity v2 is an **offline-first** Electron application built with React, Vite, and TypeScript. It uses a hybrid sync architecture:

- **Frontend (Renderer):** React UI with Shadcn components
- **Backend (Main Process):** Node.js with local JSON and Supabase sync
- **Communication:** Electron IPC via strictly typed `preload.ts` bridge
- **Data Strategy:** Local-first with cloud backup (Supabase PostgreSQL)

### Directory Structure

```
root
├── src
│   ├── main.ts              # Main process + Supabase sync init
│   ├── preload.ts           # IPC Bridge
│   ├── storage.ts           # Local JSON persistence
│   ├── supabaseService.ts   # Supabase client + sync logic
│   ├── timeUtils.ts         # Date/Time utilities
│   ├── constants/emojis.ts  # Emoji picker data (~400 emojis)
│   ├── App.tsx              # Main React component
│   ├── hooks/               # React hooks (useBackground, etc.)
│   └── components/          # UI components
└── docs/documentation.md    # This file
```

---

## 2. Offline-First Sync Architecture

### Overview

The app works fully offline using local JSON storage. When online, it automatically syncs with Supabase using a **Last-Write-Wins (LWW)** strategy based on timestamps.

### Sync Flow

**On App Start:**

1. Load local data from `clarity-data.json`
2. Initialize Supabase client
3. Compare timestamps: `localLastUpdatedAt` vs `serverLastUpdatedAt`
4. Sync based on which is newer:
   - Local newer → Push to server
   - Server newer → Pull from server
   - Equal → No sync needed

**On Data Mutation (Online):**

1. Save to local JSON
2. Update `localLastUpdatedAt`
3. _Future: Queue for background sync_

**On Data Mutation (Offline):**

1. Save to local JSON
2. Update `localLastUpdatedAt`
3. Sync triggers automatically when connection restored

### Supabase Service (`supabaseService.ts`)

**Key Functions:**

- `initialize(url, key)` - Initialize Supabase client
- `isOnline()` - Check connection status
- `getServerLastUpdatedAt(userId)` - Fetch server timestamp
- `determineSyncDirection()` - Compare timestamps, return 'push'/'pull'/'none'
- `pushToServer(userId, localData)` - Upload all local data
- `pullFromServer(userId)` - Download all server data
- `sync()` - Main sync orchestrator

**Conflict Resolution:**

- Uses `sync_metadata` table with `last_updated_at` timestamps
- Local wins if it has newer data (offline work)
- Server wins if it has newer data (updates from other devices)
- Triggers in Supabase auto-update server timestamp on any mutation

---

## 3. Data Persistence

### Local Storage (`storage.ts`)

**File Location:** `%APPDATA%/clarity/clarity-data.json`

**Schema (`AppData`):**
| Key | Type | Description |
|:----|:-----|:------------|
| `users` | `User[]` | Registered users (PBKDF2 hashed passwords) |
| `subjects` | `Subject[]` | Tracked activities |
| `sessions` | `TimerSession[]` | Focus session logs |
| `todos` | `Todo[]` | Tasks |
| `notes` | `Note[]` | Notes |
| `chapters` | `Chapter[]` | Life chapters/goals |
| `backgrounds` | `Record<string, string>` | Custom backgrounds per view |
| `settings` | `Record<string, {...}>` | Timer settings per user |
| **`syncMetadata`** | `SyncMetadata` | **Sync timestamps (NEW)** |

**Sync Metadata Schema:**

```typescript
interface SyncMetadata {
  userId: string;
  localLastUpdatedAt: string; // ISO timestamp of last local change
  serverLastUpdatedAt: string; // ISO timestamp from last server sync
}
```

### Supabase Schema

**Tables:**

- `sync_metadata` - Per-user sync timestamps (triggers auto-update)
- `profiles` - User profiles (extends auth.users)
- `subjects` - Activities (with `is_hidden` instead of `hidden`)
- `sessions` - Time logs (includes `subject_id` FK and `subject_name`)
- `todos` - Tasks
- `notes` - Notes
- `chapters` - Life chapters

### Complete Table Schemas

#### sync_metadata

| Column          | Type        | Description                     |
| :-------------- | :---------- | :------------------------------ |
| user_id         | uuid (PK)   | Foreign key to auth.users       |
| last_updated_at | timestamptz | Auto-updated on any data change |
| created_at      | timestamptz | Record creation timestamp       |

#### profiles

| Column     | Type        | Description               |
| :--------- | :---------- | :------------------------ |
| id         | uuid (PK)   | Foreign key to auth.users |
| username   | text        | Display name              |
| full_name  | text        | Full user name            |
| updated_at | timestamptz | Last profile update       |

#### subjects

| Column     | Type        | Description                        |
| :--------- | :---------- | :--------------------------------- |
| id         | uuid (PK)   | Auto-generated                     |
| user_id    | uuid (FK)   | Owner                              |
| name       | text        | Subject name (e.g., "programming") |
| is_hidden  | boolean     | Hidden from UI                     |
| created_at | timestamptz | Created timestamp                  |

#### sessions

| Column       | Type                | Description               |
| :----------- | :------------------ | :------------------------ |
| id           | uuid (PK)           | Auto-generated            |
| user_id      | uuid (FK)           | Owner                     |
| subject_id   | uuid (FK, nullable) | Links to subjects table   |
| subject_name | text                | Subject name for queries  |
| date         | date                | Session date (YYYY-MM-DD) |
| minutes      | numeric             | Duration in minutes       |
| created_at   | timestamptz         | Log timestamp             |

#### todos

| Column     | Type        | Description       |
| :--------- | :---------- | :---------------- |
| id         | uuid (PK)   | Auto-generated    |
| user_id    | uuid (FK)   | Owner             |
| text       | text        | Task description  |
| done       | boolean     | Completion status |
| starred    | boolean     | Priority flag     |
| due_date   | timestamptz | Optional deadline |
| created_at | timestamptz | Created timestamp |

#### notes

| Column     | Type        | Description         |
| :--------- | :---------- | :------------------ |
| id         | uuid (PK)   | Auto-generated      |
| user_id    | uuid (FK)   | Owner               |
| title      | text        | Note title          |
| content    | text        | Note body           |
| color      | text        | Hex color (#ffffff) |
| created_at | timestamptz | Created timestamp   |

#### chapters

| Column      | Type        | Description          |
| :---------- | :---------- | :------------------- |
| id          | uuid (PK)   | Auto-generated       |
| user_id     | uuid (FK)   | Owner                |
| title       | text        | Chapter title        |
| cover_image | text        | Relative path or URL |
| icon        | text        | Emoji character      |
| clear       | boolean     | Completion status    |
| created_at  | timestamptz | Created timestamp    |

**Key Differences from Local:**

- Column names: `snake_case` (Supabase) vs `camelCase` (Local)
- Subjects: `is_hidden` (Supabase) vs `hidden` (Local)
- All tables have `user_id uuid` foreign key
- RLS (Row Level Security) enabled on all tables

**SQL Migration Files:**

- `supabase_setup.sql` - Complete schema + seed data
- `sync_metadata_migration.sql` - Adds sync metadata table + triggers
- `chapters_migration.sql` - Standalone chapters table
- `insert_chapters.sql` - User's specific chapters with User ID
- `fix_subject_ids.sql` - Repair script for NULL subject_id issues

### Supabase Auth Schema (auth.\*)

The following tables are managed by Supabase Auth and are available in the `auth` schema:

#### auth.audit_log_entries

| Column      | Type                     | Nullable | Default               | Description           |
| :---------- | :----------------------- | :------- | :-------------------- | :-------------------- |
| instance_id | uuid                     | YES      | null                  | Instance identifier   |
| id          | uuid                     | NO       | null                  | Primary key           |
| payload     | json                     | YES      | null                  | Audit event payload   |
| created_at  | timestamp with time zone | YES      | null                  | Audit entry timestamp |
| ip_address  | character varying(64)    | NO       | ''::character varying | Client IP address     |

#### auth.flow_state

| Column                 | Type                     | Nullable | Default | Description                |
| :--------------------- | :----------------------- | :------- | :------ | :------------------------- |
| id                     | uuid                     | NO       | null    | Primary key                |
| user_id                | uuid                     | YES      | null    | Foreign key to auth.users  |
| auth_code              | text                     | NO       | null    | OAuth authorization code   |
| code_challenge_method  | USER-DEFINED             | NO       | null    | PKCE challenge method      |
| code_challenge         | text                     | NO       | null    | PKCE code challenge        |
| provider_type          | text                     | NO       | null    | OAuth provider type        |
| provider_access_token  | text                     | YES      | null    | Provider access token      |
| provider_refresh_token | text                     | YES      | null    | Provider refresh token     |
| created_at             | timestamp with time zone | YES      | null    | Created timestamp          |
| updated_at             | timestamp with time zone | YES      | null    | Updated timestamp          |
| authentication_method  | text                     | NO       | null    | Authentication method used |
| auth_code_issued_at    | timestamp with time zone | YES      | null    | Auth code issue timestamp  |

#### auth.identities

| Column          | Type                     | Nullable | Default           | Description               |
| :-------------- | :----------------------- | :------- | :---------------- | :------------------------ |
| provider_id     | text                     | NO       | null              | Provider-specific user ID |
| user_id         | uuid                     | NO       | null              | Foreign key to auth.users |
| identity_data   | jsonb                    | NO       | null              | Provider identity data    |
| provider        | text                     | NO       | null              | OAuth provider name       |
| last_sign_in_at | timestamp with time zone | YES      | null              | Last sign-in timestamp    |
| created_at      | timestamp with time zone | YES      | null              | Created timestamp         |
| updated_at      | timestamp with time zone | YES      | null              | Updated timestamp         |
| email           | text                     | YES      | null              | Provider email            |
| id              | uuid                     | NO       | gen_random_uuid() | Primary key               |

#### auth.instances

| Column          | Type                     | Nullable | Default | Description        |
| :-------------- | :----------------------- | :------- | :------ | :----------------- |
| id              | uuid                     | NO       | null    | Primary key        |
| uuid            | uuid                     | YES      | null    | Instance UUID      |
| raw_base_config | text                     | YES      | null    | Base configuration |
| created_at      | timestamp with time zone | YES      | null    | Created timestamp  |
| updated_at      | timestamp with time zone | YES      | null    | Updated timestamp  |

#### auth.mfa_amr_claims

| Column                | Type                     | Nullable | Default | Description                     |
| :-------------------- | :----------------------- | :------- | :------ | :------------------------------ |
| session_id            | uuid                     | NO       | null    | Foreign key to sessions         |
| created_at            | timestamp with time zone | NO       | null    | Created timestamp               |
| updated_at            | timestamp with time zone | NO       | null    | Updated timestamp               |
| authentication_method | text                     | NO       | null    | Authentication method reference |
| id                    | uuid                     | NO       | null    | Primary key                     |

#### auth.mfa_challenges

| Column                 | Type                     | Nullable | Default | Description                |
| :--------------------- | :----------------------- | :------- | :------ | :------------------------- |
| id                     | uuid                     | NO       | null    | Primary key                |
| factor_id              | uuid                     | NO       | null    | Foreign key to mfa_factors |
| created_at             | timestamp with time zone | NO       | null    | Created timestamp          |
| verified_at            | timestamp with time zone | YES      | null    | Verification timestamp     |
| ip_address             | inet                     | NO       | null    | Client IP address          |
| otp_code               | text                     | YES      | null    | One-time password code     |
| web_authn_session_data | jsonb                    | YES      | null    | WebAuthn session data      |

#### auth.mfa_factors

| Column                       | Type                     | Nullable | Default | Description                  |
| :--------------------------- | :----------------------- | :------- | :------ | :--------------------------- |
| id                           | uuid                     | NO       | null    | Primary key                  |
| user_id                      | uuid                     | NO       | null    | Foreign key to auth.users    |
| friendly_name                | text                     | YES      | null    | User-defined factor name     |
| factor_type                  | USER-DEFINED             | NO       | null    | Factor type (totp, webauthn) |
| status                       | USER-DEFINED             | NO       | null    | Factor status                |
| created_at                   | timestamp with time zone | NO       | null    | Created timestamp            |
| updated_at                   | timestamp with time zone | NO       | null    | Updated timestamp            |
| secret                       | text                     | YES      | null    | TOTP secret                  |
| phone                        | text                     | YES      | null    | Phone number for SMS         |
| last_challenged_at           | timestamp with time zone | YES      | null    | Last challenge timestamp     |
| web_authn_credential         | jsonb                    | YES      | null    | WebAuthn credential data     |
| web_authn_aaguid             | uuid                     | YES      | null    | Authenticator AAGUID         |
| last_webauthn_challenge_data | jsonb                    | YES      | null    | Last WebAuthn challenge data |

#### auth.oauth_authorizations

| Column                | Type                     | Nullable | Default                                    | Description               |
| :-------------------- | :----------------------- | :------- | :----------------------------------------- | :------------------------ |
| id                    | uuid                     | NO       | null                                       | Primary key               |
| authorization_id      | text                     | NO       | null                                       | Authorization identifier  |
| client_id             | uuid                     | NO       | null                                       | OAuth client ID           |
| user_id               | uuid                     | YES      | null                                       | Foreign key to auth.users |
| redirect_uri          | text                     | NO       | null                                       | Redirect URI              |
| scope                 | text                     | NO       | null                                       | OAuth scopes              |
| state                 | text                     | YES      | null                                       | OAuth state parameter     |
| resource              | text                     | YES      | null                                       | Resource indicator        |
| code_challenge        | text                     | YES      | null                                       | PKCE code challenge       |
| code_challenge_method | USER-DEFINED             | YES      | null                                       | PKCE challenge method     |
| response_type         | USER-DEFINED             | NO       | 'code'::auth.oauth_response_type           | OAuth response type       |
| status                | USER-DEFINED             | NO       | 'pending'::auth.oauth_authorization_status | Authorization status      |
| authorization_code    | text                     | YES      | null                                       | Authorization code        |
| created_at            | timestamp with time zone | NO       | now()                                      | Created timestamp         |
| expires_at            | timestamp with time zone | NO       | (now() + '00:03:00'::interval)             | Expiration timestamp      |
| approved_at           | timestamp with time zone | YES      | null                                       | Approval timestamp        |
| nonce                 | text                     | YES      | null                                       | OpenID Connect nonce      |

#### auth.oauth_client_states

| Column        | Type                     | Nullable | Default | Description         |
| :------------ | :----------------------- | :------- | :------ | :------------------ |
| id            | uuid                     | NO       | null    | Primary key         |
| provider_type | text                     | NO       | null    | OAuth provider type |
| code_verifier | text                     | YES      | null    | PKCE code verifier  |
| created_at    | timestamp with time zone | NO       | null    | Created timestamp   |

#### auth.oauth_clients

| Column             | Type                     | Nullable | Default                                | Description             |
| :----------------- | :----------------------- | :------- | :------------------------------------- | :---------------------- |
| id                 | uuid                     | NO       | null                                   | Primary key             |
| client_secret_hash | text                     | YES      | null                                   | Hashed client secret    |
| registration_type  | USER-DEFINED             | NO       | null                                   | Registration type       |
| redirect_uris      | text                     | NO       | null                                   | Allowed redirect URIs   |
| grant_types        | text                     | NO       | null                                   | Allowed grant types     |
| client_name        | text                     | YES      | null                                   | Client application name |
| client_uri         | text                     | YES      | null                                   | Client homepage URI     |
| logo_uri           | text                     | YES      | null                                   | Client logo URI         |
| created_at         | timestamp with time zone | NO       | now()                                  | Created timestamp       |
| updated_at         | timestamp with time zone | NO       | now()                                  | Updated timestamp       |
| deleted_at         | timestamp with time zone | YES      | null                                   | Soft delete timestamp   |
| client_type        | USER-DEFINED             | NO       | 'confidential'::auth.oauth_client_type | Client type             |

#### auth.oauth_consents

| Column     | Type                     | Nullable | Default | Description               |
| :--------- | :----------------------- | :------- | :------ | :------------------------ |
| id         | uuid                     | NO       | null    | Primary key               |
| user_id    | uuid                     | NO       | null    | Foreign key to auth.users |
| client_id  | uuid                     | NO       | null    | Foreign key to clients    |
| scopes     | text                     | NO       | null    | Granted scopes            |
| granted_at | timestamp with time zone | NO       | now()   | Grant timestamp           |
| revoked_at | timestamp with time zone | YES      | null    | Revocation timestamp      |

#### auth.one_time_tokens

| Column     | Type         | Nullable | Default | Description                 |
| :--------- | :----------- | :------- | :------ | :-------------------------- |
| id         | uuid         | NO       | null    | Primary key                 |
| user_id    | uuid         | NO       | null    | Foreign key to auth.users   |
| token_type | USER-DEFINED | NO       | null    | Token type (recovery, etc.) |
| token_hash | text         | NO       | null    | Hashed token value          |
| relates_to | text         | NO       | null    | Related resource identifier |

---

## 4. Life Chapters Feature

**View:** `ChaptersView.tsx` - Gallery grid layout with cards

**Features:**

- Create/Edit/Delete chapters
- Upload cover images
- Select emoji icons from categorized picker (~400 emojis)
- Mark chapters as "clear" (completed)
- Auto-syncs to Supabase

**Icon Picker:**

- Located in `src/constants/emojis.ts`
- 5 categories: Common, Faces, Objects & Tech, Activities & Sports, Nature & Animals
- Popover UI component for selection

**Data Model:**

```typescript
interface Chapter {
  id: string;
  userId: string;
  title: string;
  coverImage?: string; // Relative path to local file
  icon?: string; // Emoji
  clear: boolean; // Completion status
  createdAt: string;
}
```

---

## 5. Background Images

**Feature:** Custom background images per view (Timer, Stats, Todos, Notes, Chapters, Settings)

**Implementation:**

- `useBackground.ts` hook manages state
- Images uploaded via IPC → saved to `%APPDATA%/clarity/backgrounds/`
- Stored as data URIs in state for rendering
- Paths persisted in `backgrounds` object in local JSON

**Bug Fix (Jan 2026):**

- Fixed race condition where images wouldn't load after upload
- Solution: `loadBackgrounds()` now fetches data URIs via `getViewBackgroundData` IPC

---

## 6. Time Tracking

**Logic:**

- All dates stored as `YYYY-MM-DD` strings in **local timezone**
- Uses `timeUtils.ts` for timezone-safe operations
- Timer sessions aggregate by (`userId`, `subject_name`, `date`)

**Key Functions:**

- `addTimerMinutes(userId, subject, date, minutes)` - Log time
- `getSubjectTotals(userId, startDate?, endDate?)` - Aggregate by subject
- `getDailyAggregated(userId, startDate?, endDate?)` - Aggregate by date

**Bug Fix (Jan 2026):**

- Removed distributed data for "today" (Jan 8, 2026) to prevent inflated hours
- Auto-cleanup logic in `loadData()` removes synthetic entries for current date

---

## 7. IPC API Reference

**Auth:**

- `auth:login`, `auth:register`, `auth:verify`, `auth:logout`

**Timer:**

- `timerDb:addSession`, `timerDb:getSubjects`, `timerDb:getDailyData`, etc.

**Data:**

- `todos:*`, `notes:*`, `chapters:*` (getAll, add, update, delete)

**Backgrounds:**

- `setViewBackground`, `getViewBackgroundData`, `getAllBackgrounds`, `removeBackground`

**Chapters:**

- `chapters:uploadImage`, `chapters:getImage`

**Window:**

- `app:minimize`, `app:maximize`, `app:close`

---

## 8. Development

**Start Dev Server:**

```bash
npm run dev
```

**Data Location:**

- Local: `C:\Users\{Username}\AppData\Roaming\clarity\clarity-data.json`
- Images: `C:\Users\{Username}\AppData\Roaming\clarity\backgrounds\`
- Chapters: `C:\Users\{Username}\AppData\Roaming\clarity\chapters\`

**Logs:**

- Main Process: Terminal console
- Renderer: DevTools Console
- Sync Status: Look for `[Sync]`, `[App]`, `[Supabase]` prefixes

**Supabase Connection:**

- URL: `https://qkqwyqdhwhscmlkmsiyg.supabase.co`
- Credentials hardcoded in `main.ts` (not gitignored)
- User ID: `30e74432-361f-47b2-9926-8a049421020b`

---

## 9. Known Issues & Fixes

### Issue: Subject IDs NULL in Supabase

**Solution:** Run `fix_subject_ids.sql` to populate subjects and link sessions

### Issue: Time Discrepancy (Local vs Supabase)

**Solution:** Deleted synthetic distributed data for current date from Supabase

### Issue: Images not loading after upload

**Solution:** Refactored `useBackground.ts` to fetch data URIs properly

---

## 10. Motivation Board

**View:** `MotivationView.tsx` - Masonry grid of inspiring images

**Features:**

- Drag-and-drop image upload
- Reorderable grid
- Images stored in `%APPDATA%/clarity/motivations/` with random filenames

**Data Model:**

```typescript
interface Motivation {
  id: string;
  userId: string;
  imagePath: string; // Relative path
  order: number;
  createdAt: string;
}
```

---

## 11. Quest Gamification System

**View:** `GameView.tsx` - RPG-style dashboard

**Features:**

- **Character:** HP (Health), XP (Experience), Level, Coins
- **Skills:** Definition of skills (e.g., Coding, Fitness) with levels
- **Quests:** Daily tasks linked to skills (rewards XP/Coins)
- **Habits:** Good (gain XP) and Bad (lose HP) habits
- **Daily Reset:** Quests and habits reset daily
- **Game Over:** HP <= 0 resets progress

**Components:**

- `GameView` - Main container (Grid layout)
- `Progress` - Custom XP bar
- `Hearts` - Visual HP representation

**Data Model (`GameData`):**

```typescript
interface GameData {
  character: GameCharacter;
  skills: GameSkill[];
  quests: GameQuest[];
  habits: GameHabit[];
  lastResetDate: string;
}
```

**Mechanics:**

- **Complete Quest:** +XP to Skill, +XP to Character, +Coins
- **Good Habit:** +XP to Skill (optional), +Coins
- **Bad Habit:** -HP. If HP <= 0, resets all game data.
- **Level Up:** Character max HP +10, Skill XP threshold increases

---

## 12. Future Enhancements

- [ ] Real-time sync (Supabase Realtime subscriptions)
- [ ] Conflict resolution UI for manual review
- [ ] Sync status indicator in header
- [ ] Offline badge / Last synced timestamp
- [ ] Manual sync button
- [ ] Multi-device support (merge strategies)
