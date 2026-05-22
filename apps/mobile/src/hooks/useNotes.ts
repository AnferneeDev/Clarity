import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { getNotes, upsertNote, deleteNoteLocally, removeSyncedNote } from '@/lib/db';

interface Note {
  id: number;
  user_id: string;
  title: string;
  content: string;
  color: string;
}

export function useNotes(userId: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchNotes = useCallback(async () => {
    if (!userId) return;
    try {
      const rows = await getNotes(userId);
      setNotes(rows.map(r => ({ ...r })));
    } catch {} finally { setIsLoading(false); }
  }, [userId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const addNote = useCallback(async (title: string, content?: string, color?: string) => {
    if (!userId) return;
    await upsertNote(userId, { title, content, color });
    await fetchNotes();
  }, [userId, fetchNotes]);

  const updateNote = useCallback(async (id: number, updates: Partial<Note>, immediate = false) => {
    if (!userId) return;
    if (immediate) {
      await upsertNote(userId, { id, ...updates });
      await fetchNotes();
      return;
    }
    if (debounceRef.current[String(id)]) clearTimeout(debounceRef.current[String(id)]);
    debounceRef.current[String(id)] = setTimeout(async () => {
      await upsertNote(userId, { id, ...updates });
    }, 500);
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  }, [userId, fetchNotes]);

  const deleteNote = useCallback(async (id: number) => {
    if (!userId) return;
    await deleteNoteLocally(id);
    await fetchNotes();
  }, [userId, fetchNotes]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await api.notes.getAll();
      if (Array.isArray(data)) {
        const { replaceNotes: rn } = await import('@/lib/db');
        await rn(userId, data);
      }
    } catch {}
    await fetchNotes();
  }, [userId, fetchNotes]);

  return { notes, isLoading, addNote, updateNote, deleteNote, refetch };
}
