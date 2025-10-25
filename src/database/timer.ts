// src/main/timer.ts
import { query } from "./crud"; // used only to resolve subject id -> name (read-only)
import {
  updateSessionProgress as storeUpdateSessionProgress,
  startSessionInStore,
  completeSessionInStore,
  getAllSessionsFromStore,
  getSessionsForDate,
  getDailyStats,
  getSubjectTotals,
  getSettings,
  setSettings,
  addSubject,
  incrementSubjectTotal,
  removeSubjectFromStore,
} from "./store";

/**
 * saveSessionProgress - thin wrapper that updates in-store session progress.
 * The renderer calls the IPC handler which ultimately calls this store helper.
 */
export function saveSessionProgress(sessionId: string | number, activeSeconds: number, pausedSeconds: number, phase?: string, subjectName?: string) {
  return storeUpdateSessionProgress(String(sessionId), activeSeconds, pausedSeconds);
}

/**
 * Start a session.
 * Accepts either a sqlite subject id (number) OR a subject name (string).
 * If number is provided we attempt to resolve the name by querying sqlite subjects (read-only).
 * All session persistence is saved to electron-store.
 */
export function startSession(subjectIdentifier: number | string) {
  let subjectName = "general";
  let subjectRefId: number | null = null;

  if (typeof subjectIdentifier === "number") {
    try {
      const rows = query("subjects", { id: subjectIdentifier }, { limit: 1 });
      if (rows && rows.length > 0) {
        subjectName = rows[0].name || subjectName;
        subjectRefId = Number(rows[0].id) || null;
      }
    } catch (err) {
      console.warn("startSession: failed to resolve sqlite subject", err);
    }
  } else if (typeof subjectIdentifier === "string") {
    subjectName = subjectIdentifier || subjectName;
  }

  // ensure subject exists in store totals map
  addSubject(subjectName);

  const session = startSessionInStore(subjectName, subjectRefId ?? null);
  // startTime is epoch ms now
  return { id: session.id, startTime: session.startTime };
}

/**
 * Complete a session — writes to store, updates dailyStats and subjectTotals.
 * sessionId is the store session id.
 */
export function completeSession(sessionId: string, durationMinutes: number, pausedSeconds: number) {
  const completed = completeSessionInStore(sessionId, durationMinutes, pausedSeconds);
  return completed;
}

/* read-only helpers that read from the store (no SQL changes) */
export function getAllSessions() {
  return getAllSessionsFromStore();
}

export function getSessionsForDateWrapper(date: string) {
  return getSessionsForDate(date);
}

export function getDailyStatsWrapper() {
  return getDailyStats();
}

export function getSubjectTotalsWrapper() {
  return getSubjectTotals();
}

/* Settings */
export function getPomodoroSettings() {
  return getSettings();
}
export function updatePomodoroSettings(patch: Partial<ReturnType<typeof getSettings>>) {
  return setSettings(patch);
}

/* Subject store helpers */
export function addPomodoroSubject(name: string) {
  return addSubject(name);
}
export function removePomodoroSubject(name: string) {
  return removeSubjectFromStore(name);
}
