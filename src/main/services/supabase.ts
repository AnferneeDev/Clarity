import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ============================================
// Session Storage Adapter (persist to file)
// ============================================
function createStorageAdapter() {
  const sessionPath = path.join(app.getPath('userData'), 'clarity-session.json');

  return {
    getItem: (key: string): string | null => {
      try {
        if (!fs.existsSync(sessionPath)) return null;
        const data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        return data[key] || null;
      } catch {
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        let data: Record<string, unknown> = {};
        if (fs.existsSync(sessionPath)) {
          data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        }
        data[key] = value;
        fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2), 'utf-8');
      } catch {
        // silently fail
      }
    },
    removeItem: (key: string): void => {
      try {
        if (!fs.existsSync(sessionPath)) return;
        const data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
        delete data[key];
        fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2), 'utf-8');
      } catch {
        // silently fail
      }
    },
  };
}

// ============================================
// Supabase Service
// ============================================
class SupabaseService {
  private client: any = null;

  initialize(url: string, anonKey: string): void {
    if (this.client) return;

    this.client = createClient(url, anonKey, {
      db: {
        schema: 'app',
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: createStorageAdapter(),
        detectSessionInUrl: false,
      },
    });
  }

  getClient(): any {
    if (!this.client) throw new Error('Supabase not initialized');
    return this.client;
  }

  // ============================================
  // Auth
  // ============================================
  async signIn(email: string, password: string): Promise<{ user: any; error: string | null }> {
    const { data, error } = await this.getClient().auth.signInWithPassword({ email, password });
    if (error) return { user: null as any, error: error.message };
    return { user: data.user as any, error: null };
  }

  async signUp(email: string, password: string): Promise<{ user: any; error: string | null }> {
    const { data, error } = await this.getClient().auth.signUp({ email, password });
    if (error) return { user: null as any, error: error.message };
    return { user: data.user as any, error: null };
  }

  async signOut(): Promise<boolean> {
    const { error } = await this.getClient().auth.signOut();
    return !error;
  }

