import { ipcMain, BrowserWindow } from 'electron';
import { supabase } from '../services/supabase';

function makeValidate(getMainWindow: () => BrowserWindow | null) {
  return (e: Electron.IpcMainInvokeEvent): boolean => {
    const win = getMainWindow();
    return e.sender === win?.webContents;
  };
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
    return supabase.getTasks(requireUser());
  });

  ipcMain.handle('tasks:add', async (e, task: { text: string; starred?: boolean; due_date?: string }) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (!task || typeof task.text !== 'string' || !task.text.trim()) throw new Error('Text required');
    return supabase.addTask(requireUser(), task);
  });

  ipcMain.handle('tasks:update', async (e, id: number, updates: Record<string, unknown>) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof id !== 'number') throw new Error('Invalid id');
    const ok = await supabase.updateTask(requireUser(), id, updates);
    return { success: ok };
  });

  ipcMain.handle('tasks:delete', async (e, id: number) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof id !== 'number') throw new Error('Invalid id');
    const ok = await supabase.deleteTask(requireUser(), id);
    return { success: ok };
  });
}
