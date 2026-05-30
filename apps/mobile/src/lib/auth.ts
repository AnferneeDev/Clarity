import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

let supabaseClient: ReturnType<typeof createClient> | null = null;

function createSecureStoreAdapter() {
  let store: any = null;
  const getModule = async () => {
    if (!store) store = await import('expo-secure-store');
    return store;
  };

  return {
    getItem: async (key: string) => {
      const m = await getModule();
      try { return await m.getItemAsync(key); } catch { return null; }
    },
    setItem: async (key: string, value: string) => {
      const m = await getModule();
      try { await m.setItemAsync(key, value); } catch {}
    },
    removeItem: async (key: string) => {
      const m = await getModule();
      try { await m.deleteItemAsync(key); } catch {}
    },
  };
}

export function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  supabaseClient = createClient(url, anonKey, {
    auth: {
      storage: createSecureStoreAdapter(),
      autoRefreshToken: true,
      persistSession: true,
    },
  });

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    try {
      const { setItemAsync, deleteItemAsync } = await import('expo-secure-store');
      if (session) {
        await setItemAsync('clarity_token', session.access_token);
      } else {
        await deleteItemAsync('clarity_token');
      }
    } catch (err) {
      console.error('[AUTH] Failed to sync clarity_token to SecureStore:', err);
    }
  });

  return supabaseClient;
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  if (data.session) {
    try {
      const { setItemAsync } = await import('expo-secure-store');
      await setItemAsync('clarity_token', data.session.access_token);
    } catch (err) {
      console.error('[AUTH] Failed to write token during signIn:', err);
    }
  }

  return { user: { id: data.user.id, email: data.user.email } };
}

export async function signUp(email: string, password: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { success: true, error: null };
}

export async function signOut() {
  const supabase = getSupabase();
  await supabase.auth.signOut();
  try {
    const { deleteItemAsync } = await import('expo-secure-store');
    await deleteItemAsync('clarity_token');
  } catch (err) {
    console.error('[AUTH] Failed to delete token during signOut:', err);
  }
}

export async function restoreSession(): Promise<{ id: string; email?: string } | null> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  try {
    const { setItemAsync } = await import('expo-secure-store');
    await setItemAsync('clarity_token', data.session.access_token);
  } catch (err) {
    console.error('[AUTH] Failed to write token during restoreSession:', err);
  }

  return {
    id: data.session.user.id,
    email: data.session.user.email,
  };
}
