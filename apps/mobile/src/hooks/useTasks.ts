import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getTasks, upsertTask, deleteTaskLocally, removeSyncedTask } from '@/lib/db';

interface Task {
  id: number;
  user_id: string;
  text: string;
  done: boolean;
  starred: boolean;
  due_date: string | null;
}

export function useTasks(userId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!userId) return;
    try {
      const rows = await getTasks(userId);
      setTasks(rows.map(r => ({ ...r, done: !!r.done, starred: !!r.starred })));
    } catch {} finally { setIsLoading(false); }
  }, [userId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = useCallback(async (text: string, starred?: boolean, dueDate?: string) => {
    if (!userId) return;
    await upsertTask(userId, { text, starred, due_date: dueDate || null });
    await fetchTasks();
  }, [userId, fetchTasks]);

  const updateTask = useCallback(async (id: number, updates: Partial<Task>) => {
    if (!userId) return;
    await upsertTask(userId, { id, ...updates });
    await fetchTasks();
  }, [userId, fetchTasks]);

  const deleteTask = useCallback(async (id: number) => {
    if (!userId) return;
    await deleteTaskLocally(id);
    await fetchTasks();
  }, [userId, fetchTasks]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await api.tasks.getAll();
      if (Array.isArray(data)) {
        const { replaceTasks: rt } = await import('@/lib/db');
        await rt(userId, data);
      }
    } catch {}
    await fetchTasks();
  }, [userId, fetchTasks]);

  return { tasks, isLoading, addTask, updateTask, deleteTask, refetch };
}
