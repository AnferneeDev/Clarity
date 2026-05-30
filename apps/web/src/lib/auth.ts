import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LS_AUTH_TOKEN, LS_AUTH_REFRESH } from '@/lib/constants';

const isDev = process.env.NODE_ENV === 'development';

let supabaseClient: SupabaseClient | null = null;

function getClient() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (isDev) {
      console.log('[AUTH] Creating Supabase client — URL:', url ? `${url.slice(0, 30)}...` : 'EMPTY');
    }
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: typeof window !== 'undefined' ? {
          getItem: (key: string) => localStorage.getItem(key),
          setItem: (key: string, value: string) => localStorage.setItem(key, value),
          removeItem: (key: string) => localStorage.removeItem(key),
        } : undefined,
      },
    });

    if (typeof window !== 'undefined') {
      supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session) {
          localStorage.setItem(LS_AUTH_TOKEN, session.access_token);
          localStorage.setItem(LS_AUTH_REFRESH, session.refresh_token);
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem(LS_AUTH_TOKEN);
          localStorage.removeItem(LS_AUTH_REFRESH);
        }
      });
    }
  }
  return supabaseClient;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) {
    if (isDev) console.error('[AUTH] signIn failed:', error.message);
    return { success: false, error: error.message };
  }
  if (data.session) {
    localStorage.setItem(LS_AUTH_TOKEN, data.session.access_token);
    localStorage.setItem(LS_AUTH_REFRESH, data.session.refresh_token);
  }
  return {
    success: true,
    user: { id: data.user.id, email: data.user.email ?? '' },
  };
}

export async function signUp(email: string, password: string) {
  const { error } = await getClient().auth.signUp({ email, password });
  if (error) {
    if (isDev) console.error('[AUTH] signUp failed:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function signOut() {
  localStorage.removeItem(LS_AUTH_TOKEN);
  localStorage.removeItem(LS_AUTH_REFRESH);
  await getClient().auth.signOut();
}

export async function restoreSession() {
  const { data } = await getClient().auth.getSession();
  if (data.session) {
    localStorage.setItem(LS_AUTH_TOKEN, data.session.access_token);
    return { id: data.session.user.id, email: data.session.user.email ?? '' };
  }
  return null;
}
