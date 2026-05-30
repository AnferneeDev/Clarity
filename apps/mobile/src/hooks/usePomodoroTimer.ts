import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { getLocalDateString } from '@/lib/utils';
import { api } from '@/lib/api';
import { useTimerStore } from '@/lib/store';
import { getPreference, setPreference } from '@/lib/db';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

type TimerPhase = 'focus' | 'short' | 'long';

const PREF_FOCUS = 'clarity_v3:focus_minutes';
const PREF_SHORT = 'clarity_v3:short_break_minutes';
const PREF_LONG = 'clarity_v3:long_break_minutes';
const PREF_ALLOW_LONG = 'clarity_v3:allow_long_timers';
const PREF_AUTO_START = 'clarity_v3:auto_start_breaks';
const PREF_SELECTED = 'clarity_v3:selected_subject';

const PREF_SYNC_DEBOUNCE_MS = 2_000;

let soundInstance: any = null;

async function playSound() {
  try {
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

export function usePomodoroTimer() {
  const store = useTimerStore();

  const [focusMinutes, setFocusMinutesState] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutesState] = useState(5);
  const [longBreakMinutes, setLongBreakMinutesState] = useState(15);
  const [allowLongTimers, setAllowLongTimersState] = useState(true);
  const [autoStartBreaks, setAutoStartBreaksState] = useState(false);

  const [subjects, setSubjects] = useState<Array<{ id: string; name: string; is_hidden: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackingSubjectRef = useRef<string>('');
  const phaseEndRef = useRef(0);
  const scheduledNotificationIdRef = useRef<string | null>(null);

  const cancelTimerNotification = useCallback(async () => {
    if (scheduledNotificationIdRef.current) {
      const id = scheduledNotificationIdRef.current;
      scheduledNotificationIdRef.current = null;
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {}
    }
  }, []);

  const scheduleTimerNotification = useCallback(async (phase: TimerPhase, seconds: number) => {
    try {
      await cancelTimerNotification();
      if (seconds <= 0) return;
      const { status } = await Notifications.getPermissionsAsync();
      let finalStatus = status;
      if (finalStatus !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        finalStatus = newStatus;
      }
      if (finalStatus === 'granted') {
        scheduledNotificationIdRef.current = await Notifications.scheduleNotificationAsync({
          content: {
            title: phase === 'focus' ? 'Focus Session Complete' : 'Break Finished',
            body: phase === 'focus' ? 'Time for a break!' : 'Time to focus!',
            sound: true,
          },
          trigger: { seconds } as any,
        });
      }
    } catch {}
  }, [cancelTimerNotification]);

  const sendNotification = useCallback(async (title: string, body: string) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: null,
      });
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
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

        const [subjectsData, activeData] = await Promise.all([
          api.timer.getSubjects(),
          api.timer.getActiveTimer() as Promise<{ active: boolean; timer?: any }>
        ]);

        if (cancelled) return;

        const loadedSubjects = Array.isArray(subjectsData)
          ? subjectsData.map((s: any) => ({ id: s.id, name: s.name, is_hidden: s.is_hidden }))
          : [];
        setSubjects(loadedSubjects);

        if (activeData?.active && activeData.timer) {
          const t = activeData.timer;
          const elapsedSeconds = Math.floor((Date.now() - new Date(t.started_at).getTime()) / 1000);
          const remaining = Math.max(0, t.expected_duration_minutes * 60 - elapsedSeconds);
          
          store.setSelectedSubject(t.subject_name);
          store.setCurrentPhase(t.phase as TimerPhase);
          store.setTimeLeft(remaining);
          store.setIsRunning(true);
          store.setIsPaused(false);
          phaseEndRef.current = Date.now() + remaining * 1000;
          trackingSubjectRef.current = t.subject_name;

          scheduleTimerNotification(t.phase as TimerPhase, remaining);
        } else {
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
        }
      } catch (e) {
        console.error('Error in load():', e);
      } finally { 
        if (!cancelled) setIsLoading(false); 
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const persistPref = useCallback(async (key: string, value: string) => {
    await setPreference(key, value);
  }, []);

  const setFocusMinutes = useCallback((v: number) => {
    setFocusMinutesState(v);
    persistPref(PREF_FOCUS, String(v));
    syncPrefs({ focus_minutes: v });
    if (!store.isRunning && store.currentPhase === 'focus') store.setTimeLeft(v * 60);
  }, [store]);
  const setShortBreakMinutes = useCallback((v: number) => {
    setShortBreakMinutesState(v);
    persistPref(PREF_SHORT, String(v));
    syncPrefs({ short_break_minutes: v });
    if (!store.isRunning && store.currentPhase === 'short') store.setTimeLeft(v * 60);
  }, [store]);
  const setLongBreakMinutes = useCallback((v: number) => {
    setLongBreakMinutesState(v);
    persistPref(PREF_LONG, String(v));
    syncPrefs({ long_break_minutes: v });
    if (!store.isRunning && store.currentPhase === 'long') store.setTimeLeft(v * 60);
  }, [store]);
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
    try { await api.timer.hideSubject(name); } catch {}
  }, []);

  const deleteSubject = useCallback(async (name: string) => {
    setSubjects(prev => prev.filter(s => s.name !== name));
    try { await api.timer.deleteSubject(name); } catch {}
  }, []);

  const selectSubject = useCallback((name: string) => {
    store.setSelectedSubject(name);
    persistPref(PREF_SELECTED, name);
  }, [store, persistPref]);

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

    const finalizeSession = async () => {
      try {
        await api.timer.stopTimer();
      } catch (e) {
        console.error('Failed to stop timer on completion', e);
      }
    };
    finalizeSession();

    if (store.currentPhase === 'focus') {
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

    if (autoStartBreaks && store.selectedSubject) {
      setTimeout(async () => {
        try {
          await api.timer.startTimer(store.selectedSubject!, Math.ceil(newDuration / 60), nextPhase);
        } catch (e) {
          console.error('Failed to start break timer', e);
        }
        phaseEndRef.current = Date.now() + newDuration * 1000;
        store.setIsRunning(true);
        scheduleTimerNotification(nextPhase, newDuration);
      }, 500);
    }
  }, [store.timeLeft, store.isRunning, store.isPaused, store.currentPhase, store.currentCycle, focusMinutes, shortBreakMinutes, longBreakMinutes, autoStartBreaks, cancelTimerNotification, scheduleTimerNotification]);

  const handleStart = useCallback(async () => {
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

    const expectedDurationMinutes = Math.ceil(store.timeLeft / 60);

    try {
      await api.timer.startTimer(subject, expectedDurationMinutes, store.currentPhase);
    } catch (e) {
      console.error('Failed to start timer on backend', e);
    }

    trackingSubjectRef.current = subject;
    phaseEndRef.current = Date.now() + store.timeLeft * 1000;

    store.setIsRunning(true);
    store.setIsPaused(false);
    scheduleTimerNotification(store.currentPhase, store.timeLeft);
  }, [store, subjects, persistPref, scheduleTimerNotification]);

  const handlePause = useCallback(async () => {
    if (!store.isRunning) return;
    if (store.isPaused) {
      // Resume
      const expectedDurationMinutes = Math.ceil(store.timeLeft / 60);
      try {
        await api.timer.startTimer(store.selectedSubject!, expectedDurationMinutes, store.currentPhase);
      } catch (e) {
        console.error('Failed to resume timer on backend', e);
      }
      phaseEndRef.current = Date.now() + store.timeLeft * 1000;
      store.setIsPaused(false);
      scheduleTimerNotification(store.currentPhase, store.timeLeft);
      return;
    }
    // Pause
    try {
      await api.timer.stopTimer();
    } catch (e) {
      console.error('Failed to stop timer on backend', e);
    }
    store.setIsPaused(true);
    cancelTimerNotification();
  }, [store, cancelTimerNotification, scheduleTimerNotification]);

  const handleReset = useCallback(async () => {
    try {
      await api.timer.stopTimer();
    } catch (e) {
      console.error('Failed to stop timer on backend', e);
    }
    cancelTimerNotification();
    phaseEndRef.current = 0;
    store.setIsRunning(false);
    store.setIsPaused(false);
    store.setTimeLeft(focusMinutes * 60);
    store.setCurrentPhase('focus');
  }, [store, focusMinutes, cancelTimerNotification]);

  const switchPhase = useCallback(async (phase: TimerPhase) => {
    try {
      await api.timer.stopTimer();
    } catch (e) {
      console.error('Failed to stop timer on backend', e);
    }
    cancelTimerNotification();
    const duration = phase === 'focus' ? focusMinutes * 60 : phase === 'short' ? shortBreakMinutes * 60 : longBreakMinutes * 60;
    store.setIsRunning(false);
    store.setIsPaused(false);
    store.setCurrentPhase(phase);
    store.setTimeLeft(duration);
    phaseEndRef.current = 0;
  }, [store, focusMinutes, shortBreakMinutes, longBreakMinutes, cancelTimerNotification]);

  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
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
