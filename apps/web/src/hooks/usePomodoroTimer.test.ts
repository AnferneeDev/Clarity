import { renderHook, act, waitFor } from '@testing-library/react';
import { usePomodoroTimer } from './usePomodoroTimer';
import { api } from '@/lib/api';
import { useTimerStore } from '@/lib/store';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the API
vi.mock('@/lib/api', () => ({
  api: {
    timer: {
      getSubjects: vi.fn().mockResolvedValue([{ name: 'study', id: '1', is_hidden: false }]),
      startTimer: vi.fn().mockResolvedValue({}),
      stopTimer: vi.fn().mockResolvedValue({}),
      getActiveTimer: vi.fn().mockResolvedValue({ active: false })
    },
    settings: {
      updatePreferences: vi.fn().mockResolvedValue({})
    }
  }
}));

describe('usePomodoroTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-30T10:00:00Z'));
    useTimerStore.setState({
      selectedSubject: 'study',
      isRunning: false,
      isPaused: false,
      timeLeft: 25 * 60,
      currentPhase: 'focus',
      currentCycle: 0
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call startTimer when starting', async () => {
    const { result } = renderHook(() => usePomodoroTimer());

    act(() => {
      result.current.handleStart();
    });

    await waitFor(() => {
      expect(api.timer.startTimer).toHaveBeenCalledWith('study', 25, 'focus');
    });
  });

  it('should call stopTimer when pausing', async () => {
    useTimerStore.setState({ isRunning: true });
    const { result } = renderHook(() => usePomodoroTimer());

    act(() => {
      result.current.handlePause();
    });

    await waitFor(() => {
      expect(api.timer.stopTimer).toHaveBeenCalled();
    });
  });

  it('should fetch active timer on mount and resume it', async () => {
    (api.timer.getActiveTimer as any).mockResolvedValueOnce({
      active: true,
      timer: {
        subject_name: 'work',
        started_at: new Date('2026-05-30T09:50:00Z').toISOString(), // 10 mins ago
        expected_duration_minutes: 25,
        phase: 'focus'
      }
    });

    renderHook(() => usePomodoroTimer());

    await waitFor(() => {
      expect(api.timer.getActiveTimer).toHaveBeenCalled();
    });

    const store = useTimerStore.getState();
    expect(store.selectedSubject).toBe('work');
    expect(store.isRunning).toBe(true);
    // 25 mins expected - 10 mins elapsed = 15 mins remaining
    expect(store.timeLeft).toBe(15 * 60);
  });
});
