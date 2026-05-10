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

let audioCache: HTMLAudioElement | null = null;
function playSound() {
  try {
    if (!audioCache) {
      audioCache = new Audio('/Click.wav');
      audioCache.volume = 0.4;
    }
    audioCache.currentTime = 0;
    audioCache.play().catch(() => {});
  } catch {}
}

const NOTIFY_PERMISSION_KEY = 'clarity:notify_permission_requested';
function sendNotification(title: string, body: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[Notify] Notifications not supported in this browser');
    return;
  }
  console.log('[Notify] permission:', Notification.permission);
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
    console.log('[Notify] fired:', title);
  } else {
    console.warn('[Notify] permission not granted, cannot fire:', title);
  }
}

function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
    try { localStorage.setItem(NOTIFY_PERMISSION_KEY, '1'); } catch {}
  }
}

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
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number>(0);
  const trackingSubjectRef = useRef<string>('');
  const todayRef = useRef(getLocalDateString());
  const lastSavedSecondsRef = useRef(0);
  const totalPausedMsRef = useRef(0);
  const pauseStartRef = useRef(0);
  const phaseEndRef = useRef(0);

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
    const activeMs = (Date.now() - sessionStartRef.current) - totalPausedMsRef.current;
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
    const activeMs = (Date.now() - sessionStartRef.current) - totalPausedMsRef.current;
    const activeSeconds = Math.floor(activeMs / 1000);
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

  // Wall-clock countdown (accurate even when tab is backgrounded)
  useEffect(() => {
    if (!store.isRunning || store.isPaused) {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((phaseEndRef.current - Date.now()) / 1000));
      if (remaining !== store.timeLeft) {
        console.log('[Timer] countdown tick: timeLeft', store.timeLeft, '→', remaining, '| phaseEnd:', phaseEndRef.current, 'now:', Date.now());
      }
      store.setTimeLeft(remaining);
    }, 250);
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  }, [store.isRunning, store.isPaused, store.timeLeft]);

  // Timer completion
  useEffect(() => {
    if (!store.isRunning || store.isPaused) return;
    const timerExpired = store.timeLeft <= 0 || (phaseEndRef.current > 0 && Date.now() >= phaseEndRef.current);
    if (!timerExpired) return;

    console.log('[Timer] Phase completed! phase:', store.currentPhase, 'timeLeft:', store.timeLeft);

    if (store.currentPhase === 'focus') {
      flushUnsaved();
      lastSavedSecondsRef.current = 0;
      sendNotification('Pomodoro complete', 'Focus session finished. Time for a break!');
      playSound();
      console.log('[Timer] Focus complete — notification + sound fired');
    } else {
      sendNotification('Break over', store.currentPhase === 'long' ? 'Long break finished. Time to focus!' : 'Short break finished. Time to focus!');
      playSound();
      console.log('[Timer] Break complete — notification + sound fired');
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

    if (autoStartBreaks) setTimeout(() => {
      phaseEndRef.current = Date.now() + newDuration * 1000;
      store.setIsRunning(true);
    }, 500);
  }, [store.timeLeft, store.isRunning, store.isPaused, store.currentPhase, store.currentCycle, focusMinutes, shortBreakMinutes, longBreakMinutes, autoStartBreaks, flushUnsaved, store]);

  const handleStart = useCallback(() => {
    if (!store.selectedSubject) return;
    requestNotificationPermission();

    const isResuming = pauseStartRef.current > 0;
    if (!isResuming) {
      trackingSubjectRef.current = store.selectedSubject;
      sessionStartRef.current = Date.now();
      lastSavedSecondsRef.current = 0;
      totalPausedMsRef.current = 0;
      phaseEndRef.current = Date.now() + store.timeLeft * 1000;
    } else {
      totalPausedMsRef.current += Date.now() - pauseStartRef.current;
      phaseEndRef.current += Date.now() - pauseStartRef.current;
    }
    pauseStartRef.current = 0;

    store.setIsRunning(true);
    store.setIsPaused(false);
  }, [store]);

  const handlePause = useCallback(() => {
    if (!store.isRunning) return;
    if (store.isPaused) {
      totalPausedMsRef.current += Date.now() - pauseStartRef.current;
      phaseEndRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = 0;
      store.setIsPaused(false);
      return;
    }
    pauseStartRef.current = Date.now();
    store.setIsPaused(true);
    if (store.currentPhase === 'focus') flushUnsaved();
  }, [store, flushUnsaved]);

  const handleReset = useCallback(async () => {
    await flushUnsaved();
    lastSavedSecondsRef.current = 0;
    totalPausedMsRef.current = 0;
    pauseStartRef.current = 0;
    phaseEndRef.current = 0;
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
    totalPausedMsRef.current = 0;
    pauseStartRef.current = 0;
    phaseEndRef.current = 0;
  }, [store, focusMinutes, shortBreakMinutes, longBreakMinutes, flushUnsaved]);

  // Save on tab/window blur
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && store.isRunning && store.currentPhase === 'focus') {
        flushUnsaved();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [store.isRunning, store.currentPhase, flushUnsaved]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
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
