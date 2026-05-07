import { useState, useEffect, useRef, useCallback } from 'react';
import { getLocalDateString } from '../lib/utils';

type TimerPhase = 'focus' | 'short' | 'long';

const LS_FOCUS = 'clarity_v3:focus_minutes';
const LS_SHORT = 'clarity_v3:short_break_minutes';
const LS_LONG = 'clarity_v3:long_break_minutes';
const LS_ALLOW_LONG = 'clarity_v3:allow_long_timers';
const LS_AUTO_START = 'clarity_v3:auto_start_breaks';
const LS_SELECTED = 'clarity_v3:selected_subject';

function safeLocalNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch { return fallback; }
}

export function usePomodoroTimer() {
  // ---- Settings (local state, synced to Supabase prefs on change) ----
  const [focusMinutes, setFocusMinutesState] = useState(() => safeLocalNumber(LS_FOCUS, 25));
  const [shortBreakMinutes, setShortBreakMinutesState] = useState(() => safeLocalNumber(LS_SHORT, 5));
  const [longBreakMinutes, setLongBreakMinutesState] = useState(() => safeLocalNumber(LS_LONG, 15));
  const [allowLongTimers, setAllowLongTimersState] = useState(() => localStorage.getItem(LS_ALLOW_LONG) !== 'false');
  const [autoStartBreaks, setAutoStartBreaksState] = useState(() => localStorage.getItem(LS_AUTO_START) === 'true');

  // ---- Subjects ----
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string; is_hidden: boolean }>>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>(() => localStorage.getItem(LS_SELECTED) || '');
  const [isLoading, setIsLoading] = useState(true);

  // ---- Timer state ----
  const [currentPhase, setCurrentPhase] = useState<TimerPhase>('focus');
  const [timeLeft, setTimeLeft] = useState(focusMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);

  // Refs for interval tracking
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(0);
  const trackingSubjectRef = useRef<string>('');
  const todayRef = useRef(getLocalDateString());

  const phaseTotalSeconds = currentPhase === 'focus'
    ? focusMinutes * 60
    : currentPhase === 'short'
      ? shortBreakMinutes * 60
      : longBreakMinutes * 60;

  // ---- Fetch subjects on mount ----
  useEffect(() => {
    const load = async () => {
      try {
        const data = await window.electronAPI.timer.getSubjects();
        setSubjects(data.map((s: any) => ({ id: s.id, name: s.name, is_hidden: s.is_hidden })));
        // Auto-select first visible subject if none selected
        if (!selectedSubject) {
          const visible = data.filter((s: any) => !s.is_hidden);
          if (visible.length > 0) {
            setSelectedSubject(visible[0].name);
          }
        }
      } catch (err) {
        console.error('[Timer] Failed to load subjects:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // ---- Settings persist ----
  const setFocusMinutes = useCallback((v: number) => {
    setFocusMinutesState(v);
    localStorage.setItem(LS_FOCUS, String(v));
  }, []);

  const setShortBreakMinutes = useCallback((v: number) => {
    setShortBreakMinutesState(v);
    localStorage.setItem(LS_SHORT, String(v));
  }, []);

  const setLongBreakMinutes = useCallback((v: number) => {
    setLongBreakMinutesState(v);
    localStorage.setItem(LS_LONG, String(v));
  }, []);

  const setAllowLongTimers = useCallback((v: boolean) => {
    setAllowLongTimersState(v);
    localStorage.setItem(LS_ALLOW_LONG, String(v));
  }, []);

  const setAutoStartBreaks = useCallback((v: boolean) => {
    setAutoStartBreaksState(v);
    localStorage.setItem(LS_AUTO_START, String(v));
  }, []);

  // ---- Subject management ----
  const addSubject = useCallback(async (name: string) => {
    try {
      await window.electronAPI.timer.addSubject(name);
      const data = await window.electronAPI.timer.getSubjects();
      setSubjects(data.map((s: any) => ({ id: s.id, name: s.name, is_hidden: s.is_hidden })));
    } catch (err) {
      console.error('[Timer] Add subject failed:', err);
    }
  }, []);

  const hideSubject = useCallback(async (name: string) => {
    try {
      await window.electronAPI.timer.hideSubject(name);
      setSubjects(prev => prev.map(s => s.name === name ? { ...s, is_hidden: true } : s));
    } catch (err) {
      console.error('[Timer] Hide subject failed:', err);
    }
  }, []);

  const deleteSubject = useCallback(async (name: string) => {
    try {
      await window.electronAPI.timer.deleteSubject(name);
      setSubjects(prev => prev.filter(s => s.name !== name));
    } catch (err) {
      console.error('[Timer] Delete subject failed:', err);
    }
  }, []);

  const selectSubject = useCallback((name: string) => {
    setSelectedSubject(name);
    localStorage.setItem(LS_SELECTED, name);
  }, []);

  // ---- Timer logic ----
  const clearInterval_ = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const saveSession = useCallback(async (subject: string, minutes: number) => {
    if (!subject || minutes <= 0) return;
    try {
      await window.electronAPI.timer.saveSession(subject, todayRef.current, minutes);
    } catch (err) {
      console.error('[Timer] Save session failed:', err);
    }
  }, []);

  const tick = useCallback(() => {
    setTimeLeft(prev => {
      if (prev <= 1) {
        // Timer finished
        clearInterval_();
        setIsRunning(false);
        setIsPaused(false);
        setPauseSeconds(0);

        // Save completed session
        if (currentPhase === 'focus') {
          const elapsedSeconds = (focusMinutes * 60) - prev;
          const minutes = elapsedSeconds / 60;
          saveSession(trackingSubjectRef.current, minutes);
        }

        // Switch phase
        const next = currentPhase === 'focus'
          ? (currentCycle % 4 === 0 ? 'long' as TimerPhase : 'short' as TimerPhase)
          : 'focus' as TimerPhase;

        setCurrentPhase(next);
        setTimeLeft(next === 'focus' ? focusMinutes * 60 : next === 'short' ? shortBreakMinutes * 60 : longBreakMinutes * 60);
        if (next === 'focus') setCurrentCycle(c => c + 1);

        if (autoStartBreaks) {
          setTimeout(() => {
            setIsRunning(true);
          }, 500);
        }

        return 0;
      }
      return prev - 1;
    });
  }, [currentPhase, focusMinutes, shortBreakMinutes, longBreakMinutes, currentCycle, autoStartBreaks, saveSession, clearInterval_]);

  const handleStart = useCallback(() => {
    if (!selectedSubject) return;
    trackingSubjectRef.current = selectedSubject;
    sessionStartRef.current = Date.now();
    setPauseSeconds(0);
    setIsRunning(true);
    setIsPaused(false);
    clearInterval_();
    intervalRef.current = setInterval(tick, 1000);
  }, [selectedSubject, tick, clearInterval_]);

  const handlePause = useCallback(() => {
    clearInterval_();
    setIsPaused(true);
    setPauseSeconds(prev => prev + 1);
  }, [clearInterval_]);

  const handleReset = useCallback(async () => {
    clearInterval_();
    setIsRunning(false);
    setIsPaused(false);

    // Save partial session if focus was in progress
    if (currentPhase === 'focus' && timeLeft > 0) {
      const elapsedSeconds = (focusMinutes * 60) - timeLeft;
      if (elapsedSeconds > 10) {
        await saveSession(trackingSubjectRef.current, elapsedSeconds / 60);
      }
    }

    setPauseSeconds(0);
    setTimeLeft(focusMinutes * 60);
    setCurrentPhase('focus');
  }, [currentPhase, focusMinutes, timeLeft, saveSession, clearInterval_]);

  const switchPhase = useCallback((phase: TimerPhase) => {
    clearInterval_();
    setIsRunning(false);
    setIsPaused(false);
    setPauseSeconds(0);
    setCurrentPhase(phase);
    setTimeLeft(
      phase === 'focus' ? focusMinutes * 60 :
      phase === 'short' ? shortBreakMinutes * 60 :
      longBreakMinutes * 60
    );
  }, [focusMinutes, shortBreakMinutes, longBreakMinutes, clearInterval_]);

  // ---- Update timeLeft when settings change ----
  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(
        currentPhase === 'focus' ? focusMinutes * 60 :
        currentPhase === 'short' ? shortBreakMinutes * 60 :
        longBreakMinutes * 60
      );
    }
  }, [focusMinutes, shortBreakMinutes, longBreakMinutes]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => clearInterval_();
  }, [clearInterval_]);

  // ---- Save end-of-day session on unmount ----
  useEffect(() => {
    return () => {
      if (isRunning && currentPhase === 'focus' && trackingSubjectRef.current) {
        const elapsedSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        if (elapsedSeconds > 10) {
          window.electronAPI.timer.saveSession(trackingSubjectRef.current, todayRef.current, elapsedSeconds / 60);
        }
      }
    };
  }, []);

  return {
    // Subjects
    subjects,
    selectedSubject,
    isLoading,
    selectSubject,
    addSubject,
    hideSubject,
    deleteSubject,

    // Settings
    focusMinutes, setFocusMinutes,
    shortBreakMinutes, setShortBreakMinutes,
    longBreakMinutes, setLongBreakMinutes,
    allowLongTimers, setAllowLongTimers,
    autoStartBreaks, setAutoStartBreaks,

    // Timer state
    timeLeft,
    currentPhase,
    isRunning,
    isPaused,
    pauseSeconds,
    currentCycle,
    phaseTotalSeconds,

    // Controls
    handleStart,
    handlePause,
    handleReset,
    switchPhase,
  };
}
