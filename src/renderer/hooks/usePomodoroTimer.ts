import { useState, useEffect, useRef, useCallback } from 'react';
import { getLocalDateString } from '../lib/utils';

// ============================================
// Types
// ============================================
type TimerPhase = 'focus' | 'short' | 'long';

// ============================================
// LocalStorage keys (persist settings locally for instant load)
// ============================================
const LS_FOCUS = 'clarity_v3:focus_minutes';
const LS_SHORT = 'clarity_v3:short_break_minutes';
const LS_LONG = 'clarity_v3:long_break_minutes';
const LS_ALLOW_LONG = 'clarity_v3:allow_long_timers';
const LS_AUTO_START = 'clarity_v3:auto_start_breaks';
const LS_SELECTED = 'clarity_v3:selected_subject';

// ============================================
// Sound + Notification (HTML5 API, Electron-native)
// ============================================
let audioCache: HTMLAudioElement | null = null;

function playSound() {
  try {
    if (!audioCache) {
      audioCache = new Audio('/Click.wav');
      audioCache.volume = 0.4;
    }
    audioCache.currentTime = 0;
    audioCache.play().catch(() => { /* autoplay blocked */ });
  } catch { /* sound is optional */ }
}

function sendNotification(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, silent: false });
      window.electronAPI.app.log(`[NOTIFICATION] ✓ fired: "${title}" — "${body}"`);
    } else {
      window.electronAPI.app.log(`[NOTIFICATION] ✗ skipped (permission: ${Notification.permission})`);
    }
  } catch (e) {
    window.electronAPI.app.log(`[NOTIFICATION] ✗ error: ${e}`);
  }
}

function requestPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ============================================
// Auto-save intervals
// ============================================
const AUTO_SAVE_INTERVAL_MS = 10_000;    // check every 10s (altver pattern)
const DEFAULT_CHUNK_SECONDS = 60;        // save 1-minute chunks
const PREF_SYNC_DEBOUNCE_MS = 2_000;
const MIN_SAVE_SECONDS = 10;

function safeLocalNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch { return fallback; }
}

