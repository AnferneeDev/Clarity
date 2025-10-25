// root/src/timeUtils.ts
// Utilities to work with local dates/times (avoid implicit UTC midnight parsing).
// Exports helpers for: local date string (YYYY-MM-DD), parsing a local date+time into epoch ms,
// formatting epoch ms into local date/time strings, timezone detection and a safe scheduler.

export function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

/**
 * Return a YYYY-MM-DD string for the given date in the user's local timezone.
 * (Defaults to current date.)
 */
export function localDateString(d = new Date()): string {
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${year}-${month}-${day}`;
}

/**
 * Parse a local date string ("YYYY-MM-DD") and optional time string ("HH:MM" or "HH:MM:SS")
 * into epoch milliseconds *in the user's local timezone*.
 *
 * Examples:
 *   parseLocalDateTimeToMs("2025-10-02") -> midnight local time on Oct 2, 2025
 *   parseLocalDateTimeToMs("2025-10-02", "08:30") -> 08:30 local time
 *
 * Accepts Date input too: parseLocalDateTimeToMs(new Date()) -> now (ms)
 */
export function parseLocalDateTimeToMs(dateOrStr: string | Date, timeStr?: string): number {
  if (dateOrStr instanceof Date) {
    return dateOrStr.getTime();
  }

  // Validate date string YYYY-MM-DD
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOrStr);
  if (!dateMatch) {
    throw new Error(`Invalid date format (expected YYYY-MM-DD): ${dateOrStr}`);
  }

  const year = Number(dateMatch[1]);
  const monthIndex = Number(dateMatch[2]) - 1; // JS months 0-11
  const day = Number(dateMatch[3]);

  let hour = 0;
  let minute = 0;
  let second = 0;

  if (timeStr) {
    // Accept "HH", "HH:MM", "HH:MM:SS", optionally trimmed
    const t = timeStr.trim();
    const timeMatch = /^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?$/.exec(t);
    if (!timeMatch) {
      throw new Error(`Invalid time format (expected HH, HH:MM or HH:MM:SS): ${timeStr}`);
    }
    hour = Number(timeMatch[1] || 0);
    minute = Number(timeMatch[2] || 0);
    second = Number(timeMatch[3] || 0);

    // clamp values into JS Date-safe ranges
    hour = Math.min(Math.max(0, hour), 23);
    minute = Math.min(Math.max(0, minute), 59);
    second = Math.min(Math.max(0, second), 59);
  }

  // Construct a Date using local timezone
  const localDate = new Date(year, monthIndex, day, hour, minute, second, 0);
  return localDate.getTime();
}

/**
 * Format epoch ms into local date/time pieces for display.
 * Returns an object with:
 *  - date: "YYYY-MM-DD"
 *  - time: "HH:MM:SS"
 *  - iso: "YYYY-MM-DD HH:MM:SS" (readable)
 */
export function fromEpochToLocalDateTime(epochMs: number) {
  const d = new Date(epochMs);
  const date = localDateString(d);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const iso = `${date} ${time}`;
  return { date, time, iso };
}

/**
 * Get the user's IANA time zone string (e.g. "America/Los_Angeles") where available.
 */
export function getUserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof tz === "string" && tz) return tz;
  } catch {
    // fallthrough
  }
  // fallback: compute offset
  const offs = -new Date().getTimezoneOffset(); // minutes
  const sign = offs >= 0 ? "+" : "-";
  const abs = Math.abs(offs);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `UTC${sign}${pad(hh)}:${pad(mm)}`;
}

/**
 * Convert ms to human hh:mm:ss (useful for pause display).
 */
export function msToHMS(totalSecondsOrMs: number, inputIsMs = false): string {
  const totalSeconds = inputIsMs ? Math.floor(totalSecondsOrMs / 1000) : Math.floor(totalSecondsOrMs);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

/**
 * setTimeout is limited to roughly 2^31-1 ms (~24.8 days).
 * scheduleWithClampedTimeout will run the callback after the requested delay even if it's longer,
 * by re-scheduling multiple safe timeouts under the hood.
 *
 * Returns a cancellable handle { cancel: () => void }.
 */
const MAX_SAFE_TIMEOUT = 2147483647; // 2^31-1

export function scheduleWithClampedTimeout(fn: () => void, delayMs: number) {
  let cancelled = false;
  let remaining = Math.max(0, Math.floor(delayMs));

  function step() {
    if (cancelled) return;
    const take = Math.min(remaining, MAX_SAFE_TIMEOUT);
    remaining -= take;
    const id = setTimeout(() => {
      if (cancelled) return;
      if (remaining <= 0) {
        try {
          fn();
        } catch (err) {
          // swallow — caller can handle if needed
          // console.error('scheduled fn error', err);
        }
      } else {
        step();
      }
    }, take);
    // attach a cancel that clears this timeout
    handles.push(() => clearTimeout(id));
  }

  const handles: Array<() => void> = [];
  step();

  return {
    cancel() {
      cancelled = true;
      for (const h of handles) {
        try {
          h();
        } catch {}
      }
      handles.length = 0;
    },
  };
}

/**
 * Safe clamp helper for code that wants a numeric delay not exceeding the max.
 */
export function clampTimeoutDelay(delayMs: number): number {
  return Math.min(Math.max(0, Math.floor(delayMs)), MAX_SAFE_TIMEOUT);
}
