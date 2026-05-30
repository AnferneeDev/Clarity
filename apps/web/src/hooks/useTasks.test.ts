import { renderHook, act } from '@testing-library/react';
import { useTasks } from './useTasks';
import { api } from '@/lib/api';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  api: {
    tasks: {
      getAll: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }
  }
}));

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches tasks on mount', async () => {
    const mockTasks = [
      { id: 1, user_id: '1', text: 'Task 1', done: false, starred: false, due_date: null, created_at: '', updated_at: '' }
    ];
    (api.tasks.getAll as any).mockResolvedValue(mockTasks);

    const { result } = renderHook(() => useTasks());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    
    // Wait for the effect to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(api.tasks.getAll).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.tasks).toEqual(mockTasks);
  });

  it('adds a task and refetches', async () => {
    (api.tasks.getAll as any).mockResolvedValue([]);
    (api.tasks.add as any).mockResolvedValue({});

    const { result } = renderHook(() => useTasks());
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.addTask('New Task', true, '2025-01-01');
    });

    expect(api.tasks.add).toHaveBeenCalledWith({ text: 'New Task', starred: true, due_date: '2025-01-01' });
    // fetchTasks is called again inside addTask
    expect(api.tasks.getAll).toHaveBeenCalledTimes(2);
  });

  it('updates a task optimistically', async () => {
    const mockTasks = [
      { id: 1, user_id: '1', text: 'Task 1', done: false, starred: false, due_date: null, created_at: '', updated_at: '' }
    ];
    (api.tasks.getAll as any).mockResolvedValue(mockTasks);
    (api.tasks.update as any).mockResolvedValue({});

    const { result } = renderHook(() => useTasks());
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.updateTask(1, { done: true });
    });

    expect(api.tasks.update).toHaveBeenCalledWith(1, { done: true });
    expect(result.current.tasks[0].done).toBe(true);
  });

  it('deletes a task optimistically', async () => {
    const mockTasks = [
      { id: 1, user_id: '1', text: 'Task 1', done: false, starred: false, due_date: null, created_at: '', updated_at: '' }
    ];
    (api.tasks.getAll as any).mockResolvedValue(mockTasks);
    (api.tasks.delete as any).mockResolvedValue({});

    const { result } = renderHook(() => useTasks());
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.deleteTask(1);
    });

    expect(api.tasks.delete).toHaveBeenCalledWith(1);
    expect(result.current.tasks.length).toBe(0);
  });
});
