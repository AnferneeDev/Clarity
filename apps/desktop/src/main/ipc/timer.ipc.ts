import { ipcMain, BrowserWindow } from 'electron';
import { supabase } from '../services/supabase';
import { localCache } from '../services/cache';

function makeValidate(getMainWindow: () => BrowserWindow | null) {
  return (e: Electron.IpcMainInvokeEvent): boolean => {
    const win = getMainWindow();
    return e.sender === win?.webContents;
  };
}

export function registerTimerHandlers(getMainWindow: () => BrowserWindow | null, getUserId: () => string) {
  const validate = makeValidate(getMainWindow);

  function requireUser() {
    const uid = getUserId();
    if (!uid) throw new Error('Not authenticated');
    return uid;
  }

  // ---- Subjects (direct to Supabase for multi-device sync) ----
  ipcMain.handle('timer:getSubjects', async (e) => {
    if (!validate(e)) throw new Error('Invalid sender');
    return supabase.getSubjects(requireUser());
  });

  ipcMain.handle('timer:addSubject', async (e, name: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name required');
    const result = await supabase.addSubject(requireUser(), name);
    localCache.addSubject(requireUser(), name);
    return result;
  });

  ipcMain.handle('timer:hideSubject', async (e, name: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name required');
    await supabase.hideSubject(requireUser(), name);
    localCache.hideSubject(requireUser(), name);
  });

  ipcMain.handle('timer:deleteSubject', async (e, name: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name required');
    await supabase.deleteSubject(requireUser(), name);
  });

  ipcMain.handle('timer:deleteSubjectCompletely', async (e, name: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name required');
    const userId = requireUser();
    await supabase.deleteSubjectCompletely(userId, name);
    localCache.deleteSubjectCompletely(userId, name);
  });

  // ---- Session saves: cache-first + async Supabase ----
  ipcMain.handle('timer:saveSession', async (e, subjectName: string, date: string, minutes: number) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof subjectName !== 'string' || !subjectName.trim()) throw new Error('Subject required');
    if (typeof date !== 'string' || !date.trim()) throw new Error('Date required');
    if (typeof minutes !== 'number' || minutes <= 0) throw new Error('Invalid minutes');

    const userId = requireUser();

    // 1. Write to local cache — instant, guaranteed, never fails
    localCache.addTimerMinutes(userId, subjectName, date, minutes);

    // 2. Push to Supabase — fire-and-forget, best effort
    supabase.addOrUpdateSession(userId, subjectName, date, minutes)
      .catch(err => console.error('[Timer] Supabase push failed (will retry):', err));

    return { success: true };
  });

  // ---- Stats: read from local cache (instant, no network) ----
  ipcMain.handle('timer:getSubjectTotals', async (e, startDate?: string, endDate?: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    return localCache.getSubjectTotals(requireUser(), startDate, endDate);
  });

  ipcMain.handle('timer:getDailyAggregate', async (e, startDate?: string, endDate?: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    return localCache.getDailyAggregate(requireUser(), startDate, endDate);
  });

  ipcMain.handle('timer:getSubjectDateAggregated', async (e, startDate?: string, endDate?: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    return localCache.getSubjectDateAggregated(requireUser(), startDate, endDate);
  });
}
