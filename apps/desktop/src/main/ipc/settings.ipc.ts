import { ipcMain, BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
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

  // ---- Backgrounds (local file storage) ----
  function getBgDir() {
    const dir = path.join(app.getPath('userData'), 'backgrounds');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  function broadcastBackgroundChange() {
    const win = getMainWindow();
    if (win) win.webContents.send('settings:background-changed');
  }

  function getBgPath(userId: string, viewName: string): string {
    return path.join(getBgDir(), `${userId}_${viewName}`);
  }

  ipcMain.handle('settings:getBackground', async (e, viewName: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    const userId = optionalUser();
    if (!userId) return null;

    const bgPath = getBgPath(userId, viewName);
    if (fs.existsSync(bgPath)) {
      const data = fs.readFileSync(bgPath);
      const ext = path.extname(bgPath).toLowerCase();
      let mime = 'image/jpeg';
      if (ext === '.png') mime = 'image/png';
      if (ext === '.gif') mime = 'image/gif';
      if (ext === '.webp') mime = 'image/webp';
      return `data:${mime};base64,${data.toString('base64')}`;
    }
    return null;
  });

  ipcMain.handle('settings:getAllBackgrounds', async (e) => {
    if (!validate(e)) throw new Error('Invalid sender');
    const userId = optionalUser();
    if (!userId) return {};

    const result: Record<string, string> = {};
    const dir = getBgDir();
    const files = fs.readdirSync(dir).filter(f => f.startsWith(`${userId}_`));
    for (const file of files) {
      const viewName = file.replace(`${userId}_`, '');
      const bgPath = path.join(dir, file);
      const data = fs.readFileSync(bgPath);
      const ext = path.extname(bgPath).toLowerCase();
      let mime = 'image/jpeg';
      if (ext === '.png') mime = 'image/png';
      if (ext === '.gif') mime = 'image/gif';
      if (ext === '.webp') mime = 'image/webp';
      result[viewName] = `data:${mime};base64,${data.toString('base64')}`;
    }
    return result;
  });

  ipcMain.handle('settings:setBackground', async (e, viewName: string, file: { name: string; data: number[] }) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (!file?.name || !file?.data) throw new Error('Invalid file');

    const userId = requireUser();
    const bgPath = getBgPath(userId, viewName);
    fs.writeFileSync(bgPath, Buffer.from(file.data));
    broadcastBackgroundChange();
    return `file://${bgPath}`;
  });

  ipcMain.handle('settings:removeBackground', async (e, viewName: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    const userId = requireUser();
    const bgPath = getBgPath(userId, viewName);
    if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);
    broadcastBackgroundChange();
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
