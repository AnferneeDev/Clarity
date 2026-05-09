import { useState, useEffect, useRef, useCallback } from 'react';
import { getLocalDateString } from '@/lib/utils';
import { api } from '@/lib/api';
import { useTimerStore } from '@/lib/store';

type TimerPhase = 'focus' | 'short' | 'long';

const LS_FOCUS = 'clarity_v3:focus_minutes';
const LS_SHORT = 'clarity_v3:short_break_minutes';
const LS_LONG = 'clarity_v3:long_break_minutes';
const LS_ALLOW_LONG = 'clarity_v3:allow_long_timers';
const LS_AUTO_START = 'clarity_v3:auto_start_breaks';
const LS_SELECTED = 'clarity_v3:selected_subject';

const AUTO_SAVE_INTERVAL_MS = 10_000;
const DEFAULT_CHUNK_SECONDS = 60;
const PREF_SYNC_DEBOUNCE_MS = 2_000;
const MIN_SAVE_SECONDS = 10;

function safeLocalNumber(key: string, fallback: number): number {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch { return fallback; }
}

function playSound() { /* No sound in web — can add Web Audio later */ }

export function usePomodoroTimer() {
  const store = useTimerStore();

  const [focusMinutes, setFocusMinutesState] = useState(() => safeLocalNumber(LS_FOCUS, 25));
  const [shortBreakMinutes, setShortBreakMinutesState] = useState(() => safeLocalNumber(LS_SHORT, 5));
  const [longBreakMinutes, setLongBreakMinutesState] = useState(() => safeLocalNumber(LS_LONG, 15));
  const [allowLongTimers, setAllowLongTimersState] = useState(() => typeof window !== 'undefined' && localStorage.getItem(LS_ALLOW_LONG) !== 'false');
  const [autoStartBreaks, setAutoStartBreaksState] = useState(() => typeof window !== 'undefined' && localStorage.getItem(LS_AUTO_START) === 'true');

  const [subjects, setSubjects] = useState<Array<{ id: string; name: string; is_hidden: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number>(0);
  const trackingSubjectRef = useRef<string>('');
  const todayRef = useRef(getLocalDateString());
  const lastSavedSecondsRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.timer.getSubjects();
        setSubjects(Array.isArray(data) ? data.map((s: any) => ({ id: s.id, name: s.name, is_hidden: s.is_hidden })) : []);
        const selected = typeof window !== 'undefined' ? localStorage.getItem(LS_SELECTED) : null;
        if (!store.selectedSubject && selected) store.setSelectedSubject(selected);
      } catch { /* offline / no API */ } finally { setIsLoading(false); }
    };
    load();
  }, []);

  const setFocusMinutes = useCallback((v: number) => {
    setFocusMinutesState(v);
    if (typeof window !== 'undefined') localStorage.setItem(LS_FOCUS, String(v));
  }, []);
  const setShortBreakMinutes = useCallback((v: number) => {
    setShortBreakMinutesState(v);
    if (typeof window !== 'undefined') localStorage.setItem(LS_SHORT, String(v));
  }, []);
  const setLongBreakMinutes = useCallback((v: number) => {
    setLongBreakMinutesState(v);
    if (typeof window !== 'undefined') localStorage.setItem(LS_LONG, String(v));
  }, []);
  const setAllowLongTimers = useCallback((v: boolean) => {
    setAllowLongTimersState(v);
    if (typeof window !== 'undefined') localStorage.setItem(LS_ALLOW_LONG, String(v));
  }, []);
  const setAutoStartBreaks = useCallback((v: boolean) => {
    setAutoStartBreaksState(v);
    if (typeof window !== 'undefined') localStorage.setItem(LS_AUTO_START, String(v));
  }, []);

  const syncPrefs = useCallback((updates: Record<string, unknown>) => {
    if (prefSyncRef.current) clearTimeout(prefSyncRef.current);
    prefSyncRef.current = setTimeout(async () => {
      try { await api.settings.updatePreferences(updates); } catch { /* best effort */ }
    }, PREF_SYNC_DEBOUNCE_MS);
  }, []);

  const addSubject = useCallback(async (name: string) => {
    try { await api.timer.addSubject(name); } catch { /* offline */ }
    setSubjects(prev => {
      if (!prev.some(s => s.name === name.toLowerCase())) {
        return [...prev, { id: String(Date.now()), name: name.toLowerCase(), is_hidden: false }];
      }
      return prev;
    });
  }, []);

  const hideSubject = useCallback(async (name: string) => {
    setSubjects(prev => prev.map(s => s.name === name ? { ...s, is_hidden: true } : s));
  }, []);

  const deleteSubject = useCallback(async (name: string) => {
    setSubjects(prev => prev.filter(s => s.name !== name));
  }, []);

  const selectSubject = useCallback((name: string) => {
    store.setSelectedSubject(name);
    if (typeof window !== 'undefined') localStorage.setItem(LS_SELECTED, name);
  }, [store]);

  // Chunk save helper
  const saveChunk = useCallback(async () => {
    const subject = trackingSubjectRef.current;
    if (!subject) return;
    const activeMs = Date.now() - sessionStartRef.current;
    const activeSeconds = Math.floor(activeMs / 1000);
    if (activeSeconds >= lastSavedSecondsRef.current + DEFAULT_CHUNK_SECONDS) {
      try { await api.timer.saveSession(subject, todayRef.current, 1); } catch { }
      lastSavedSecondsRef.current += DEFAULT_CHUNK_SECONDS;
    }
  }, []);

  // Flush remaining on pause/stop
  const flushUnsaved = useCallback(async () => {
    const subject = trackingSubjectRef.current;
    if (!subject) return;
    const activeSeconds = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    const unsaved = activeSeconds - lastSavedSecondsRef.current;
    if (unsaved > 2) {
      try { await api.timer.saveSession(subject, todayRef.current, unsaved / 60); } catch { }
      lastSavedSecondsRef.current = activeSeconds;
    }
  }, []);

  // Auto-save interval
  useEffect(() => {
    if (store.isRunning && !store.isPaused && store.currentPhase === 'focus') {
      autoSaveRef.current = setInterval(saveChunk, AUTO_SAVE_INTERVAL_MS);
    } else {
      if (autoSaveRef.current) { clearInterval(autoSaveRef.current); autoSaveRef.current = null; }
    }
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [store.isRunning, store.isPaused, store.currentPhase, saveChunk]);

  // Countdown tick
  useEffect(() => {
    if (!store.isRunning || store.isPaused) return;
    const id = setTimeout(() => store.setTimeLeft(Math.max(0, store.timeLeft - 1)), 1000);
    return () => clearTimeout(id);
  }, [store.isRunning, store.isPaused, store.timeLeft]);

  // Timer completion
  useEffect(() => {
    if (!store.isRunning || store.isPaused || store.timeLeft > 0) return;

    if (store.currentPhase === 'focus') {
      const totalSeconds = focusMinutes * 60;
      const unsaved = totalSeconds - lastSavedSecondsRef.current;
      if (unsaved > 1 && trackingSubjectRef.current) {
        api.timer.saveSession(trackingSubjectRef.current, todayRef.current, unsaved / 60).catch(() => {});
      }
      lastSavedSecondsRef.current = 0;
    }

    const nextPhase: TimerPhase = store.currentPhase === 'focus'
      ? (store.currentCycle % 4 === 0 ? 'long' : 'short')
      : 'focus';

    const newDuration = nextPhase === 'focus' ? focusMinutes * 60
      : nextPhase === 'short' ? shortBreakMinutes * 60
      : longBreakMinutes * 60;

    store.setIsRunning(false);
    store.setIsPaused(false);
    store.setCurrentPhase(nextPhase);
    if (nextPhase === 'focus') store.setCurrentCycle(store.currentCycle + 1);
    store.setTimeLeft(newDuration);

    if (autoStartBreaks) setTimeout(() => store.setIsRunning(true), 500);
  }, [store.timeLeft, store.isRunning, store.isPaused, store.currentPhase, store.currentCycle, focusMinutes, shortBreakMinutes, longBreakMinutes, autoStartBreaks]);

  const handleStart = useCallback(() => {
    if (!store.selectedSubject) return;
    trackingSubjectRef.current = store.selectedSubject;
    sessionStartRef.current = Date.now();
    lastSavedSecondsRef.current = 0;
    store.setIsRunning(true);
    store.setIsPaused(false);
  }, [store]);

  const handlePause = useCallback(() => {
    if (!store.isRunning) return;
    if (store.isPaused) {
      store.setIsPaused(false);
      return;
    }
    store.setIsPaused(true);
    if (store.currentPhase === 'focus') flushUnsaved();
  }, [store, flushUnsaved]);

  const handleReset = useCallback(async () => {
    await flushUnsaved();
    lastSavedSecondsRef.current = 0;
    store.setIsRunning(false);
    store.setIsPaused(false);
    store.setTimeLeft(focusMinutes * 60);
    store.setCurrentPhase('focus');
  }, [store, focusMinutes, flushUnsaved]);

  const switchPhase = useCallback((phase: TimerPhase) => {
    if (store.currentPhase === 'focus') flushUnsaved();
    const duration = phase === 'focus' ? focusMinutes * 60 : phase === 'short' ? shortBreakMinutes * 60 : longBreakMinutes * 60;
    store.setIsRunning(false);
    store.setIsPaused(false);
    store.setCurrentPhase(phase);
    store.setTimeLeft(duration);
    lastSavedSecondsRef.current = 0;
  }, [store, focusMinutes, shortBreakMinutes, longBreakMinutes, flushUnsaved]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (store.isRunning && store.currentPhase === 'focus') flushUnsaved();
  }, []);

  return {
    subjects, selectedSubject: store.selectedSubject, isLoading,
    focusMinutes, shortBreakMinutes, longBreakMinutes,
    allowLongTimers, autoStartBreaks,
    timeLeft: store.timeLeft, currentPhase: store.currentPhase,
    isRunning: store.isRunning, isPaused: store.isPaused,
    currentCycle: store.currentCycle, phaseTotalSeconds: store.currentPhase === 'focus' ? focusMinutes * 60 : store.currentPhase === 'short' ? shortBreakMinutes * 60 : longBreakMinutes * 60,
    selectSubject, addSubject, hideSubject, deleteSubject,
    setFocusMinutes, setShortBreakMinutes, setLongBreakMinutes,
    setAllowLongTimers, setAutoStartBreaks,
    handleStart, handlePause, handleReset, switchPhase,
  };
}
