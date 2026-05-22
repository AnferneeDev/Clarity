import { api } from './api';
import {
  getLastSync, setLastSync,
  getUnsyncedSessions, markSessionsSynced,
  replaceSubjects,
  replaceTasks, getTasks, removeSyncedTask, markTaskSynced,
  replaceNotes, getNotes, removeSyncedNote, markNoteSynced,
  setPreference,
} from './db';

async function isOnline(): Promise<boolean> {
  try {
    const { getNetworkStateAsync } = await import('expo-network');
    const state = await getNetworkStateAsync();
    return state.isConnected ?? true;
  } catch { return true; }
}

export async function fullSync(userId: string) {
  if (!(await isOnline())) {
    if (__DEV__) console.log('[Sync] Offline — skipping full sync');
    return;
  }
  const now = Date.now();
  if (__DEV__) console.log('[Sync] Starting full sync...');

  await pullSubjects(userId);
  await pullTasks(userId);
  await pullNotes(userId);
  await pullPreferences(userId);

  await pushPendingSessions(userId);
  await pushPendingTasks(userId);
  await pushPendingNotes(userId);

  await setLastSync('full', now);
  if (__DEV__) console.log('[Sync] Full sync complete');
}

async function pullSubjects(userId: string) {
  try {
    const data = await api.timer.getSubjects();
    if (Array.isArray(data)) {
      await replaceSubjects(userId, data.map((s: any) => ({
        id: s.id,
        name: s.name,
        is_hidden: s.is_hidden,
      })));
    }
    if (__DEV__) console.log('[Sync] Subjects pulled:', data?.length || 0);
  } catch (e) { if (__DEV__) console.error('[Sync] Pull subjects failed:', e); }
}

async function pullTasks(userId: string) {
  try {
    const data = await api.tasks.getAll();
    if (Array.isArray(data)) {
      await replaceTasks(userId, data.map((t: any) => ({
        id: t.id,
        text: t.text,
        done: t.done,
        starred: t.starred,
        due_date: t.due_date || null,
      })));
    }
    if (__DEV__) console.log('[Sync] Tasks pulled:', data?.length || 0);
  } catch (e) { if (__DEV__) console.error('[Sync] Pull tasks failed:', e); }
}

async function pullNotes(userId: string) {
  try {
    const data = await api.notes.getAll();
    if (Array.isArray(data)) {
      await replaceNotes(userId, data.map((n: any) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        color: n.color,
      })));
    }
    if (__DEV__) console.log('[Sync] Notes pulled:', data?.length || 0);
  } catch (e) { if (__DEV__) console.error('[Sync] Pull notes failed:', e); }
}

async function pullPreferences(userId: string) {
  try {
    const data = await api.settings.getPreferences();
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        await setPreference(key, String(value));
      }
    }
    if (__DEV__) console.log('[Sync] Preferences pulled');
  } catch (e) { if (__DEV__) console.error('[Sync] Pull preferences failed:', e); }
}

export async function pushPendingSessions(userId: string) {
  try {
    const sessions = await getUnsyncedSessions(userId);
    for (const s of sessions) {
      await api.timer.saveSession(s.subject_name, s.date, s.minutes);
      await markSessionsSynced(userId, s.subject_name, s.date);
    }
    if (__DEV__ && sessions.length > 0) console.log('[Sync] Sessions pushed:', sessions.length);
  } catch (e) { if (__DEV__) console.error('[Sync] Push sessions failed:', e); }
}

export async function pushPendingTasks(userId: string) {
  try {
    const all = await getTasks(userId);
    // Also fetch rows pending delete (which are excluded from the UI query)
    const { openDatabaseAsync } = await import('expo-sqlite');
    const db = await openDatabaseAsync('clarity.db');
    const pendingDelete = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM tasks WHERE user_id = ? AND pending_action = 'delete'",
      [userId]
    );

    // Handle creates and updates from the UI-visible set
    for (const t of all) {
      if (t.synced || !t.pending_action) continue;
      if (t.pending_action === 'create') {
        // Push to server; then remove local temp row (real ID comes back via pull)
        await api.tasks.add({ text: t.text, starred: !!t.starred, due_date: t.due_date || undefined });
        await removeSyncedTask(t.id);
        if (__DEV__) console.log('[Sync] Task created on server, temp local row removed');
      } else if (t.pending_action === 'update') {
        await api.tasks.update(t.id, { text: t.text, done: !!t.done, starred: !!t.starred, due_date: t.due_date || null });
        await markTaskSynced(t.id);
      }
    }

    // Handle deletes
    for (const t of pendingDelete) {
      await api.tasks.delete(t.id);
      await removeSyncedTask(t.id);
    }
  } catch (e) { if (__DEV__) console.error('[Sync] Push tasks failed:', e); }
}

export async function pushPendingNotes(userId: string) {
  try {
    const all = await getNotes(userId);
    const { openDatabaseAsync } = await import('expo-sqlite');
    const db = await openDatabaseAsync('clarity.db');
    const pendingDelete = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM notes WHERE user_id = ? AND pending_action = 'delete'",
      [userId]
    );

    for (const n of all) {
      if (n.synced || !n.pending_action) continue;
      if (n.pending_action === 'create') {
        await api.notes.add({ title: n.title, content: n.content, color: n.color });
        await removeSyncedNote(n.id);
        if (__DEV__) console.log('[Sync] Note created on server, temp local row removed');
      } else if (n.pending_action === 'update') {
        await api.notes.update(n.id, { title: n.title, content: n.content, color: n.color });
        await markNoteSynced(n.id);
      }
    }

    for (const n of pendingDelete) {
      await api.notes.delete(n.id);
      await removeSyncedNote(n.id);
    }
  } catch (e) { if (__DEV__) console.error('[Sync] Push notes failed:', e); }
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundSync(userId: string) {
  if (syncInterval) return;
  syncInterval = setInterval(async () => {
    try {
      if (!(await isOnline())) return;
      await pushPendingSessions(userId);
      await pushPendingTasks(userId);
      await pushPendingNotes(userId);
    } catch {}
  }, 30_000);
}

export function stopBackgroundSync() {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
}
