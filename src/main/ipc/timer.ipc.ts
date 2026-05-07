import { ipcMain, BrowserWindow } from 'electron';
import { supabase } from '../services/supabase';

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

  ipcMain.handle('timer:getSubjects', async (e) => {
    if (!validate(e)) throw new Error('Invalid sender');
    return supabase.getSubjects(requireUser());
  });

  ipcMain.handle('timer:addSubject', async (e, name: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name required');
    return supabase.addSubject(requireUser(), name);
  });

  ipcMain.handle('timer:hideSubject', async (e, name: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name required');
    await supabase.hideSubject(requireUser(), name);
  });

  ipcMain.handle('timer:deleteSubject', async (e, name: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name required');
    await supabase.deleteSubject(requireUser(), name);
  });

  ipcMain.handle('timer:saveSession', async (e, subjectName: string, date: string, minutes: number) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof subjectName !== 'string' || !subjectName.trim()) throw new Error('Subject required');
    if (typeof date !== 'string' || !date.trim()) throw new Error('Date required');
    if (typeof minutes !== 'number' || minutes <= 0) throw new Error('Invalid minutes');

    await supabase.addOrUpdateSession(requireUser(), subjectName, date, minutes);
    return { success: true };
  });

  ipcMain.handle('timer:getSubjectTotals', async (e, startDate?: string, endDate?: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    return supabase.getSubjectTotals(requireUser(), startDate, endDate);
  });

  ipcMain.handle('timer:getDailyAggregate', async (e, startDate?: string, endDate?: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    return supabase.getDailyAggregate(requireUser(), startDate, endDate);
  });
}
