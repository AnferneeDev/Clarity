import { ipcMain, BrowserWindow, shell } from 'electron';
import { supabase } from '../services/supabase';
import type { Session } from '@supabase/supabase-js';

function makeValidate(getMainWindow: () => BrowserWindow | null) {
  return (e: Electron.IpcMainInvokeEvent): boolean => {
    const win = getMainWindow();
    return e.sender === win?.webContents;
  };
}

export function registerAuthHandlers(getMainWindow: () => BrowserWindow | null) {
  const validate = makeValidate(getMainWindow);

  ipcMain.handle('auth:login', async (e, email: string, password: string) => {
    if (!validate(e)) throw new Error('Invalid sender');
    if (typeof email !== 'string' || !email) throw new Error('Email required');
    if (typeof password !== 'string' || !password) throw new Error('Password required');

    const { user, error } = await supabase.signIn(email, password);
    if (error) return { success: false, error: error.message };

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

    const profile = await supabase.getProfile(session.user.id);
    return {
      id: session.user.id,
      email: session.user.email,
      username: profile?.username ?? session.user.email?.split('@')[0],
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}
