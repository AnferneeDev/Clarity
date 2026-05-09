import { ipcMain, BrowserWindow } from 'electron';
import { supabase } from '../services/supabase';

function makeValidate(getMainWindow: () => BrowserWindow | null) {
  return (e: Electron.IpcMainInvokeEvent): boolean => {
    const win = getMainWindow();
    return e.sender === win?.webContents;
  };
}

export function registerNotesHandlers(getMainWindow: () => BrowserWindow | null, getUserId: () => string) {
  const validate = makeValidate(getMainWindow);

  function requireUser() {
    const uid = getUserId();
    if (!uid) throw new Error('Not authenticated');
    return uid;
  }

  ipcMain.handle('notes:getAll', async (e) => {
    if (!validate(e)) throw new Error('Invalid sender');
    return supabase.getNotes(requireUser());
  });

  ipcMain.handle('notes:add', async (e, note: { title: string; content?: string; color?: string }) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (!note || typeof note.title !== 'string' || !note.title.trim()) throw new Error('Title required');
    return supabase.addNote(requireUser(), note);
  });

  ipcMain.handle('notes:update', async (e, id: number, updates: Record<string, unknown>) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof id !== 'number') throw new Error('Invalid id');
    const ok = await supabase.updateNote(requireUser(), id, updates);
    return { success: ok };
  });

  ipcMain.handle('notes:delete', async (e, id: number) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof id !== 'number') throw new Error('Invalid id');
    const ok = await supabase.deleteNote(requireUser(), id);
    return { success: ok };
  });
}
