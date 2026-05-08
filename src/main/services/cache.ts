import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ============================================
// Types
// ============================================
interface CacheSession {
  user_id: string;
  subject_name: string;
  date: string;
  minutes: number;
}

interface CacheData {
  sessions: CacheSession[];
  subjects: Array<{ user_id: string; name: string; is_hidden: boolean }>;
  lastSyncTimestamps: Record<string, string>; // userId → ISO timestamp
  lastSaveTimestamps: Record<string, number>;  // userId → epoch ms
}

// ============================================
// In-memory cache + JSON file persistence
// ============================================
const EMPTY_CACHE: CacheData = {
  sessions: [],
  subjects: [],
  lastSyncTimestamps: {},
  lastSaveTimestamps: {},
};

class LocalCache {
  private data: CacheData = { ...EMPTY_CACHE, sessions: [], subjects: [] };
  private filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'clarity-cache.json');
    this.load();
    this.startPeriodicFlush();
  }

  // ---- Load / Save ----
  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          sessions: parsed.sessions || [],
          subjects: parsed.subjects || [],
          lastSyncTimestamps: parsed.lastSyncTimestamps || {},
          lastSaveTimestamps: parsed.lastSaveTimestamps || {},
        };
      }
    } catch (err) {
      console.error('[Cache] Load failed:', err);
      this.data = { ...EMPTY_CACHE, sessions: [], subjects: [] };
    }
  }

  private flush() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Cache] Flush failed:', err);
    }
  }

  private startPeriodicFlush() {
    // Flush to disk every 5 seconds to survive crashes
    setInterval(() => this.flush(), 5_000);
  }

  // ---- Timer Session Operations ----
  addTimerMinutes(userId: string, subjectName: string, date: string, minutes: number) {
    const normalized = subjectName.toLowerCase().trim();

    // Ensure subject exists
    if (!this.data.subjects.some(s => s.user_id === userId && s.name === normalized)) {
      this.data.subjects.push({ user_id: userId, name: normalized, is_hidden: false });
    }

    // Find or create session
    const existing = this.data.sessions.find(
      s => s.user_id === userId && s.subject_name === normalized && s.date === date
    );
    if (existing) {
      existing.minutes += minutes;
    } else {
      this.data.sessions.push({
        user_id: userId,
        subject_name: normalized,
        date,
        minutes,
      });
    }

    this.data.lastSaveTimestamps[userId] = Date.now();
    this.flush(); // Immediate flush for data integrity
  }

  // ---- Subjects ----
  getSubjects(userId: string): Array<{ id: string; name: string; is_hidden: boolean }> {
    return this.data.subjects
      .filter(s => s.user_id === userId)
      .map((s, i) => ({ id: `cache-${i}`, name: s.name, is_hidden: s.is_hidden }));
  }

  addSubject(userId: string, name: string) {
    const normalized = name.toLowerCase().trim();
    if (!this.data.subjects.some(s => s.user_id === userId && s.name === normalized)) {
      this.data.subjects.push({ user_id: userId, name: normalized, is_hidden: false });
      this.flush();
    }
  }

  hideSubject(userId: string, name: string) {
    const s = this.data.subjects.find(s => s.user_id === userId && s.name === name.toLowerCase());
    if (s) { s.is_hidden = true; this.flush(); }
  }

  deleteSubjectCompletely(userId: string, name: string) {
    const normalized = name.toLowerCase().trim();
    this.data.subjects = this.data.subjects.filter(
      s => !(s.user_id === userId && s.name === normalized)
    );
    this.data.sessions = this.data.sessions.filter(
      s => !(s.user_id === userId && s.subject_name === normalized)
    );
    this.flush();
  }

  // ---- Aggregation (from cache, instant) ----
  getSubjectTotals(userId: string, startDate?: string, endDate?: string) {
    const totals = new Map<string, number>();
    for (const s of this.data.sessions) {
      if (s.user_id !== userId) continue;
      if (startDate && s.date < startDate) continue;
      if (endDate && s.date > endDate) continue;
      totals.set(s.subject_name, (totals.get(s.subject_name) || 0) + s.minutes);
    }
    return Array.from(totals.entries()).map(([subject, total_minutes]) => ({ subject, total_minutes }));
  }

  getDailyAggregate(userId: string, startDate?: string, endDate?: string) {
    const byDate = new Map<string, { total_minutes: number; subjects: Set<string> }>();
    for (const s of this.data.sessions) {
      if (s.user_id !== userId) continue;
      if (startDate && s.date < startDate) continue;
      if (endDate && s.date > endDate) continue;
      let entry = byDate.get(s.date);
      if (!entry) { entry = { total_minutes: 0, subjects: new Set() }; byDate.set(s.date, entry); }
      entry.total_minutes += s.minutes;
      entry.subjects.add(s.subject_name);
    }
    return Array.from(byDate.entries()).map(([date, entry]) => ({
      date,
      total_minutes: entry.total_minutes,
      subjects: Array.from(entry.subjects),
    }));
  }

  getSubjectDateAggregated(userId: string, startDate?: string, endDate?: string) {
    return this.data.sessions
      .filter(s => {
        if (s.user_id !== userId) return false;
        if (startDate && s.date < startDate) return false;
        if (endDate && s.date > endDate) return false;
        return true;
      })
      .map(s => ({ subject: s.subject_name, date: s.date, total_minutes: s.minutes }));
  }

  // ---- Hydration from Supabase ----
  hydrateFromSupabase(userId: string, serverSessions: Array<{
    subject_name: string; date: string; minutes: number;
  }>) {
    // Replace local sessions for this user with server data
    this.data.sessions = this.data.sessions.filter(s => s.user_id !== userId);
    for (const s of serverSessions) {
      this.data.sessions.push({
        user_id: userId,
        subject_name: s.subject_name,
        date: s.date,
        minutes: s.minutes,
      });
    }
    this.data.lastSyncTimestamps[userId] = new Date().toISOString();
    this.flush();
  }

  getLastSyncTimestamp(userId: string): string | null {
    return this.data.lastSyncTimestamps[userId] || null;
  }

  // ---- Token bucket (for rate-limited pushes) ----
  getSessionsForSync(userId: string, since: string): CacheSession[] {
    return this.data.sessions.filter(
      s => s.user_id === userId && s.date >= since
    );
  }
}

export const localCache = new LocalCache();
