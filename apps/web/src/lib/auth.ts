import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getClient() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    console.log('[Supabase Init] URL:', url);
    console.log('[Supabase Init] Key Length:', key.length);
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
  }
  return supabaseClient;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  if (data.session) {
    localStorage.setItem('clarity_token', data.session.access_token);
    localStorage.setItem('clarity_refresh', data.session.refresh_token);
  }
  return {
    success: true,
    user: { id: data.user.id, email: data.user.email ?? '' },
  };
}

export async function signUp(email: string, password: string) {
  const { data, error } = await getClient().auth.signUp({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function signOut() {
  localStorage.removeItem('clarity_token');
  localStorage.removeItem('clarity_refresh');
  await getClient().auth.signOut();
}

export async function restoreSession() {
  const { data } = await getClient().auth.getSession();
  if (data.session) {
    localStorage.setItem('clarity_token', data.session.access_token);
    return { id: data.session.user.id, email: data.session.user.email ?? '' };
  }
  return null;
}
