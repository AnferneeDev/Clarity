import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { createMainWindow } from './lib/window';
import { createTray, setTrayState } from './lib/tray';
import { supabase } from './services/supabase';
import { registerAllIpcHandlers, setActiveUserId } from './ipc';
import { localCache } from './services/cache';
import { alarmChecker } from './lib/alarms';

// Handle squirrel startup
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // Module not available in dev
}

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
(global as any).isQuitting = false;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const PRELOAD_PATH = path.join(__dirname, 'preload.js');

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

async function initApp() {
  console.log('[Main] Starting Clarity v3...');

  // Init Supabase
  supabase.initialize(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('[Main] Supabase initialized');

  // Create window
  mainWindow = createMainWindow(PRELOAD_PATH);
  console.log('[Main] Window created');

  // Register IPC handlers
  registerAllIpcHandlers(getMainWindow);

  // Restore session + hydrate cache (blocking — prevents stale reads)
  console.log('[Main] Restoring session...');
  const session = await supabase.getSession();
  if (session?.user) {
    setActiveUserId(session.user.id);
    console.log('[Main] Session restored:', session.user.email);

    try {
      const lastSync = localCache.getLastSyncTimestamp(session.user.id);
      console.log('[Main] 🔄 Hydrating cache... lastSync:', lastSync || 'never');
      console.log('[Main]   userId:', session.user.id);

      const data = await supabase.pullSessions(session.user.id, lastSync || undefined);
      if (data.length > 0) {
        const added = localCache.mergeFromSupabase(session.user.id, data);
        console.log(`[Main] ✅ Cache hydrated: ${added} new, ${data.length} total from server`);
      } else {
        console.log('[Main] ✅ No new sessions from server — cache already current');
      }
    } catch (err) {
      console.error('[Main] ❌ Cache hydration failed:', err);
    }

    // Start alarm checker for past-due task reminders
    alarmChecker.start(session.user.id);
    console.log('[Main] 🔔 Alarm checker started');
  } else {
    console.log('[Main] No session found');
  }

  // Debug logging from renderer
  ipcMain.handle('debug:log', async (_e, msg: string) => {
    console.log('[RENDERER]', msg);
  });

  // Notification from renderer (fires native OS notification)
  ipcMain.handle('notify:fire', async (e, title: string, body: string) => {
    // Fire via renderer's HTML5 Notification (works on all platforms)
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && !win.isDestroyed()) {
      win.webContents.send('alarm:fire', { title, body });
      console.log('[Notify] ✅ Fired via renderer:', title);
    }
  });

  // Minimize to tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
    return true;
  });

  // Tray
  createTray(mainWindow);

  // Tray state handler
  ipcMain.handle('tray:setState', (_e, state: 'active' | 'idle') => {
    setTrayState(state);
  });
}

app.whenReady().then(() => {
  // Required for Windows notifications
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.clarity.app');
  }
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('clarity', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('clarity');
  }

  // Handle OAuth callback on macOS
  app.on('open-url', async (_event, url) => {
    await handleOAuthCallback(url);
  });

  initApp();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow(PRELOAD_PATH);
      registerAllIpcHandlers(getMainWindow);
    }
  });
});

// Handle OAuth callback on Windows/Linux (second instance)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', async (_event, commandLine) => {
    const url = commandLine.find(arg => arg.startsWith('clarity://'));
    if (url) {
      await handleOAuthCallback(url);
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

async function handleOAuthCallback(url: string) {
  console.log('[Main] OAuth callback received:', url);
  try {
    const parsed = new URL(url);
    if (parsed.pathname === '/auth/callback') {
      // Exchange the code for a session
      const { data } = await supabase.getClient().auth.exchangeCodeForSession(
        parsed.searchParams.get('code') || ''
      );
      if (data.session?.user) {
        setActiveUserId(data.session.user.id);
        mainWindow?.webContents.send('auth:oauth-complete', { success: true });
        console.log('[Main] OAuth login successful:', data.session.user.email);
      }
    }
  } catch (err) {
    console.error('[Main] OAuth callback processing failed:', err);
    mainWindow?.webContents.send('auth:oauth-complete', { success: false, error: String(err) });
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  (global as any).isQuitting = true;
});
