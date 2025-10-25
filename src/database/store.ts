// src/main/store.ts
import Store from "electron-store";
import { app } from "electron";
import { localDateString } from "../timeUtils";

export interface DailyStat {
  date: string; // YYYY-MM-DD
  subject: string; // lowercase
  timeInSubject: number; // minutes
  breakMinutes: number; // minutes (daily)
  pauseMinutes: number; // minutes (daily)
}

export interface SessionRow {
  id: string; // string id
  subjectId?: number;
  subjectName: string;
  startTime: number; // epoch ms (local machine time)
  endTime?: number; // epoch ms
  durationMinutes?: number;
  pausedSeconds?: number;
}

export interface Settings {
  minutesPerPomodoro: number;
  minutesPerBreak: number;
  minutesPerLongBreak: number;
}

interface Schema {
  schemaVersion?: number;
  settings: Settings;
  subjectTotals: Record<string, { totalTime: number }>;
  dailyStats: DailyStat[];
  sessions: SessionRow[];
}

const defaults: Schema = {
  schemaVersion: 1,
  settings: {
    minutesPerPomodoro: 25,
    minutesPerBreak: 5,
    minutesPerLongBreak: 15,
  },
  subjectTotals: {},
  dailyStats: [],
  sessions: [],
};

const store: any = new Store<Schema>({
  cwd: app.getPath("userData"),
  name: "pomodoro-store",
  defaults,
});

/* -----------------------
   Migrations template
   ----------------------- */
export async function runMigrations() {
  const current = store.get("schemaVersion", 0) || 0;
  const migrations: Record<number, () => void | Promise<void>> = {
    // Add future migrations here:
    // 2: () => { /* transform store */ store.set('schemaVersion', 2); }
  };

  const sorted = Object.keys(migrations)
    .map((k) => Number(k))
    .sort((a, b) => a - b);

  for (const v of sorted) {
    if (v > current) {
      await migrations[v]();
      store.set("schemaVersion", v);
      console.log(`applied migration ${v}`);
    }
  }
}
export function getDataVersion(): number {
  return store.get("dataVersion", 0) as number;
}

export function setDataVersion(version: number) {
  store.set("dataVersion", version);
}
/* -----------------------
   Settings API
   ----------------------- */
export function getSettings(): Settings {
  return store.get("settings", defaults.settings) as Settings;
}

export function setSettings(patch: Partial<Settings>) {
  const current = getSettings();
  const merged: Settings = { ...current, ...patch } as Settings;
  store.set("settings", merged);
  return merged;
}

/* -----------------------
   Subject totals API (lowercase keys)
   ----------------------- */
export function getSubjectTotals(): Record<string, { totalTime: number }> {
  return store.get("subjectTotals", {}) as Record<string, { totalTime: number }>;
}

export function addSubjectTotal(subjectName: string) {
  const key = subjectName.trim().toLowerCase();
  if (!key) throw new Error("Invalid subject name");
  const totals = getSubjectTotals();
  if (!totals[key]) totals[key] = { totalTime: 0 };
  store.set("subjectTotals", totals);
  return totals[key];
}
export function addSubject(subjectName: string) {
  return addSubjectTotal(subjectName);
}

export function incrementSubjectTotal(subjectName: string, minutes: number) {
  const key = subjectName.trim().toLowerCase();
  if (!key) throw new Error("Invalid subject name");
  const totals = getSubjectTotals();
  if (!totals[key]) totals[key] = { totalTime: 0 };
  totals[key].totalTime += Math.max(0, Math.floor(minutes || 0));
  store.set("subjectTotals", totals);
  return totals[key];
}

export function removeSubjectFromStore(subjectName: string) {
  const key = String(subjectName || "")
    .trim()
    .toLowerCase();
  const totals = getSubjectTotals();
  if (totals[key]) {
    delete totals[key];
    store.set("subjectTotals", totals);
    const d = getDailyStats().filter((r) => r.subject !== key);
    store.set("dailyStats", d);
    return true;
  }
  return false;
}

/* -----------------------
   Daily stats API
   ----------------------- */
export function getDailyStats(): DailyStat[] {
  return store.get("dailyStats", []) as DailyStat[];
}

export function getDailyStatsByDate(date: string): DailyStat[] {
  return getDailyStats().filter((d) => d.date === date);
}

export function addDailyStat(stat: DailyStat) {
  const s: DailyStat = {
    date: stat.date,
    subject: String(stat.subject || "")
      .trim()
      .toLowerCase(),
    timeInSubject: Math.max(0, Math.floor(stat.timeInSubject || 0)),
    breakMinutes: Math.max(0, Math.floor(stat.breakMinutes || 0)),
    pauseMinutes: Math.max(0, Math.floor(stat.pauseMinutes || 0)),
  };

  const daily = getDailyStats();
  daily.push(s);
  store.set("dailyStats", daily);

  // keep subject totals in sync
  incrementSubjectTotal(s.subject, s.timeInSubject);

  return s;
}