export function usePomodoroTimer() {
  // ---- Settings (local cache, synced to Supabase on change) ----
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

  // ---- Refs for tracking ----
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef<number>(0);
  const trackingSubjectRef = useRef<string>('');
  const todayRef = useRef(getLocalDateString());
  const lastSavedSecondsRef = useRef(0);     // last second index we saved at
  const totalPausedMsRef = useRef(0);         // total ms spent paused this session
  const pauseStartRef = useRef<number>(0);    // when current pause started

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
        if (!selectedSubject) {
          const visible = (data as Array<{ is_hidden: boolean; name: string }>).filter((s: any) => !s.is_hidden);
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

  // ---- Chunk-based save: sends 1-minute chunks every interval tick ----
  const saveChunk = useCallback(async () => {
    const subject = trackingSubjectRef.current;
    if (!subject) return;

    const now = Date.now();
    const activeMs = (now - sessionStartRef.current) - totalPausedMsRef.current;
    const activeSeconds = Math.floor(activeMs / 1000);

    if (activeSeconds >= lastSavedSecondsRef.current + DEFAULT_CHUNK_SECONDS) {
      try {
        await window.electronAPI.timer.saveSession(subject, todayRef.current, 1);
        lastSavedSecondsRef.current += DEFAULT_CHUNK_SECONDS;
        window.electronAPI.app.log(`[TIMER-LOG] 💾 Saved 1m (active: ${activeSeconds}s, total saved: ${lastSavedSecondsRef.current / 60}m)`);
      } catch (err) {
        window.electronAPI.app.log(`[TIMER-LOG] ❌ Save failed: ${err}`);
      }
    }
  }, []);

  // ---- Periodic auto-save during active focus ----
  useEffect(() => {
    if (isRunning && !isPaused && currentPhase === 'focus') {
      autoSaveRef.current = setInterval(() => {
        saveChunk();
      }, AUTO_SAVE_INTERVAL_MS);
    } else {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
        autoSaveRef.current = null;
      }
    }
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [isRunning, isPaused, currentPhase, saveChunk]);

  // ---- Flush remaining unsaved seconds on pause/stop/blur ----
  const flushUnsavedSeconds = useCallback(async () => {
    const subject = trackingSubjectRef.current;
    if (!subject) return;

    const now = Date.now();
    const activeMs = (now - sessionStartRef.current) - totalPausedMsRef.current;
    const activeSeconds = Math.floor(activeMs / 1000);
    const unsaved = activeSeconds - lastSavedSecondsRef.current;

    if (unsaved > 2) {
      const minutes = unsaved / 60;
      try {
        await window.electronAPI.timer.saveSession(subject, todayRef.current, minutes);
        lastSavedSecondsRef.current = activeSeconds;
        console.log(`[Timer] Flushed ${minutes.toFixed(2)}m for "${subject}"`);
      } catch (err) {
        console.error('[Timer] Flush failed:', err);
      }
    }
  }, []);

  // ---- Save on tab/window blur ----
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && isRunning && currentPhase === 'focus') {
        flushUnsavedSeconds();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isRunning, currentPhase, flushUnsavedSeconds]);

  // ---- Settings persist to localStorage (instant) ----
  const setFocusMinutes = useCallback((v: number) => {
    setFocusMinutesState(v);
    localStorage.setItem(LS_FOCUS, String(v));
    syncPrefs({ focus_minutes: v });
  }, []);

  const setShortBreakMinutes = useCallback((v: number) => {
    setShortBreakMinutesState(v);
    localStorage.setItem(LS_SHORT, String(v));
    syncPrefs({ short_break_minutes: v });
  }, []);

  const setLongBreakMinutes = useCallback((v: number) => {
    setLongBreakMinutesState(v);
    localStorage.setItem(LS_LONG, String(v));
    syncPrefs({ long_break_minutes: v });
  }, []);

  const setAllowLongTimers = useCallback((v: boolean) => {
    setAllowLongTimersState(v);
    localStorage.setItem(LS_ALLOW_LONG, String(v));
    syncPrefs({ allow_long_timers: v });
  }, []);

  const setAutoStartBreaks = useCallback((v: boolean) => {
    setAutoStartBreaksState(v);
    localStorage.setItem(LS_AUTO_START, String(v));
    syncPrefs({ auto_start_breaks: v });
  }, []);

  // Debounced preference sync to Supabase
  const syncPrefs = useCallback((updates: Record<string, unknown>) => {
    if (prefSyncRef.current) clearTimeout(prefSyncRef.current);
    prefSyncRef.current = setTimeout(async () => {
      try {
        await window.electronAPI.settings.updatePreferences(updates);
      } catch (err) {
        console.error('[Timer] Pref sync failed:', err);
      }
    }, PREF_SYNC_DEBOUNCE_MS);
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

  // ---- Timer countdown (useEffect-driven, no imperative setInterval) ----
  useEffect(() => {
    if (!isRunning || isPaused) return;

    window.electronAPI.app.log(`[TIMER-LOG] ⏱ countdown tick — timeLeft: ${timeLeft}`);

    const id = setTimeout(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Timer completed
          window.electronAPI.app.log(`[TIMER-LOG] ⏰ ${currentPhase} finished, switching phase`);

          if (currentPhase === 'focus') {
            const totalSeconds = focusMinutes * 60;
            const unsaved = totalSeconds - lastSavedSecondsRef.current;
            if (unsaved > 1 && trackingSubjectRef.current) {
              window.electronAPI.timer.saveSession(trackingSubjectRef.current, todayRef.current, unsaved / 60)
                .catch(err => console.error('[Timer] Final save failed:', err));
            }
            lastSavedSecondsRef.current = 0;

            sendNotification('Pomodoro complete', `Focus session finished. Time for a break!`);
            playSound();
          } else {
            sendNotification('Break over', currentPhase === 'long' ? 'Long break finished. Time to focus!' : 'Short break finished. Time to focus!');
            playSound();
          }

          const nextPhase: TimerPhase = currentPhase === 'focus'
            ? (currentCycle % 4 === 0 ? 'long' : 'short')
            : 'focus';

          setIsRunning(false);
          setIsPaused(false);
          setPauseSeconds(0);
          setCurrentPhase(nextPhase);
          if (nextPhase === 'focus') setCurrentCycle(c => c + 1);
          setTimeLeft(nextPhase === 'focus' ? focusMinutes * 60 : nextPhase === 'short' ? shortBreakMinutes * 60 : longBreakMinutes * 60);

          if (autoStartBreaks) {
            setTimeout(() => setIsRunning(true), 500);
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(id);
  }, [isRunning, isPaused, timeLeft, currentPhase, currentCycle, focusMinutes, shortBreakMinutes, longBreakMinutes, autoStartBreaks]);

  const handleStart = useCallback(() => {
    requestPermission();
    playSound();
    window.electronAPI.app.log(`[TIMER-LOG] handleStart() — isRunning: ${isRunning} isPaused: ${isPaused} subj: ${selectedSubject} phase: ${currentPhase}`);

    if (!selectedSubject) {
      window.electronAPI.app.log('[TIMER-LOG]   ❌ no subject');
      return;
    }

    if (isRunning && !isPaused) {
      window.electronAPI.app.log('[TIMER-LOG]   ⚠ already running');
      return;
    }

    const isResuming = pauseStartRef.current > 0;
    window.electronAPI.app.log(`[TIMER-LOG]   isResuming: ${isResuming}`);

    if (!isResuming) {
      trackingSubjectRef.current = selectedSubject;
      sessionStartRef.current = Date.now();
      lastSavedSecondsRef.current = 0;
      totalPausedMsRef.current = 0;
    } else {
      totalPausedMsRef.current += Date.now() - pauseStartRef.current;
    }

    pauseStartRef.current = 0;
    setPauseSeconds(0);
    setIsRunning(true);
    setIsPaused(false);
    window.electronAPI.app.log('[TIMER-LOG]   ✅ started');
  }, [selectedSubject, isRunning, isPaused, currentPhase]);

  const handlePause = useCallback(() => {
    playSound();
    window.electronAPI.app.log(`[TIMER-LOG] handlePause() — isRunning: ${isRunning} isPaused: ${isPaused}`);

    if (!isRunning) return;

    if (isPaused) {
      // Resume
      window.electronAPI.app.log('[TIMER-LOG]   ▶ resuming');
      totalPausedMsRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = 0;
      setPauseSeconds(0);
      setIsPaused(false);
      return;
    }

    // Pause
    window.electronAPI.app.log('[TIMER-LOG]   ⏸ pausing');
    pauseStartRef.current = Date.now();
    setIsPaused(true);

    if (currentPhase === 'focus') {
      flushUnsavedSeconds();
    }
  }, [isRunning, isPaused, currentPhase, flushUnsavedSeconds]);

  const handleReset = useCallback(async () => {
    playSound();
    window.electronAPI.app.log('[TIMER-LOG] 🔄 reset');

    // Save any remaining unsaved seconds
    if (currentPhase === 'focus') {
      await flushUnsavedSeconds();
    }

    lastSavedSecondsRef.current = 0;
    totalPausedMsRef.current = 0;
    pauseStartRef.current = 0;
    setPauseSeconds(0);
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(focusMinutes * 60);
    setCurrentPhase('focus');
  }, [currentPhase, focusMinutes, flushUnsavedSeconds]);

  const switchPhase = useCallback((phase: TimerPhase) => {
    playSound();
    window.electronAPI.app.log(`[TIMER-LOG] ↪ switchPhase → ${phase}`);

    if (currentPhase === 'focus' && (isRunning || isPaused)) {
      const now = Date.now();
      const activeMs = (now - sessionStartRef.current) - totalPausedMsRef.current;
      const activeSeconds = Math.floor(activeMs / 1000);
      const unsaved = activeSeconds - lastSavedSecondsRef.current;
      if (unsaved > MIN_SAVE_SECONDS && trackingSubjectRef.current) {
        window.electronAPI.timer.saveSession(trackingSubjectRef.current, todayRef.current, unsaved / 60)
          .catch(err => console.error('[Timer] Switch save failed:', err));
      }
    }

    setIsRunning(false);
    setIsPaused(false);
    lastSavedSecondsRef.current = 0;
    totalPausedMsRef.current = 0;
    pauseStartRef.current = 0;
    setPauseSeconds(0);
    setCurrentPhase(phase);
    setTimeLeft(
      phase === 'focus' ? focusMinutes * 60 :
      phase === 'short' ? shortBreakMinutes * 60 :
      longBreakMinutes * 60
    );
  }, [currentPhase, focusMinutes, shortBreakMinutes, longBreakMinutes, isRunning, isPaused]);

  // ---- Update timeLeft when settings change (idle only) ----
  useEffect(() => {
    if (!isRunning && !isPaused) {
      setTimeLeft(
        currentPhase === 'focus' ? focusMinutes * 60 :
        currentPhase === 'short' ? shortBreakMinutes * 60 :
        longBreakMinutes * 60
      );
    }
  }, [focusMinutes, shortBreakMinutes, longBreakMinutes]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      if (prefSyncRef.current) clearTimeout(prefSyncRef.current);

      // Final save on unmount
      if (isRunning && currentPhase === 'focus' && trackingSubjectRef.current) {
        const now = Date.now();
        const activeMs = (now - sessionStartRef.current) - totalPausedMsRef.current;
        const activeSeconds = Math.floor(activeMs / 1000);
        const unsaved = activeSeconds - lastSavedSecondsRef.current;
        if (unsaved > MIN_SAVE_SECONDS) {
          window.electronAPI.timer.saveSession(trackingSubjectRef.current, todayRef.current, unsaved / 60)
            .catch(err => console.error('[Timer] Unmount save failed:', err));
        }
      }
    };
  }, [isRunning, currentPhase]);

  // ---- Tray icon state ----
  useEffect(() => {
    try {
      window.electronAPI.app?.setTrayState?.(isRunning ? 'active' : 'idle');
    } catch { /* ignore if not available */ }
  }, [isRunning]);

  return {
    subjects, selectedSubject, isLoading,
    selectSubject, addSubject, hideSubject, deleteSubject,
    focusMinutes, setFocusMinutes,
    shortBreakMinutes, setShortBreakMinutes,
    longBreakMinutes, setLongBreakMinutes,
    allowLongTimers, setAllowLongTimers,
    autoStartBreaks, setAutoStartBreaks,
    timeLeft, currentPhase, isRunning, isPaused, pauseSeconds,
    currentCycle, phaseTotalSeconds,
    handleStart, handlePause, handleReset, switchPhase,
  };
}
