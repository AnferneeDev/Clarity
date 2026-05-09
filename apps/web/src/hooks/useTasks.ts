import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface Task {
  id: number;
  user_id: string;
  text: string;
  done: boolean;
  starred: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.tasks.getAll();
      setTasks(Array.isArray(data) ? data : []);
    } catch { /* offline */ } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = useCallback(async (text: string, starred = false, dueDate?: string) => {
    try {
      await api.tasks.add({ text, starred, due_date: dueDate });
      await fetchTasks();
    } catch { /* offline */ }
  }, [fetchTasks]);

  const updateTask = useCallback(async (id: number, updates: Record<string, unknown>) => {
    try {
      await api.tasks.update(id, updates);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch { /* offline */ }
  }, []);

  const deleteTask = useCallback(async (id: number) => {
    try {
      await api.tasks.delete(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch { /* offline */ }
  }, []);

  return { tasks, isLoading, addTask, updateTask, deleteTask, refetch: fetchTasks };
}
