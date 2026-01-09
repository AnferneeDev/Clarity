/**
 * Supabase Service - Handles all Supabase operations and sync logic
 * 
 * Features:
 * - Offline-first architecture
 * - Timestamp-based Last-Write-Wins conflict resolution
 * - Automatic sync on connection restore
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
export interface SyncMetadata {
  userId: string;
  localLastUpdatedAt: string;
  serverLastUpdatedAt: string;
}

interface SyncResult {
  success: boolean;
  direction: 'local-to-server' | 'server-to-local' | 'none';
  error?: string;
}

class SupabaseService {
  private client: SupabaseClient | null = null;
  private isInitialized = false;

  /**
   * Initialize Supabase client
   * Must be called before any other operations
   */
  initialize(url: string, anonKey: string): void {
    if (this.isInitialized) return;
    
    this.client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });
    
    this.isInitialized = true;
    console.log('[Supabase] Client initialized');
  }

  /**
   * Check if we have an internet connection
   */
  async isOnline(): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      const { error } = await this.client.from('sync_metadata').select('user_id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Get server's last update timestamp for a user
   */
  async getServerLastUpdatedAt(userId: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      const { data, error } = await this.client
        .from('sync_metadata')
        .select('last_updated_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('[Supabase] Error fetching server timestamp:', error);
        return null;
      }

      return data?.last_updated_at || null;
    } catch (err) {
      console.error('[Supabase] Exception fetching timestamp:', err);
      return null;
    }
  }

  /**
   * Determine sync direction based on timestamps
   * Returns: 'push' (local wins), 'pull' (server wins), or 'none' (in sync)
   */
  async determineSyncDirection(
    localTimestamp: string,
    userId: string
  ): Promise<'push' | 'pull' | 'none'> {
    const serverTimestamp = await this.getServerLastUpdatedAt(userId);
    
    if (!serverTimestamp) {
      // No server data, push local
      return 'push';
    }

    const localDate = new Date(localTimestamp);
    const serverDate = new Date(serverTimestamp);

    if (localDate > serverDate) {
      console.log('[Sync] Local is newer → Push to server');
      return 'push';
    } else if (serverDate > localDate) {
      console.log('[Sync] Server is newer → Pull from server');
      return 'pull';
    } else {
      console.log('[Sync] Already in sync');
      return 'none';
    }
  }

  /**
   * Push all local data to Supabase
   */
  async pushToServer(userId: string, localData: any): Promise<boolean> {
    if (!this.client) return false;

    try {
      console.log('[Sync] Pushing data to server...');

      // Delete existing data for this user
      await Promise.all([
        this.client.from('sessions').delete().eq('user_id', userId),
        this.client.from('subjects').delete().eq('user_id', userId),
        this.client.from('todos').delete().eq('user_id', userId),
        this.client.from('notes').delete().eq('user_id', userId),
        this.client.from('chapters').delete().eq('user_id', userId),
      ]);

      // Insert fresh data
      const promises: Promise<any>[] = [];

      // Subjects
      if (localData.subjects?.length > 0) {
        const subjects = localData.subjects.map((s: any) => ({
          user_id: userId,
          name: s.name,
          is_hidden: s.hidden || false,
          created_at: s.createdAt
        }));
        promises.push(this.client.from('subjects').insert(subjects));
      }

      // Sessions
      if (localData.sessions?.length > 0) {
        const sessions = localData.sessions.map((s: any) => ({
          user_id: userId,
          subject_name: s.subjectName,
          date: s.date,
          minutes: s.minutes,
          created_at: s.createdAt || new Date().toISOString()
        }));
        promises.push(this.client.from('sessions').insert(sessions));
      }

      // Todos
      if (localData.todos?.length > 0) {
        const todos = localData.todos.map((t: any) => ({
          user_id: userId,
          text: t.text,
          done: t.done,
          starred: t.starred,
          due_date: t.dueDate,
          created_at: t.createdAt
        }));
        promises.push(this.client.from('todos').insert(todos));
      }

      // Notes
      if (localData.notes?.length > 0) {
        const notes = localData.notes.map((n: any) => ({
          user_id: userId,
          title: n.title,
          content: n.content,
          color: n.color,
          created_at: n.createdAt
        }));
        promises.push(this.client.from('notes').insert(notes));
      }

      // Chapters
      if (localData.chapters?.length > 0) {
        const chapters = localData.chapters.map((c: any) => ({
          user_id: userId,
          title: c.title,
          icon: c.icon,
          cover_image: c.coverImage,
          clear: c.clear,
          created_at: c.createdAt
        }));
        promises.push(this.client.from('chapters').insert(chapters));
      }

      await Promise.all(promises);

      // Update server timestamp
      await this.client.from('sync_metadata').upsert({
        user_id: userId,
        last_updated_at: new Date().toISOString()
      });

      console.log('[Sync] ✅ Push complete');
      return true;
    } catch (err) {
      console.error('[Sync] ❌ Push failed:', err);
      return false;
    }
  }

  /**
   * Pull all data from Supabase
   */
  async pullFromServer(userId: string): Promise<any | null> {
    if (!this.client) return null;

    try {
      console.log('[Sync] Pulling data from server...');

      const [subjects, sessions, todos, notes, chapters] = await Promise.all([
        this.client.from('subjects').select('*').eq('user_id', userId),
        this.client.from('sessions').select('*').eq('user_id', userId),
        this.client.from('todos').select('*').eq('user_id', userId),
        this.client.from('notes').select('*').eq('user_id', userId),
        this.client.from('chapters').select('*').eq('user_id', userId),
      ]);

      const serverData = {
        subjects: subjects.data?.map((s: any) => ({
          id: s.id,
          userId: s.user_id,
          name: s.name,
          hidden: s.is_hidden,
          createdAt: s.created_at
        })) || [],
        sessions: sessions.data?.map((s: any) => ({
          id: s.id,
          userId: s.user_id,
          subjectName: s.subject_name,
          date: s.date,
          minutes: s.minutes,
          createdAt: s.created_at
        })) || [],
        todos: todos.data?.map((t: any) => ({
          id: t.id,
          userId: t.user_id,
          text: t.text,
          done: t.done,
          starred: t.starred,
          dueDate: t.due_date,
          createdAt: t.created_at
        })) || [],
        notes: notes.data?.map((n: any) => ({
          id: n.id,
          userId: n.user_id,
          title: n.title,
          content: n.content,
          color: n.color,
          createdAt: n.created_at
        })) || [],
        chapters: chapters.data?.map((c: any) => ({
          id: c.id,
          userId: c.user_id,
          title: c.title,
          icon: c.icon,
          coverImage: c.cover_image,
          clear: c.clear,
          createdAt: c.created_at
        })) || []
      };

      console.log('[Sync] ✅ Pull complete');
      return serverData;
    } catch (err) {
      console.error('[Sync] ❌ Pull failed:', err);
      return null;
    }
  }

  /**
   * Perform full sync based on timestamps
   */
  async sync(userId: string, localData: any, localTimestamp: string): Promise<SyncResult> {
    if (!(await this.isOnline())) {
      return { success: false, direction: 'none', error: 'Offline' };
    }

    const direction = await this.determineSyncDirection(localTimestamp, userId);

    if (direction === 'none') {
      return { success: true, direction: 'none' };
    }

    if (direction === 'push') {
      const success = await this.pushToServer(userId, localData);
      return { success, direction: 'local-to-server' };
    }

    // direction === 'pull'
    const serverData = await this.pullFromServer(userId);
    if (serverData) {
      return { success: true, direction: 'server-to-local', ...serverData };
    }

    return { success: false, direction: 'server-to-local', error: 'Pull failed' };
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;
