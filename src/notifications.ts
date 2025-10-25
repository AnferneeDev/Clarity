import { app, BrowserWindow, ipcMain, Notification } from "electron";
import path from "path";
import fs from "fs";
import { parseLocalDateTimeToMs } from "./timeUtils";

export interface Reminder {
  id: string;
  title: string;
  body?: string;
  timestamp: number; // epoch ms (local machine time)
}

const REMINDERS_FILENAME = "reminders.json";
const REMINDER_CHECK_INTERVAL_MS = 5_000; // 30s

let reminderCheckerHandle: NodeJS.Timeout | null = null;
let remindersFilePath: string | null = null;

function ensureRemindersFilePath(): string {
  if (remindersFilePath) return remindersFilePath;
  const userData = app.getPath("userData");
  const file = path.join(userData, REMINDERS_FILENAME);
  remindersFilePath = file;
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([]), { encoding: "utf8" });
    }
  } catch (err) {
    console.warn("Could not ensure reminders file:", err);
  }
  return remindersFilePath;
}

/**
 * Accept variety of timestamp forms and normalize to epoch ms (local).
 * - number -> returned as-is
 * - numeric-string -> parseInt
 * - "YYYY-MM-DD" or "YYYY-MM-DD HH:MM[:SS]" -> parsed with parseLocalDateTimeToMs (local timezone)
 * - otherwise fall back to Date.parse (may interpret timezone info if present)
 * Returns null if unable to parse.
 */
function normalizeTimestamp(input: any): number | null {
  if (input === null || input === undefined) return null;

  if (typeof input === "number" && Number.isFinite(input)) return Math.floor(input);

  if (typeof input === "string") {
    const s = input.trim();
    // pure numeric string -> epoch ms
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (!Number.isNaN(n)) return Math.floor(n);
    }

    // match local YYYY-MM-DD or YYYY-MM-DD[ T]HH:MM[:SS]
    const localMatch = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}(?::\d{2})?(?::\d{2})?))?$/.exec(s);
    if (localMatch) {
      const datePart = localMatch[1];
      const timePart = localMatch[2] || undefined;
      try {
        return parseLocalDateTimeToMs(datePart, timePart);
      } catch {
        // fallthrough to Date.parse
      }
    }

    // fallback to Date.parse (handles ISO with timezone info)
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
}

function loadReminders(): Reminder[] {
  try {
    const file = ensureRemindersFilePath();
    const raw = fs.readFileSync(file, { encoding: "utf8" });
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];

    // Normalize timestamps into epoch ms numbers where possible.
    const out: Reminder[] = [];
    for (const r of parsed) {
      try {
        const ts = normalizeTimestamp((r as any).timestamp);
        if (ts === null) {
          // skip reminders we cannot interpret
          continue;
        }
        out.push({
          id: String(r.id),
          title: String(r.title || ""),
          body: r.body ? String(r.body) : undefined,
          timestamp: ts,
        });
      } catch (err) {
        // skip malformed entries
        continue;
      }
    }

    return out;
  } catch (err) {
    console.warn("loadReminders failed:", err);
    return [];
  }
}

function saveReminders(list: Reminder[]) {
  const filePath = ensureRemindersFilePath();
  const tempFilePath = `${filePath}.tmp`;
  const backupFilePath = `${filePath}.bak`;

  try {
    const serial = (list || []).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      timestamp: r.timestamp,
    }));
    const jsonData = JSON.stringify(serial, null, 2); // Pretty-print for readability

    // Write to a temporary file first
    fs.writeFileSync(tempFilePath, jsonData, { encoding: "utf8" });

    // (Optional but recommended) Backup the last good file
    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, backupFilePath);
    }

    // Atomically rename the temp file to the final destination
    fs.renameSync(tempFilePath, filePath);
  } catch (error) {
    console.error(`CRITICAL WRITE ERROR for reminders.json:`, error);

    // If something went wrong, try to restore from the backup
    try {
      if (fs.existsSync(backupFilePath)) {
        fs.renameSync(backupFilePath, filePath);
      }
    } catch (restoreError) {
      console.error(`FATAL: Could not restore backup for reminders.json:`, restoreError);
    }

    // IMPORTANT: Let the calling function know something failed
    throw error;
  }
}

function showNotification(title: string, body?: string, mainWindow?: BrowserWindow) {
  try {
    const n = new Notification({ title, body });
    n.on("click", () => {
      try {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      } catch (err) {
        console.warn("Notification click handler failed:", err);
      }
    });
    n.show();
  } catch (err) {
    console.warn("showNotification error:", err);
  }
}

function startReminderChecker(mainWindow?: BrowserWindow) {
  if (reminderCheckerHandle) return;

  const check = () => {
    try {
      const now = Date.now();
      const list = loadReminders();
      if (!Array.isArray(list) || list.length === 0) return;

      const due = list.filter((r) => {
        const t = r && typeof r.timestamp === "number" ? r.timestamp : NaN;
        return !Number.isNaN(t) && t <= now;
      });
      if (!due.length) return;

      const remaining = list.filter((r) => {
        const t = r && typeof r.timestamp === "number" ? r.timestamp : NaN;
        return Number.isNaN(t) ? true : t > now;
      });

      for (const r of due) {
        showNotification(r.title, r.body, mainWindow);
      }

      saveReminders(remaining);
    } catch (err) {
      console.error("Reminder checker failed:", err);
    }
  };

  // run immediately then periodically
  check();
  reminderCheckerHandle = setInterval(check, REMINDER_CHECK_INTERVAL_MS);
}

function stopReminderChecker() {
  if (reminderCheckerHandle) {
    clearInterval(reminderCheckerHandle);
    reminderCheckerHandle = null;
  }
}

/* ---------- IPC handlers for reminders ---------- */
ipcMain.handle("reminder:add", async (_e, rem: { id: string; title: string; body?: string; timestamp: any }) => {
  try {
    const list = loadReminders();

    const normalized = normalizeTimestamp(rem.timestamp);
    if (normalized === null) {
      throw new Error("Invalid reminder timestamp");
    }

    const item: Reminder = {
      id: String(rem.id),
      title: String(rem.title || ""),
      body: rem.body ? String(rem.body) : undefined,
      timestamp: normalized,
    };

    list.push(item);
    // sort ascending by numeric timestamp
    list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    saveReminders(list);
    return item;
  } catch (err) {
    console.error("reminder:add failed:", err);
    throw err;
  }
});

ipcMain.handle("reminder:list", async () => {
  try {
    return loadReminders();
  } catch (err) {
    console.error("reminder:list failed:", err);
    return [];
  }
});

ipcMain.handle("reminder:remove", async (_e, id: string) => {
  try {
    const list = loadReminders().filter((r) => r.id !== id);
    saveReminders(list);
    return true;
  } catch (err) {
    console.error("reminder:remove failed:", err);
    return false;
  }
});

/**
 * Initialize reminders. Call this from main after BrowserWindow is created and app is ready.
 * @param mainWindow optional BrowserWindow - used to focus window when notifications clicked
 */
export function initNotificationsAndReminders(mainWindow?: BrowserWindow) {
  try {
    ensureRemindersFilePath();
    startReminderChecker(mainWindow);
  } catch (err) {
    console.error("initNotificationsAndReminders failed:", err);
  }
}

/* allow graceful stop if needed */
export function shutdownNotificationsAndReminders() {
  try {
    stopReminderChecker();
  } catch (err) {
    console.warn("shutdownNotificationsAndReminders failed:", err);
  }
}
