import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { createMainWindow } from './lib/window';
import { createTray, setTrayState } from './lib/tray';
import { supabase } from './services/supabase';
import { registerAllIpcHandlers, setActiveUserId } from './ipc';
import { localCache } from './services/cache';

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

  // Restore session
  console.log('[Main] Restoring session...');
  const session = await supabase.getSession();
  if (session?.user) {
    setActiveUserId(session.user.id);
    console.log('[Main] Session restored:', session.user.email);

    // Hydrate local cache from Supabase (non-blocking)
    supabase.pullSessions(session.user.id)
      .then(data => {
        if (data.length > 0) {
          localCache.hydrateFromSupabase(session.user.id, data);
          console.log(`[Main] Cache hydrated: ${data.length} sessions`);
        }
      })
      .catch(err => console.error('[Main] Cache hydration failed:', err));
  } else {
    console.log('[Main] No session found');
  }

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
  // Register custom protocol for OAuth callbacks
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
