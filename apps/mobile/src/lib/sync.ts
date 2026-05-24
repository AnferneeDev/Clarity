import { api } from './api';
import {
  getLastSync, setLastSync,
  getUnsyncedSessions, markSessionsSynced,
  replaceSubjects,
  replaceTasks, getTasks, removeSyncedTask, markTaskSynced,
  replaceNotes, getNotes, removeSyncedNote, markNoteSynced,
  setPreference,
  getDb,
} from './db';

async function isOnline(): Promise<boolean> {
  try {
    const { getNetworkStateAsync } = await import('expo-network');
    const state = await getNetworkStateAsync();
    return state.isConnected ?? true;
  } catch { return true; }
}

export async function fullSync(userId: string) {
  if (!userId) {
    if (__DEV__) console.warn('[Sync] Cannot sync: userId is empty');
    return;
  }
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
  if (!userId) return;
  let sessions: any[] = [];
  try {
    sessions = await getUnsyncedSessions(userId);
  } catch (e) {
    if (__DEV__) console.error('[Sync] Push sessions failed (read):', e);
    return;
  }
  if (__DEV__) console.log(`[Sync] Unsynced sessions to push: ${sessions.length}`);
  for (const s of sessions) {
    try {
      if (__DEV__) console.log(`[Sync] Pushing session to server: subject=${s.subject_name}, date=${s.date}, minutes=${s.minutes}`);
      const res = await api.timer.saveSession(s.subject_name, s.date, s.minutes);
      if (__DEV__) console.log(`[Sync] Push session response:`, res);
      await markSessionsSynced(userId, s.subject_name, s.date);
      if (__DEV__) console.log(`[Sync] Session marked synced locally: ${s.subject_name} ${s.date} ${s.minutes}min`);
    } catch (e) {
      if (__DEV__) console.error(`[Sync] Push sessions failed (write ${s.subject_name}):`, e);
    }
  }
}

export async function pushPendingTasks(userId: string) {
  if (!userId) return;
  let all: any[] = [];
  let pendingDelete: { id: number }[] = [];
  try {
    all = await getTasks(userId);
    const db = await getDb();
    pendingDelete = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM tasks WHERE user_id = ? AND pending_action = 'delete'",
      [userId]
    );
  } catch (e) {
    if (__DEV__) console.error('[Sync] Push tasks failed (read):', e);
    return;
  }

  for (const t of all) {
    if (t.synced || !t.pending_action) continue;
    try {
      if (t.pending_action === 'create') {
        if (__DEV__) console.log(`[Sync] Pushing new task to server: text=${t.text}, starred=${t.starred}`);
        const res = await api.tasks.add({ text: t.text, starred: !!t.starred, due_date: t.due_date || undefined });
        if (__DEV__) console.log(`[Sync] Push new task response:`, res);
        await removeSyncedTask(t.id);
        if (__DEV__) console.log('[Sync] Task created on server, temp local row removed');
      } else if (t.pending_action === 'update') {
        if (__DEV__) console.log(`[Sync] Pushing task update to server: id=${t.id}, text=${t.text}, done=${t.done}`);
        const res = await api.tasks.update(t.id, { text: t.text, done: !!t.done, starred: !!t.starred, due_date: t.due_date || null });
        if (__DEV__) console.log(`[Sync] Push task update response:`, res);
        await markTaskSynced(t.id);
      }
    } catch (e) {
      if (__DEV__) console.error(`[Sync] Push tasks failed (write task ${t.id}):`, e);
    }
  }

  for (const t of pendingDelete) {
    try {
      if (__DEV__) console.log(`[Sync] Pushing task delete to server: id=${t.id}`);
      const res = await api.tasks.delete(t.id);
      if (__DEV__) console.log(`[Sync] Push task delete response:`, res);
      await removeSyncedTask(t.id);
    } catch (e) {
      if (__DEV__) console.error(`[Sync] Push tasks failed (delete task ${t.id}):`, e);
    }
  }
}

export async function pushPendingNotes(userId: string) {
  if (!userId) return;
  let all: any[] = [];
  let pendingDelete: { id: number }[] = [];
  try {
    all = await getNotes(userId);
    const db = await getDb();
    pendingDelete = await db.getAllAsync<{ id: number }>(
      "SELECT id FROM notes WHERE user_id = ? AND pending_action = 'delete'",
      [userId]
    );
  } catch (e) {
    if (__DEV__) console.error('[Sync] Push notes failed (read):', e);
    return;
  }

  for (const n of all) {
    if (n.synced || !n.pending_action) continue;
    try {
      if (n.pending_action === 'create') {
        if (__DEV__) console.log(`[Sync] Pushing new note to server: title=${n.title}`);
        const res = await api.notes.add({ title: n.title, content: n.content, color: n.color });
        if (__DEV__) console.log(`[Sync] Push new note response:`, res);
        await removeSyncedNote(n.id);
        if (__DEV__) console.log('[Sync] Note created on server, temp local row removed');
      } else if (n.pending_action === 'update') {
        if (__DEV__) console.log(`[Sync] Pushing note update to server: id=${n.id}, title=${n.title}`);
        const res = await api.notes.update(n.id, { title: n.title, content: n.content, color: n.color });
        if (__DEV__) console.log(`[Sync] Push note update response:`, res);
        await markNoteSynced(n.id);
      }
    } catch (e) {
      if (__DEV__) console.error(`[Sync] Push notes failed (write note ${n.id}):`, e);
    }
  }

  for (const n of pendingDelete) {
    try {
      if (__DEV__) console.log(`[Sync] Pushing note delete to server: id=${n.id}`);
      const res = await api.notes.delete(n.id);
      if (__DEV__) console.log(`[Sync] Push note delete response:`, res);
      await removeSyncedNote(n.id);
    } catch (e) {
      if (__DEV__) console.error(`[Sync] Push notes failed (delete note ${n.id}):`, e);
    }
  }
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundSync(userId: string) {
  if (!userId) return;
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
