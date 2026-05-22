import { api } from './api';
import {
  getLastSync, setLastSync,
  getUnsyncedSessions, markSessionsSynced,
  replaceSubjects,
  replaceTasks, getUnsyncedTasks,
  replaceNotes, getUnsyncedNotes,
  setPreference, getAllPreferences,
} from './db';

export async function fullSync(userId: string) {
  const now = Date.now();
  console.log('[Sync] Starting full sync...');

  await pullSubjects(userId);
  await pullTasks(userId);
  await pullNotes(userId);
  await pullPreferences(userId);

  await pushPendingSessions(userId);
  await pushPendingTasks(userId);
  await pushPendingNotes(userId);

  await setLastSync('full', now);
  console.log('[Sync] Full sync complete');
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
    console.log('[Sync] Subjects pulled:', data?.length || 0);
  } catch (e) { console.error('[Sync] Pull subjects failed:', e); }
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
    console.log('[Sync] Tasks pulled:', data?.length || 0);
  } catch (e) { console.error('[Sync] Pull tasks failed:', e); }
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
    console.log('[Sync] Notes pulled:', data?.length || 0);
  } catch (e) { console.error('[Sync] Pull notes failed:', e); }
}

async function pullPreferences(userId: string) {
  try {
    const data = await api.settings.getPreferences();
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        await setPreference(key, String(value));
      }
    }
    console.log('[Sync] Preferences pulled');
  } catch (e) { console.error('[Sync] Pull preferences failed:', e); }
}

export async function pushPendingSessions(userId: string) {
  try {
    const sessions = await getUnsyncedSessions(userId);
    for (const s of sessions) {
      await api.timer.saveSession(s.subject_name, s.date, s.minutes);
      await markSessionsSynced(userId, s.subject_name, s.date);
    }
    if (sessions.length > 0) console.log('[Sync] Sessions pushed:', sessions.length);
  } catch (e) { console.error('[Sync] Push sessions failed:', e); }
}

async function pushPendingTasks(userId: string) {
  try {
    const pending = await import('./db').then(m => m.getTasks(userId));
    for (const t of pending) {
      if (!t.synced && t.pending_action) {
        if (t.pending_action === 'create') {
          await api.tasks.add({ text: t.text, starred: !!t.starred, due_date: t.due_date || undefined });
        } else if (t.pending_action === 'update') {
          await api.tasks.update(t.id, {
            text: t.text,
            done: !!t.done,
            starred: !!t.starred,
            due_date: t.due_date || null,
          });
        } else if (t.pending_action === 'delete') {
          await api.tasks.delete(t.id);
          await import('./db').then(m => m.removeSyncedTask(t.id));
        }
      }
    }
  } catch (e) { console.error('[Sync] Push tasks failed:', e); }
}

async function pushPendingNotes(userId: string) {
  try {
    const pending = await import('./db').then(m => m.getNotes(userId));
    for (const n of pending) {
      if (!n.synced && n.pending_action) {
        if (n.pending_action === 'create') {
          await api.notes.add({ title: n.title, content: n.content, color: n.color });
        } else if (n.pending_action === 'update') {
          await api.notes.update(n.id, { title: n.title, content: n.content, color: n.color });
        } else if (n.pending_action === 'delete') {
          await api.notes.delete(n.id);
          await import('./db').then(m => m.removeSyncedNote(n.id));
        }
      }
    }
  } catch (e) { console.error('[Sync] Push notes failed:', e); }
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundSync(userId: string) {
  if (syncInterval) return;
  syncInterval = setInterval(async () => {
    try {
      await pushPendingSessions(userId);
      await pushPendingTasks(userId);
      await pushPendingNotes(userId);
    } catch {}
  }, 30_000);
}

export function stopBackgroundSync() {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
}
