import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { getLocalDateString } from '@/lib/utils';
import { api } from '@/lib/api';
import { useTimerStore } from '@/lib/store';
import { upsertSession } from '@/lib/db';

type TimerPhase = 'focus' | 'short' | 'long';

const PREF_FOCUS = 'clarity_v3:focus_minutes';
const PREF_SHORT = 'clarity_v3:short_break_minutes';
const PREF_LONG = 'clarity_v3:long_break_minutes';
const PREF_ALLOW_LONG = 'clarity_v3:allow_long_timers';
const PREF_AUTO_START = 'clarity_v3:auto_start_breaks';
const PREF_SELECTED = 'clarity_v3:selected_subject';

const AUTO_SAVE_INTERVAL_MS = 10_000;
const DEFAULT_CHUNK_SECONDS = 60;
const PREF_SYNC_DEBOUNCE_MS = 2_000;

let soundInstance: any = null;

async function playSound() {
  try {
    const { Audio } = await import('expo-av');
    if (!soundInstance) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://claritytracker.online/Click.wav' },
        { volume: 0.4 }
      );
      soundInstance = sound;
    }
    await soundInstance.setPositionAsync(0);
    await soundInstance.playAsync();
  } catch {}
}

async function sendNotification(title: string, body: string) {
  try {
    const { getPermissionsAsync, requestPermissionsAsync, scheduleNotificationAsync } = await import('expo-notifications');
    const { status } = await getPermissionsAsync();
    let finalStatus = status;
    if (finalStatus !== 'granted') {
      const { status: newStatus } = await requestPermissionsAsync();
      finalStatus = newStatus;
    }
    if (finalStatus === 'granted') {
      await scheduleNotificationAsync({
        content: { title, body },
        trigger: null,
      });
    }
  } catch {}
}

