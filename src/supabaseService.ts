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
        // PGRST116 means no rows returned (first sync). Ignore it.
        if (error.code !== 'PGRST116') {
           console.error('[Supabase] Error fetching server timestamp:', error);
        }
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
        this.client.from('motivations').delete().eq('user_id', userId),
        this.client.from('game_quests').delete().eq('user_id', userId),
        this.client.from('game_habits').delete().eq('user_id', userId),
        this.client.from('game_skills').delete().eq('user_id', userId),
        this.client.from('game_characters').delete().eq('user_id', userId),
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
        promises.push(this.client.from('subjects').insert(subjects) as any);
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
        promises.push(this.client.from('sessions').insert(sessions) as any);
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
        promises.push(this.client.from('todos').insert(todos) as any);
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
        promises.push(this.client.from('notes').insert(notes) as any);
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
        promises.push(this.client.from('chapters').insert(chapters) as any);
      }

      // Motivations
      if (localData.motivations?.length > 0) {
        const motivations = localData.motivations.map((m: any) => ({
          user_id: userId,
          image_path: m.imagePath,
          order: m.order,
          created_at: m.createdAt
        }));
        promises.push(this.client.from('motivations').insert(motivations) as any);
      }

      // Game Data
      const gameData = localData.gameData?.[userId];
      if (gameData) {
        // Character
        promises.push(this.client.from('game_characters').insert({
          user_id: userId,
          hp: gameData.character.hp,
          max_hp: gameData.character.maxHp,
          xp: gameData.character.xp,
          level: gameData.character.level,
          coins: gameData.character.coins,
          avatar: gameData.character.avatar,
          last_reset_date: gameData.lastResetDate
        }) as unknown as Promise<any>);

        // Skills
        if (gameData.skills?.length > 0) {
          const skills = gameData.skills.map((s: any) => ({
            id: s.id,
            user_id: userId,
            name: s.name,
            icon: s.icon,
            level: s.level,
            xp: s.xp,
            xp_to_next_level: s.xpToNextLevel
          }));
          promises.push(this.client.from('game_skills').insert(skills) as any);
        }

        // Quests
        if (gameData.quests?.length > 0) {
          const quests = gameData.quests.map((q: any) => ({
            id: q.id,
            user_id: userId,
            name: q.name,
            icon: q.icon,
            skill_id: q.skillId || null,
            xp_reward: q.xpReward,
            completed: q.completed,
            last_completed_date: q.lastCompletedDate
          }));
          promises.push(this.client.from('game_quests').insert(quests) as any);
        }

        // Habits
        if (gameData.habits?.length > 0) {
          const habits = gameData.habits.map((h: any) => ({
            id: h.id,
            user_id: userId,
            name: h.name,
            icon: h.icon,
            type: h.type,
            skill_id: h.skillId || null,
            xp_reward: h.xpReward,
            hp_damage: h.hpDamage,
            completed: h.completed,
            last_completed_date: h.lastCompletedDate
          }));
          promises.push(this.client.from('game_habits').insert(habits) as any);
        }
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
      console.log('[Sync] Pulling data from server for userId:', userId);

      const [subjects, sessions, todos, notes, chapters, motivations, character, skills, quests, habits] = await Promise.all([
        this.client.from('subjects').select('*').eq('user_id', userId),
        this.client.from('sessions').select('*').eq('user_id', userId),
        this.client.from('todos').select('*').eq('user_id', userId),
        this.client.from('notes').select('*').eq('user_id', userId),
        this.client.from('chapters').select('*').eq('user_id', userId),
        this.client.from('motivations').select('*').eq('user_id', userId),
        this.client.from('game_characters').select('*').eq('user_id', userId).maybeSingle(),
        this.client.from('game_skills').select('*').eq('user_id', userId),
        this.client.from('game_quests').select('*').eq('user_id', userId),
        this.client.from('game_habits').select('*').eq('user_id', userId),
      ]);

      // Log any errors from the queries
      if (subjects.error) console.error('[Sync] subjects error:', subjects.error);
      if (sessions.error) console.error('[Sync] sessions error:', sessions.error);
      if (todos.error) console.error('[Sync] todos error:', todos.error);
      if (notes.error) console.error('[Sync] notes error:', notes.error);
      if (chapters.error) console.error('[Sync] chapters error:', chapters.error);
      if (motivations.error) console.error('[Sync] motivations error:', motivations.error);
      
      // Log raw data counts
      console.log('[Sync] Raw data counts:', {
        subjects: subjects.data?.length || 0,
        sessions: sessions.data?.length || 0,
        todos: todos.data?.length || 0,
        notes: notes.data?.length || 0,
        chapters: chapters.data?.length || 0,
        motivations: motivations.data?.length || 0,
        character: character.data ? 'Found' : 'Missing',
        skills: skills.data?.length || 0,
        quests: quests.data?.length || 0,
      });


      
      // Auto-create character if missing (Self-healing)
      let charData = character.data;
      if (!charData) {
        console.log('[Sync] Character missing, creating default...');
        const { data: newChar, error: createError } = await this.client
          .from('game_characters')
          .insert({
             user_id: userId,
             hp: 100,
             max_hp: 100,
             xp: 0,
             level: 1,
             coins: 0,
             avatar: 'default',
             last_reset_date: new Date().toISOString()
          })
          .select()
          .single();
          
        if (newChar) {
           charData = newChar;
           console.log('[Sync] Created default character');
        } else {
           console.error('[Sync] Failed to create default character:', createError);
        }
      }

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
        })) || [],
        motivations: motivations.data?.map((m: any) => ({
          id: m.id,
          userId: m.user_id,
          imagePath: m.image_path,
          order: m.order,
          createdAt: m.created_at
        })) || [],
        gameData: null as any
      };

      // Construct Game Data
      if (charData) {
        serverData.gameData = {
          character: {
            hp: charData.hp,
            maxHp: charData.max_hp,
            xp: charData.xp,
            level: charData.level,
            coins: charData.coins,
            avatar: charData.avatar
          },
          skills: skills.data?.map((s: any) => ({
            id: s.id,
            name: s.name,
            icon: s.icon,
            level: s.level,
            xp: s.xp,
            xpToNextLevel: s.xp_to_next_level
          })) || [],
          quests: quests.data?.map((q: any) => ({
            id: q.id,
            name: q.name,
            icon: q.icon,
            skillId: q.skill_id,
            xpReward: q.xp_reward,
            completed: q.completed,
            lastCompletedDate: q.last_completed_date
          })) || [],
          habits: habits.data?.map((h: any) => ({
            id: h.id,
            name: h.name,
            icon: h.icon,
            type: h.type,
            skillId: h.skill_id,
            xpReward: h.xp_reward,
            hpDamage: h.hp_damage,
            completed: h.completed,
            lastCompletedDate: h.last_completed_date
          })) || [],
          lastResetDate: charData.last_reset_date || new Date().toISOString().split('T')[0]
        };
      }


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

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<{ user: any; error: any }> {
    if (!this.client) {
      return { user: null, error: { message: 'Supabase not initialized' } };
    }

    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('[Auth] Login failed:', error.message);
        return { user: null, error };
      }

      console.log('[Auth] ✅ Login successful:', data.user?.email);
      return { user: data.user, error: null };
    } catch (err) {
      console.error('[Auth] Exception:', err);
      return { user: null, error: { message: String(err) } };
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client.auth.signOut();
      if (error) {
        console.error('[Auth] Logout failed:', error);
        return false;
      }
      console.log('[Auth] ✅ Logout successful');
      return true;
    } catch (err) {
      console.error('[Auth] Exception:', err);
      return false;
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<any> {
    if (!this.client) return null;

    try {
      const { data, error } = await this.client.auth.getSession();
      if (error) {
        console.error('[Auth] Get session failed:', error);
        return null;
      }
      return data.session;
    } catch (err) {
      console.error('[Auth] Exception:', err);
      return null;
    }
  }

  /**
   * Get current user
   */
  async getUser(): Promise<any> {
    if (!this.client) return null;

    try {
      const { data, error } = await this.client.auth.getUser();
      if (error) {
        console.error('[Auth] Get user failed:', error);
        return null;
      }
      return data.user;
    } catch (err) {
      console.error('[Auth] Exception:', err);
      return null;
    }
  }

  /**
   * Get a profile by username (case-insensitive)
   * Used for username-only login
   */
  async getProfileByUsername(username: string): Promise<{ id: string; username: string; full_name?: string } | null> {
    console.log('[Auth] getProfileByUsername called with:', username);
    
    if (!this.client) {
      console.log('[Auth] ERROR: Supabase client is null!');
      return null;
    }
    
    console.log('[Auth] Supabase client exists, querying profiles table...');

    try {
      const query = this.client
        .from('profiles')
        .select('id, username, full_name')
        .ilike('username', username)
        .limit(1);
      
      console.log('[Auth] Executing query...');
      const { data, error } = await query;
      
      console.log('[Auth] Query result - data:', JSON.stringify(data));
      console.log('[Auth] Query result - error:', error ? JSON.stringify(error) : 'none');

      if (error) {
        console.error('[Auth] Error querying profiles:', error);
        return null;
      }

      if (data && data.length > 0) {
        console.log('[Auth] Found profile:', data[0]);
        return data[0];
      }

      console.log('[Auth] No profile found for username:', username);
      return null;
    } catch (err) {
      console.error('[Auth] Exception querying profiles:', err);
      return null;
    }
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;
