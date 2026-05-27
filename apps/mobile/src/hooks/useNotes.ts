import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

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
      const data = await api.notes.getAll();
      setNotes(Array.isArray(data) ? data : []);
    } catch { } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const addNote = useCallback(async (title: string, content = '', color = '#ffffff') => {
    try { await api.notes.add({ title, content, color }); await fetchNotes(); } catch { }
  }, [fetchNotes]);

  const updateNote = useCallback(async (id: number, updates: Record<string, unknown>) => {
    try { await api.notes.update(id, updates); setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n)); } catch { }
  }, []);

  const deleteNote = useCallback(async (id: number) => {
    try { await api.notes.delete(id); setNotes(prev => prev.filter(n => n.id !== id)); } catch { }
  }, []);

  return { notes, isLoading, addNote, updateNote, deleteNote, refetch: fetchNotes };
}
