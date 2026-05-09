import { ipcMain, BrowserWindow } from 'electron';
import { supabase } from '../services/supabase';
import { localCache } from '../services/cache';

function makeValidate(getMainWindow: () => BrowserWindow | null) {
  return (e: Electron.IpcMainInvokeEvent): boolean => {
    const win = getMainWindow();
    return e.sender === win?.webContents;
  };
}

async function refreshAlarms(userId: string) {
  try {
    const tasks = await supabase.getTasks(userId);
    localCache.setAlarms(userId, tasks);
  } catch (err) {
    console.error('[Tasks] Alarm refresh failed:', err);
  }
}

export function registerTasksHandlers(getMainWindow: () => BrowserWindow | null, getUserId: () => string) {
  const validate = makeValidate(getMainWindow);

  function requireUser() {
    const uid = getUserId();
    if (!uid) throw new Error('Not authenticated');
    return uid;
  }

  ipcMain.handle('tasks:getAll', async (e) => {
    if (!validate(e)) throw new Error('Invalid sender');
    const userId = requireUser();
    const tasks = await supabase.getTasks(userId);
    // Refresh alarm queue on every fetch
    refreshAlarms(userId).catch(err => console.error(err));
    return tasks;
  });

  ipcMain.handle('tasks:add', async (e, task: { text: string; starred?: boolean; due_date?: string }) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (!task || typeof task.text !== 'string' || !task.text.trim()) throw new Error('Text required');
    const result = await supabase.addTask(requireUser(), task);
    refreshAlarms(requireUser()).catch(err => console.error(err));
    return result;
  });

  ipcMain.handle('tasks:update', async (e, id: number, updates: Record<string, unknown>) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof id !== 'number') throw new Error('Invalid id');
    const ok = await supabase.updateTask(requireUser(), id, updates);
    refreshAlarms(requireUser()).catch(err => console.error(err));
    return { success: ok };
  });

  ipcMain.handle('tasks:delete', async (e, id: number) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof id !== 'number') throw new Error('Invalid id');
    const userId = requireUser();
    const ok = await supabase.deleteTask(userId, id);
    if (ok) localCache.removeAlarm(id, userId);
    refreshAlarms(userId).catch(err => console.error(err));
    return { success: ok };
  });
}
