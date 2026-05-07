import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import { supabase } from '../services/supabase';

function makeValidate(getMainWindow: () => BrowserWindow | null) {
  return (e: Electron.IpcMainInvokeEvent): boolean => {
    const win = getMainWindow();
    return e.sender === win?.webContents;
  };
}

export function registerSettingsHandlers(getMainWindow: () => BrowserWindow | null, getUserId: () => string) {
  const validate = makeValidate(getMainWindow);

  function requireUser() {
    const uid = getUserId();
    if (!uid) throw new Error('Not authenticated');
    return uid;
  }

  function optionalUser() {
    return getUserId() || null;
  }

  // ---- Backgrounds ----
  ipcMain.handle('settings:getBackground', async (e, viewName: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    const userId = optionalUser();
    if (!userId) return null;
    return supabase.getBackground(userId, viewName);
  });

  ipcMain.handle('settings:getAllBackgrounds', async (e) => {
    if (!validate(e)) throw new Error('Invalid sender');
    const userId = optionalUser();
    if (!userId) return {};
    return supabase.getAllBackgrounds(userId);
  });

  ipcMain.handle('settings:setBackground', async (e, viewName: string, file: { name: string; data: number[] }) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (!file?.name || !file?.data) throw new Error('Invalid file');

    const userId = requireUser();
    const ext = path.extname(file.name).toLowerCase() || '.jpg';
    const fileName = `${userId}/${viewName}_${Date.now()}${ext}`;

    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';

    const imageUrl = await supabase.uploadImage(
      'backgrounds',
      fileName,
      Buffer.from(file.data),
      contentType,
    );

    if (imageUrl) {
      await supabase.setBackground(userId, viewName, imageUrl);
      return imageUrl;
    }

    return null;
  });

  ipcMain.handle('settings:removeBackground', async (e, viewName: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    await supabase.removeBackground(requireUser(), viewName);
  });

  // ---- Preferences ----
  ipcMain.handle('settings:getPreferences', async (e) => {
    if (!validate(e)) throw new Error('Invalid sender');
    return supabase.getPreferences(requireUser());
  });

  ipcMain.handle('settings:updatePreferences', async (e, updates: Record<string, unknown>) => {
    if (!validate(e)) throw new Error('Invalid sender');
    await supabase.updatePreferences(requireUser(), updates);
  });

  // ---- App controls ----
  ipcMain.handle('app:minimize', () => getMainWindow()?.minimize());
  ipcMain.handle('app:maximize', () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle('app:close', () => getMainWindow()?.close());
}
