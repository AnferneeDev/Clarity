import { ipcMain, BrowserWindow, shell } from 'electron';
import { supabase } from '../services/supabase';
import { localCache } from '../services/cache';
import { alarmChecker } from '../lib/alarms';
import type { Session } from '@supabase/supabase-js';


function makeValidate(getMainWindow: () => BrowserWindow | null) {
  return (e: Electron.IpcMainInvokeEvent): boolean => {
    const win = getMainWindow();
    return e.sender === win?.webContents;
  };
}

async function hydrateAfterAuth(userId: string) {
  try {
    const lastSync = localCache.getLastSyncTimestamp(userId);
    console.log(`[Auth] 🔄 Hydrating cache for ${userId.slice(0, 8)}... lastSync: ${lastSync || 'never'}`);

    const sessions = await supabase.pullSessions(userId, lastSync || undefined);
    if (sessions.length > 0) {
      const added = localCache.mergeFromSupabase(userId, sessions);
      console.log(`[Auth] ✅ Cache hydrated: ${added} new, ${sessions.length} total`);
    } else {
      console.log('[Auth] ✅ No new sessions from server');
    }

    // Start alarm checker
    alarmChecker.start(userId);
    console.log('[Auth] 🔔 Alarm checker started');

    // Also load user preferences
    const prefs = await supabase.getPreferences(userId);
    if (prefs) {
      console.log('[Auth] 📋 Loaded preferences from server');
    }
  } catch (err) {
    console.error('[Auth] ❌ Hydration failed:', err);
  }
}

export function registerAuthHandlers(
  getMainWindow: () => BrowserWindow | null,
  setUserId: (id: string) => void
) {
  const validate = makeValidate(getMainWindow);

  ipcMain.handle('auth:login', async (e, email: string, password: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof email !== 'string' || !email) throw new Error('Email required');
    if (typeof password !== 'string' || !password) throw new Error('Password required');

    const { user, error } = await supabase.signIn(email, password);
    if (error) return { success: false, error: error.message };

    setUserId(user.id);
    hydrateAfterAuth(user.id).catch(err => console.error('[Auth] Hydration error:', err));

    const profile = await supabase.getProfile(user.id);
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: profile?.username ?? user.email?.split('@')[0],
      },
    };
  });

  ipcMain.handle('auth:oauth', async (e, provider: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof provider !== 'string' || !provider) throw new Error('Provider required');

    const { url, error } = await supabase.signInWithOAuth(provider as 'google' | 'github');
    if (error) return { success: false, error: error.message };
    if (!url) return { success: false, error: 'Failed to get OAuth URL' };

    await shell.openExternal(url);
    return { success: true, message: 'OAuth flow started in browser' };
  });
  ipcMain.handle('auth:signUp', async (e, email: string, password: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof email !== 'string' || !email) throw new Error('Email required');
    if (typeof password !== 'string' || !password) throw new Error('Password required');

    const { user, error } = await supabase.signUp(email, password);
    if (error) return { success: false, error: error.message };
    return { success: true, user: { id: user.id, email: user.email } };
  });

  ipcMain.handle('auth:logout', async (e) => {
    if (!validate(e)) throw new Error('Invalid sender');
    const ok = await supabase.signOut();
    return { success: ok };
  });

  ipcMain.handle('auth:getSession', async (e) => {
    if (!validate(e)) throw new Error('Invalid sender');

    const session: Session | null = await supabase.getSession();
    if (!session?.user) return null;

    setUserId(session.user.id);
    hydrateAfterAuth(session.user.id).catch(err => console.error('[Auth] Hydration error:', err));

    const profile = await supabase.getProfile(session.user.id);
    return {
      id: session.user.id,
      email: session.user.email,
      username: profile?.username ?? session.user.email?.split('@')[0],
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}