  async signInWithOAuth(provider: 'google' | 'github'): Promise<{ url: string | null; error: string | null }> {
    const { data, error } = await this.getClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: 'clarity://auth/callback',
        skipBrowserRedirect: true,
      },
    });
    if (error) return { url: null as any, error: error.message };
    return { url: data.url as any, error: null };
  }

  async getSession() {
    const { data } = await this.getClient().auth.getSession();
    return data.session ?? null;
  }

  // ============================================
  // Profiles
  // ============================================
  async getProfile(userId: string) {
    const { data, error } = await this.getClient()
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  }

  async getProfileByUsername(username: string) {
    const { data } = await this.getClient()
      .from('profiles')
      .select('id, username, full_name')
      .ilike('username', username)
      .limit(1);
    return data?.[0] ?? null;
  }

  // ============================================
  // Subjects
  // ============================================
  async getSubjects(userId: string) {
    const { data } = await this.getClient()
      .from('subjects')
      .select('id, name, is_hidden, created_at')
      .eq('user_id', userId)
      .order('name');
    return data ?? [];
  }

  async addSubject(userId: string, name: string) {
    const normalized = name.toLowerCase().trim();
    // Check if exists (hidden or not)
    const { data: existing } = await this.getClient()
      .from('subjects')
      .select('id, is_hidden')
      .eq('user_id', userId)
      .eq('name', normalized)
      .maybeSingle();

    if (existing) {
      if (existing.is_hidden) {
        await this.getClient()
          .from('subjects')
          .update({ is_hidden: false })
          .eq('id', existing.id);
      }
      return existing;
    }

    const { data, error } = await this.getClient()
      .from('subjects')
      .insert({ user_id: userId, name: normalized })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async hideSubject(userId: string, name: string) {
    await this.getClient()
      .from('subjects')
      .update({ is_hidden: true })
      .eq('user_id', userId)
      .eq('name', name.toLowerCase());
  }

  async deleteSubject(userId: string, name: string) {
    await this.getClient()
      .from('subjects')
      .delete()
      .eq('user_id', userId)
      .eq('name', name.toLowerCase());
  }

  // ============================================
  // Sessions (timer data)
  // ============================================
  async addOrUpdateSession(userId: string, subjectName: string, date: string, minutes: number) {
    const normalized = subjectName.toLowerCase().trim();

    console.log(`[Supabase] Saving session: user=${userId}, subject="${normalized}", date=${date}, mins=${minutes.toFixed(2)}`);

    // Try atomic upsert via RPC first (single SQL statement, no race condition)
    const { error: rpcError } = await this.getClient()
      .rpc('upsert_session', {
        p_user_id: userId,
        p_subject_name: normalized,
        p_date: date,
        p_minutes: minutes,
      });

    if (!rpcError) {
      console.log(`[Supabase] ✅ Session saved via RPC: ${minutes.toFixed(2)}m for "${normalized}"`);
      return;
    }

    // Fallback: RPC function not deployed → use direct table operations
    console.warn(`[Supabase] RPC upsert failed (${rpcError.message}), falling back to direct ops`);

    try {
      const { data: existing } = await this.getClient()
        .from('sessions')
        .select('id, minutes')
        .eq('user_id', userId)
        .eq('subject_name', normalized)
        .eq('date', date)
        .maybeSingle();

      if (existing) {
        await this.getClient()
          .from('sessions')
          .update({ minutes: existing.minutes + minutes })
          .eq('id', existing.id);
      } else {
        await this.getClient()
          .from('sessions')
          .insert({
            user_id: userId,
            subject_name: normalized,
            date,
            minutes,
          });
      }

      console.log(`[Supabase] ✅ Session saved via fallback: ${minutes.toFixed(2)}m for "${normalized}"`);
    } catch (err: any) {
      console.error('[Supabase] ❌ Session save failed (fallback):', err.message || err);
    }
  }

  async pullSessions(userId: string, since?: string): Promise<Array<{
    subject_name: string; date: string; minutes: number;
  }>> {
    let query = this.getClient()
      .from('sessions')
      .select('subject_name, date, minutes')
      .eq('user_id', userId);

    if (since) query = query.gte('date', since);

    query = query.limit(10_000);  // safety net: each user's sessions fit easily

    const { data } = await query;
    return (data ?? []) as Array<{ subject_name: string; date: string; minutes: number }>;
  }

  async deleteSubjectCompletely(userId: string, name: string) {
    const normalized = name.toLowerCase().trim();
    await Promise.all([
      this.getClient().from('subjects').delete().eq('user_id', userId).eq('name', normalized),
      this.getClient().from('sessions').delete().eq('user_id', userId).eq('subject_name', normalized),
    ]);
  }

  // ============================================
  // Tasks
  // ============================================
  async getTasks(userId: string) {
    const { data } = await this.getClient()
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async addTask(userId: string, task: { text: string; starred?: boolean; due_date?: string }) {
    const { data, error } = await this.getClient()
      .from('tasks')
      .insert({
        user_id: userId,
        text: task.text,
        starred: task.starred ?? false,
        due_date: task.due_date ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateTask(userId: string, id: number, updates: Record<string, unknown>) {
    const { error } = await this.getClient()
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    return !error;
  }

  async deleteTask(userId: string, id: number) {
    const { error } = await this.getClient()
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    return !error;
  }

  // ============================================
  // Notes
  // ============================================
  async getNotes(userId: string) {
    const { data } = await this.getClient()
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data ?? [];
  }

  async addNote(userId: string, note: { title: string; content?: string; color?: string }) {
    const { data, error } = await this.getClient()
      .from('notes')
      .insert({
        user_id: userId,
        title: note.title,
        content: note.content ?? '',
        color: note.color ?? '#ffffff',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateNote(userId: string, id: number, updates: Record<string, unknown>) {
    const { error } = await this.getClient()
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);
    return !error;
  }

  async deleteNote(userId: string, id: number) {
    const { error } = await this.getClient()
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    return !error;
  }

  // ============================================
  // User Preferences
  // ============================================
  async getPreferences(userId: string) {
    const { data } = await this.getClient()
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return data ?? null;
  }

  async updatePreferences(userId: string, updates: Record<string, unknown>) {
    await this.getClient()
      .from('user_preferences')
      .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() });
  }
}

export const supabase = new SupabaseService();