export function usePomodoroTimer(userId: string | null) {
  const store = useTimerStore();

  const [focusMinutes, setFocusMinutesState] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutesState] = useState(5);
  const [longBreakMinutes, setLongBreakMinutesState] = useState(15);
  const [allowLongTimers, setAllowLongTimersState] = useState(true);
  const [autoStartBreaks, setAutoStartBreaksState] = useState(false);

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
  const scheduledNotificationIdRef = useRef<string | null>(null);

  const cancelTimerNotification = useCallback(async () => {
    if (scheduledNotificationIdRef.current) {
      const id = scheduledNotificationIdRef.current;
      scheduledNotificationIdRef.current = null;
      try {
        const { cancelScheduledNotificationAsync } = await import('expo-notifications');
        await cancelScheduledNotificationAsync(id);
      } catch {}
    }
  }, []);

  const scheduleTimerNotification = useCallback(async (phase: TimerPhase, seconds: number) => {
    try {
      await cancelTimerNotification();
      if (seconds <= 0) return;
      const { getPermissionsAsync, requestPermissionsAsync, scheduleNotificationAsync } = await import('expo-notifications');
      const { status } = await getPermissionsAsync();
      let finalStatus = status;
      if (finalStatus !== 'granted') {
        const { status: newStatus } = await requestPermissionsAsync();
        finalStatus = newStatus;
      }
      if (finalStatus === 'granted') {
        scheduledNotificationIdRef.current = await scheduleNotificationAsync({
          content: {
            title: phase === 'focus' ? 'Focus Session Complete' : 'Break Finished',
            body: phase === 'focus' ? 'Time for a break!' : 'Time to focus!',
            sound: true,
          },
          trigger: { seconds },
        });
      }
    } catch {}
  }, [cancelTimerNotification]);

  useEffect(() => {
    const load = async () => {
      try {
        const { getPreference } = await import('@/lib/db');
        const f = await getPreference(PREF_FOCUS, '25');
        const s = await getPreference(PREF_SHORT, '5');
        const l = await getPreference(PREF_LONG, '15');
        const al = await getPreference(PREF_ALLOW_LONG, 'true');
        const as = await getPreference(PREF_AUTO_START, 'false');
        const sel = await getPreference(PREF_SELECTED, '');

        setFocusMinutesState(Number(f) || 25);
        setShortBreakMinutesState(Number(s) || 5);
        setLongBreakMinutesState(Number(l) || 15);
        setAllowLongTimersState(al !== 'false');
        setAutoStartBreaksState(as === 'true');

        const data = await api.timer.getSubjects();
        const loadedSubjects = Array.isArray(data)
          ? data.map((s: any) => ({ id: s.id, name: s.name, is_hidden: s.is_hidden }))
          : [];
        setSubjects(loadedSubjects);

        if (!store.selectedSubject) {
          if (sel) {
            store.setSelectedSubject(sel);
          } else {
            const firstVisible = loadedSubjects.find(sub => !sub.is_hidden);
            if (firstVisible) {
              store.setSelectedSubject(firstVisible.name);
            }
          }
        }
      } catch {} finally { setIsLoading(false); }
    };
    load();
  }, []);

  const persistPref = useCallback(async (key: string, value: string) => {
    const { setPreference } = await import('@/lib/db');
    await setPreference(key, value);
  }, []);

  const setFocusMinutes = useCallback((v: number) => {
    setFocusMinutesState(v);
    persistPref(PREF_FOCUS, String(v));
    syncPrefs({ focus_minutes: v });
  }, []);
  const setShortBreakMinutes = useCallback((v: number) => {
    setShortBreakMinutesState(v);
    persistPref(PREF_SHORT, String(v));
    syncPrefs({ short_break_minutes: v });
  }, []);
  const setLongBreakMinutes = useCallback((v: number) => {
    setLongBreakMinutesState(v);
    persistPref(PREF_LONG, String(v));
    syncPrefs({ long_break_minutes: v });
  }, []);
  const setAllowLongTimers = useCallback((v: boolean) => {
    setAllowLongTimersState(v);
    persistPref(PREF_ALLOW_LONG, String(v));
    syncPrefs({ allow_long_timers: v });
  }, []);
  const setAutoStartBreaks = useCallback((v: boolean) => {
    setAutoStartBreaksState(v);
    persistPref(PREF_AUTO_START, String(v));
    syncPrefs({ auto_start_breaks: v });
  }, []);

  const syncPrefs = useCallback((updates: Record<string, unknown>) => {
    if (prefSyncRef.current) clearTimeout(prefSyncRef.current);
    prefSyncRef.current = setTimeout(async () => {
      try { await api.settings.updatePreferences(updates); } catch {}
    }, PREF_SYNC_DEBOUNCE_MS);
  }, []);

  const addSubject = useCallback(async (name: string) => {
    const formattedName = name.toLowerCase().trim();
    try { await api.timer.addSubject(formattedName); } catch {}
    setSubjects(prev => {
      if (!prev.some(s => s.name === formattedName)) {
        return [...prev, { id: String(Date.now()), name: formattedName, is_hidden: false }];
      }
      return prev;
    });
    if (!store.selectedSubject) {
      store.setSelectedSubject(formattedName);
      persistPref(PREF_SELECTED, formattedName);
    }
  }, [store.selectedSubject, persistPref]);

  const hideSubject = useCallback(async (name: string) => {
    setSubjects(prev => prev.map(s => s.name === name ? { ...s, is_hidden: true } : s));
  }, []);

  const deleteSubject = useCallback(async (name: string) => {
    setSubjects(prev => prev.filter(s => s.name !== name));
  }, []);

  const selectSubject = useCallback((name: string) => {
    store.setSelectedSubject(name);
    persistPref(PREF_SELECTED, name);
  }, [store, persistPref]);

  const saveChunk = useCallback(async () => {
    const subject = trackingSubjectRef.current;
    if (!subject || !userId) return;
    const activeMs = (Date.now() - sessionStartRef.current) - totalPausedMsRef.current;
    const activeSeconds = Math.floor(activeMs / 1000);
    if (activeSeconds >= lastSavedSecondsRef.current + DEFAULT_CHUNK_SECONDS) {
      await upsertSession(userId, subject, todayRef.current, 1);
      lastSavedSecondsRef.current += DEFAULT_CHUNK_SECONDS;
    }
  }, [userId]);

  const flushUnsaved = useCallback(async () => {
    const subject = trackingSubjectRef.current;
    if (!subject || !userId) return;
    let endMs = Date.now();
    if (phaseEndRef.current > 0 && endMs > phaseEndRef.current) {
      endMs = phaseEndRef.current;
    }
    const activeMs = (endMs - sessionStartRef.current) - totalPausedMsRef.current;
    const activeSeconds = Math.max(0, Math.floor(activeMs / 1000));
    const unsaved = activeSeconds - lastSavedSecondsRef.current;
    if (unsaved > 2) {
      await upsertSession(userId, subject, todayRef.current, unsaved / 60);
      lastSavedSecondsRef.current = activeSeconds;
    }
  }, [userId]);

  useEffect(() => {
    if (store.isRunning && !store.isPaused && store.currentPhase === 'focus') {
      autoSaveRef.current = setInterval(saveChunk, AUTO_SAVE_INTERVAL_MS);
    } else {
      if (autoSaveRef.current) { clearInterval(autoSaveRef.current); autoSaveRef.current = null; }
    }
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [store.isRunning, store.isPaused, store.currentPhase, saveChunk]);

  useEffect(() => {
    if (!store.isRunning || store.isPaused) {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((phaseEndRef.current - Date.now()) / 1000));
      store.setTimeLeft(remaining);
    }, 250);
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  }, [store.isRunning, store.isPaused]);

  useEffect(() => {
    if (!store.isRunning || store.isPaused) return;
    const timerExpired = store.timeLeft <= 0 || (phaseEndRef.current > 0 && Date.now() >= phaseEndRef.current);
    if (!timerExpired) return;

    cancelTimerNotification();

    if (store.currentPhase === 'focus') {
      flushUnsaved();
      lastSavedSecondsRef.current = 0;
      sendNotification('Pomodoro complete', 'Focus session finished. Time for a break!');
      playSound();
    } else {
      sendNotification('Break over', store.currentPhase === 'long' ? 'Long break finished. Time to focus!' : 'Short break finished. Time to focus!');
      playSound();
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
      scheduleTimerNotification(nextPhase, newDuration);
    }, 500);
  }, [store.timeLeft, store.isRunning, store.isPaused, store.currentPhase, store.currentCycle, focusMinutes, shortBreakMinutes, longBreakMinutes, autoStartBreaks, flushUnsaved, cancelTimerNotification, scheduleTimerNotification]);

  const handleStart = useCallback(() => {
    let subject = store.selectedSubject;
    if (!subject) {
      const firstVisible = subjects.find(s => !s.is_hidden);
      if (firstVisible) {
        subject = firstVisible.name;
        store.setSelectedSubject(subject);
        persistPref(PREF_SELECTED, subject);
      } else {
        Alert.alert('No Subject Selected', 'Please add or select a subject to start the timer.');
        return;
      }
    }

    const isResuming = pauseStartRef.current > 0;
    if (!isResuming) {
      trackingSubjectRef.current = subject;
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
    scheduleTimerNotification(store.currentPhase, store.timeLeft);
  }, [store, subjects, persistPref, scheduleTimerNotification]);

  const handlePause = useCallback(() => {
    if (!store.isRunning) return;
    if (store.isPaused) {
      totalPausedMsRef.current += Date.now() - pauseStartRef.current;
      phaseEndRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = 0;
      store.setIsPaused(false);
      scheduleTimerNotification(store.currentPhase, store.timeLeft);
      return;
    }
    pauseStartRef.current = Date.now();
    store.setIsPaused(true);
    if (store.currentPhase === 'focus') flushUnsaved();
    cancelTimerNotification();
  }, [store, flushUnsaved, cancelTimerNotification, scheduleTimerNotification]);

  const handleReset = useCallback(async () => {
    await flushUnsaved();
    cancelTimerNotification();
    lastSavedSecondsRef.current = 0;
    totalPausedMsRef.current = 0;
    pauseStartRef.current = 0;
    phaseEndRef.current = 0;
    store.setIsRunning(false);
    store.setIsPaused(false);
    store.setTimeLeft(focusMinutes * 60);
    store.setCurrentPhase('focus');
  }, [store, focusMinutes, flushUnsaved, cancelTimerNotification]);

  const switchPhase = useCallback((phase: TimerPhase) => {
    if (store.currentPhase === 'focus') flushUnsaved();
    cancelTimerNotification();
    const duration = phase === 'focus' ? focusMinutes * 60 : phase === 'short' ? shortBreakMinutes * 60 : longBreakMinutes * 60;
    store.setIsRunning(false);
    store.setIsPaused(false);
    store.setCurrentPhase(phase);
    store.setTimeLeft(duration);
    lastSavedSecondsRef.current = 0;
    totalPausedMsRef.current = 0;
    pauseStartRef.current = 0;
    phaseEndRef.current = 0;
  }, [store, focusMinutes, shortBreakMinutes, longBreakMinutes, flushUnsaved, cancelTimerNotification]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active' && store.isRunning && store.currentPhase === 'focus') {
        flushUnsaved();
      }
    });
    return () => sub.remove();
  }, [store.isRunning, store.currentPhase, flushUnsaved]);

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
    currentCycle: store.currentCycle,
    phaseTotalSeconds: store.currentPhase === 'focus' ? focusMinutes * 60 : store.currentPhase === 'short' ? shortBreakMinutes * 60 : longBreakMinutes * 60,
    selectSubject, addSubject, hideSubject, deleteSubject,
    setFocusMinutes, setShortBreakMinutes, setLongBreakMinutes,
    setAllowLongTimers, setAutoStartBreaks,
    handleStart, handlePause, handleReset, switchPhase,
  };
}
