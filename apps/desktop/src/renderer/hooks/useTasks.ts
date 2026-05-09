import { useState, useEffect, useCallback } from 'react';

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
      const data = await window.electronAPI.tasks.getAll();
      setTasks(data);
    } catch (err) {
      console.error('[Tasks] Fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = useCallback(async (text: string, starred = false, dueDate?: string) => {
    try {
      const result = await window.electronAPI.tasks.add({ text, starred, due_date: dueDate });
      await fetchTasks();
      return result;
    } catch (err) {
      console.error('[Tasks] Add failed:', err);
      return null;
    }
  }, [fetchTasks]);

  const updateTask = useCallback(async (id: number, updates: Record<string, unknown>) => {
    try {
      await window.electronAPI.tasks.update(id, updates);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (err) {
      console.error('[Tasks] Update failed:', err);
    }
  }, []);

  const deleteTask = useCallback(async (id: number) => {
    try {
      await window.electronAPI.tasks.delete(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('[Tasks] Delete failed:', err);
    }
  }, []);

  return { tasks, isLoading, addTask, updateTask, deleteTask, refetch: fetchTasks };
}
