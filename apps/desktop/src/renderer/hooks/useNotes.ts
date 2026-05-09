import { useState, useEffect, useCallback } from 'react';

interface Note {
  id: number;
  user_id: string;
  title: string;
  content: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    try {
      const data = await window.electronAPI.notes.getAll();
      setNotes(data);
    } catch (err) {
      console.error('[Notes] Fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = useCallback(async (title: string, content = '', color = '#ffffff') => {
    try {
      const result = await window.electronAPI.notes.add({ title, content, color });
      await fetchNotes();
      return result;
    } catch (err) {
      console.error('[Notes] Add failed:', err);
      return null;
    }
  }, [fetchNotes]);

  const updateNote = useCallback(async (id: number, updates: Record<string, unknown>) => {
    try {
      await window.electronAPI.notes.update(id, updates);
      setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    } catch (err) {
      console.error('[Notes] Update failed:', err);
    }
  }, []);

  const deleteNote = useCallback(async (id: number) => {
    try {
      await window.electronAPI.notes.delete(id);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('[Notes] Delete failed:', err);
    }
  }, []);

  return { notes, isLoading, addNote, updateNote, deleteNote, refetch: fetchNotes };
}
