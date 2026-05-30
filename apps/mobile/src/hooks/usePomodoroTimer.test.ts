import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePomodoroTimer } from './usePomodoroTimer';
import { api } from '@/lib/api';
import { useTimerStore } from '@/lib/store';

// Mock the API
jest.mock('@/lib/api', () => ({
  api: {
    timer: {
      getSubjects: jest.fn().mockResolvedValue([{ name: 'study', id: '1', is_hidden: false }]),
      startTimer: jest.fn().mockResolvedValue({}),
      stopTimer: jest.fn().mockResolvedValue({}),
      getActiveTimer: jest.fn().mockResolvedValue({ active: false })
    },
    settings: {
      updatePreferences: jest.fn().mockResolvedValue({})
    }
  }
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(true)
}));

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          setPositionAsync: jest.fn(),
          playAsync: jest.fn()
        }
      })
    }
  }
}));

// Mock the DB
jest.mock('@/lib/db', () => ({
  getPreference: jest.fn().mockResolvedValue(null),
  setPreference: jest.fn().mockResolvedValue(null)
}));

describe('usePomodoroTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    jest.setSystemTime(new Date('2026-05-30T10:00:00Z'));
    useTimerStore.setState({
      selectedSubject: 'study',
      isRunning: false,
      isPaused: false,
      timeLeft: 25 * 60,
      currentPhase: 'focus',
      currentCycle: 0
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call startTimer when starting', async () => {
    const { result } = renderHook(() => usePomodoroTimer());

    await act(async () => {
      await result.current.handleStart();
    });

    await waitFor(() => {
      expect(api.timer.startTimer).toHaveBeenCalledWith('study', 25, 'focus');
    });
  });

  it('should call stopTimer when pausing', async () => {
    useTimerStore.setState({ isRunning: true });
    const { result } = renderHook(() => usePomodoroTimer());

    await act(async () => {
      await result.current.handlePause();
    });

    await waitFor(() => {
      expect(api.timer.stopTimer).toHaveBeenCalled();
    });
  });

  it('should fetch active timer on mount and resume it', async () => {
    (api.timer.getActiveTimer as jest.Mock).mockResolvedValueOnce({
      active: true,
      timer: {
        subject_name: 'work',
        started_at: new Date('2026-05-30T09:50:00Z').toISOString(), // 10 mins ago
        expected_duration_minutes: 25,
        phase: 'focus'
      }
    });

    const { result } = renderHook(() => usePomodoroTimer());

    await act(async () => {
      jest.runAllTimers();
    });

    expect(api.timer.getActiveTimer).toHaveBeenCalled();

    const store = useTimerStore.getState();
    expect(store.selectedSubject).toBe('work');
    expect(store.isRunning).toBe(true);
    // 25 mins expected - 10 mins elapsed = 15 mins remaining
    expect(store.timeLeft).toBe(15 * 60);
  });
});