export function updateDailyStat(date: string, subject: string, increments: { timeInSubject?: number; breakMinutes?: number; pauseMinutes?: number }) {
  const key = String(subject || "")
    .trim()
    .toLowerCase();
  if (!date || !key) {
    throw new Error("date and subject are required for updateDailyStat");
  }

  const safeInc = {
    timeInSubject: Math.max(0, Math.floor(increments.timeInSubject || 0)),
    breakMinutes: Math.max(0, Math.floor(increments.breakMinutes || 0)),
    pauseMinutes: Math.max(0, Math.floor(increments.pauseMinutes || 0)),
  };

  const daily = getDailyStats();
  const idx = daily.findIndex((d) => d.date === date && d.subject === key);

  if (idx === -1) {
    const newRow: DailyStat = {
      date,
      subject: key,
      timeInSubject: safeInc.timeInSubject,
      breakMinutes: safeInc.breakMinutes,
      pauseMinutes: safeInc.pauseMinutes,
    };
    daily.push(newRow);
    store.set("dailyStats", daily);

    // Keep subjectTotals in sync
    if (safeInc.timeInSubject > 0) {
      incrementSubjectTotal(key, safeInc.timeInSubject);
    }

    return newRow;
  } else {
    const before = daily[idx].timeInSubject || 0;
    daily[idx].timeInSubject = Math.max(0, (daily[idx].timeInSubject || 0) + safeInc.timeInSubject);
    daily[idx].breakMinutes = Math.max(0, (daily[idx].breakMinutes || 0) + safeInc.breakMinutes);
    daily[idx].pauseMinutes = Math.max(0, (daily[idx].pauseMinutes || 0) + safeInc.pauseMinutes);

    store.set("dailyStats", daily);

    const delta = daily[idx].timeInSubject - before;
    if (delta > 0) {
      incrementSubjectTotal(key, delta);
    }

    return daily[idx];
  }
}

/* -----------------------
   Sessions (lightweight)
   ----------------------- */
function makeSessionId() {
  return `s_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export function startSessionInStore(subjectName: string, subjectId?: number): SessionRow {
  const id = makeSessionId();
  const row: SessionRow = {
    id,
    subjectId,
    subjectName: (subjectName || "general").trim(),
    startTime: Date.now(), // store epoch ms (local machine time)
  };
  const arr = store.get("sessions", []) as SessionRow[];
  arr.push(row);
  store.set("sessions", arr);
  return row;
}

export function completeSessionInStore(sessionId: string, durationMinutes: number, pausedSeconds: number) {
  const arr = store.get("sessions", []) as SessionRow[];
  const idx = arr.findIndex((r) => r.id === sessionId);
  if (idx === -1) throw new Error("session not found");

  const row = arr[idx];
  row.endTime = Date.now(); // store epoch ms
  row.durationMinutes = Math.max(0, Math.floor(durationMinutes || 0));
  row.pausedSeconds = Math.max(0, Math.floor(pausedSeconds || 0));
  arr[idx] = row;
  store.set("sessions", arr);

  // merge into daily stats using local date derived from startTime
  const date = localDateString(new Date(row.startTime));

  // IMPORTANT: we do NOT persist pauseMinutes here to avoid double-counting.
  updateDailyStat(date, row.subjectName, {
    timeInSubject: row.durationMinutes || 0,
    breakMinutes: 0,
    pauseMinutes: 0,
  });

  return row;
}

export function getAllSessionsFromStore(): SessionRow[] {
  return store.get("sessions", []) as SessionRow[];
}

export function getSessionsForDate(date: string): SessionRow[] {
  return getAllSessionsFromStore().filter((s) => localDateString(new Date(s.startTime)) === date);
}

export function getSessionsBetweenDates(startDate: string, endDate: string): SessionRow[] {
  return getAllSessionsFromStore().filter((s) => {
    const d = localDateString(new Date(s.startTime));
    return d >= startDate && d <= endDate;
  });
}

export function updateSessionProgress(sessionId: string, activeSeconds: number, pausedSeconds: number) {
  if (!sessionId) throw new Error("sessionId required");

  const arr: SessionRow[] = store.get("sessions", []) as SessionRow[];
  const idx = arr.findIndex((r) => String(r.id) === String(sessionId));
  if (idx === -1) {
    // no session found — nothing to update
    return null;
  }
  const row = { ...arr[idx] };

  row.durationMinutes = Math.max(0, Math.floor((activeSeconds || 0) / 60));
  row.pausedSeconds = Math.max(0, Math.floor(pausedSeconds || 0));
  arr[idx] = row;
  store.set("sessions", arr);

  return row;
}

export function clearStore() {
  store.set(defaults);
}
