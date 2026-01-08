import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

type TimerPhase = "focus" | "short" | "long";
type Control = "start" | "pause" | "reset" | null;

const LS_FOCUS = "clarity_v2:focus_minutes";
const LS_SHORT = "clarity_v2:short_break_minutes";
const LS_LONG = "clarity_v2:long_break_minutes";
const LS_ALLOW_LONG = "clarity_v2:allow_long_timers";
const LS_AUTO_START = "clarity_v2:auto_start_breaks";
const LS_SELECTED_NAME = "clarity_v2:selected_subject";
const LS_HIDDEN_SUBJECTS = "clarity_v2:hidden_subjects";

const MAX_SUBJECTS = 20;

function safeLocalNumber(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function loadHiddenSubjects(): string[] {
  try {
    const raw = localStorage.getItem(LS_HIDDEN_SUBJECTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHiddenSubjects(names: string[]) {
  localStorage.setItem(LS_HIDDEN_SUBJECTS, JSON.stringify(names));
}

function getLocalDateString(date = new Date()): string {
  return date.toISOString().split("T")[0];
}

interface TimerContextType {
  subjects: string[];
  selectedSubject: string | null;
  hiddenSubjects: string[];
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  allowLongTimers: boolean;
  autoStartBreaks: boolean;
  currentPhase: TimerPhase;
  timeLeft: number;
  isRunning: boolean;
  activeControl: Control;
  currentCycle: number;
  error: string | null;
  isPaused: boolean;
  pauseSeconds: number;
  phaseTotalSeconds: number;
  
  setFocusMinutes: (m: number) => void;
  setShortBreakMinutes: (m: number) => void;
  setLongBreakMinutes: (m: number) => void;
  setAllowLongTimers: (allow: boolean) => void;
  setAutoStartBreaks: (auto: boolean) => void;
  
  handleStart: () => void;
  handlePause: () => void;
  handleReset: () => void;
  handleSwitchPhase: (phase: TimerPhase) => void;
  handleSubjectChange: (name: string) => void;
  handleAddSubject: (name: string) => void;
  handleHideSubject: (name: string) => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export function useTimerContext() {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimerContext must be used within a TimerProvider");
  }
  return context;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [hiddenSubjects, setHiddenSubjects] = useState<string[]>(() => loadHiddenSubjects());
  const [focusMinutes, setFocusMinutes] = useState<number>(() => safeLocalNumber(LS_FOCUS, 25));
  const [shortBreakMinutes, setShortBreakMinutes] = useState<number>(() => safeLocalNumber(LS_SHORT, 5));
  const [longBreakMinutes, setLongBreakMinutes] = useState<number>(() => safeLocalNumber(LS_LONG, 15));
  const [allowLongTimers, setAllowLongTimers] = useState<boolean>(() => localStorage.getItem(LS_ALLOW_LONG) !== "false");
  const [autoStartBreaks, setAutoStartBreaks] = useState<boolean>(() => localStorage.getItem(LS_AUTO_START) === "true");
  const [currentPhase, setCurrentPhase] = useState<TimerPhase>("focus");
  const [timeLeft, setTimeLeft] = useState<number>(Math.floor(focusMinutes * 60));
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeControl, setActiveControl] = useState<Control>(null);
  const [currentCycle, setCurrentCycle] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const focusStartRef = useRef<number | null>(null);
  const pauseStartRef = useRef<number | null>(null);
  const totalPausedSecondsRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const phaseTotalSecondsRef = useRef<number>(Math.floor(focusMinutes * 60));
  const targetTimeRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);
  const [pauseTick, setPauseTick] = useState<number>(0);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasManuallyStartedRef = useRef<boolean>(false);
  const focusSessionSubjectRef = useRef<string | null>(null);
  const lastSaveSecondRef = useRef<number>(0);

  const effectiveLongBreakMinutes = allowLongTimers ? longBreakMinutes : shortBreakMinutes;

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const allSubjects: string[] = await window.electronAPI.timerDb.getAllSubjects();
      setSubjects(allSubjects.map(s => s.toLowerCase()));

      const hidden = loadHiddenSubjects();
      setHiddenSubjects(hidden);

      const visibleSubjects = allSubjects.filter(s => !hidden.includes(s.toLowerCase()));

      const savedName = localStorage.getItem(LS_SELECTED_NAME);
      let chosen: string | null = null;

      if (savedName && visibleSubjects.map(s => s.toLowerCase()).includes(savedName)) {
        chosen = savedName;
      } else if (visibleSubjects.length > 0) {
        chosen = visibleSubjects[0].toLowerCase();
      }

      setSelectedSubject(chosen);
      if (chosen) {
        localStorage.setItem(LS_SELECTED_NAME, chosen);
      }
    } catch (err) {
      console.error("Failed to load subjects", err);
    }
  };

  // Update timer when settings change
  useEffect(() => {
    const isPaused = !!pauseStartRef.current;
    if (isRunning || isPaused) return;
    
    const total = Math.floor((currentPhase === "focus" ? focusMinutes : currentPhase === "short" ? shortBreakMinutes : effectiveLongBreakMinutes) * 60) || 1;
    // Only update timeLeft if it drastically changed or we are not running/paused, 
    // but the logic above implies we reset if settings change while idle.
    phaseTotalSecondsRef.current = total;
    setTimeLeft(total);
    
    localStorage.setItem(LS_FOCUS, String(focusMinutes));
    localStorage.setItem(LS_SHORT, String(shortBreakMinutes));
    localStorage.setItem(LS_LONG, String(longBreakMinutes));
    localStorage.setItem(LS_ALLOW_LONG, String(allowLongTimers));
    localStorage.setItem(LS_AUTO_START, String(autoStartBreaks));
  }, [focusMinutes, shortBreakMinutes, longBreakMinutes, effectiveLongBreakMinutes, currentPhase, allowLongTimers, autoStartBreaks, isRunning]);

  // Update tray icon state (if available)
  useEffect(() => {
    try {
      window.electronAPI?.setTrayState?.(isRunning ? "active" : "idle");
    } catch {}
  }, [isRunning]);

  // Auto-save focus time every minute
  const autoSaveFocusTime = async () => {
    const subject = focusSessionSubjectRef.current;
    if (currentPhase !== "focus" || !focusStartRef.current || !subject) return;

    const activeSeconds = Math.floor((Date.now() - focusStartRef.current) / 1000) - totalPausedSecondsRef.current;

    if (activeSeconds >= lastSaveSecondRef.current + 30) {
      const currentDate = getLocalDateString();
      try {
        // Save roughly every 30s as 0.5m? 
        // Or keep 1m but don't reset weirdly.
        // Actually, let's keep it saving 1m at a time for now to match backend integer expectations if they exist.
        // But `storage.ts` uses `number`. It doesn't force integer.
        // Let's verify `storage.ts`. It says `minutes: number`.
        // Ideally we save 0.5 minutes or more precise.
        // But existing data might be integer based.
        // Let's stick to 1m but ensure we don't lose the accumulated time on pause.
        // Wait, if I change to 30s updates, I need to send 0.5.
        // Let's stick to 60s for loop but improve the final save on reset/stop to capture the partial.
      } catch (err) {
         console.error("AutoSave failed", err);
      }
    }
    // Staying with 60s for now but removing this comment block in actual code.
    if (activeSeconds >= lastSaveSecondRef.current + 60) {
      const currentDate = getLocalDateString();
      try {
        await window.electronAPI.timerDb.addOrUpdateTimerData(subject, currentDate, 1);
        lastSaveSecondRef.current += 60;
        console.log(`[AutoSave] ✅ Saved 1m for "${subject}"`);
      } catch (err) {
        console.error("AutoSave failed", err);
      }
    }
  };

  useEffect(() => {
    if (isRunning && currentPhase === "focus" && focusSessionSubjectRef.current) {
      autoSaveIntervalRef.current = setInterval(() => {
        autoSaveFocusTime();
      }, 10000); 
    } else {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, [isRunning, currentPhase]);

  // Main timer tick
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    targetTimeRef.current = Date.now() + timeLeft * 1000;

    const tick = () => {
      const remaining = targetTimeRef.current ? Math.round((targetTimeRef.current - Date.now()) / 1000) : 0;
      setTimeLeft(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
        setIsRunning(false);
        setActiveControl(null);

        // Show notification
        try {
          window.electronAPI?.notify?.(
            currentPhase === "focus" ? "Pomodoro complete" : "Break ended",
            currentPhase === "focus" ? "Focus session finished." : "Time to focus!"
          );
          window.electronAPI?.playSound?.("click");
        } catch {}

        if (currentPhase === "focus") {
          setCurrentCycle((prev) => {
            const nextCycle = prev >= 4 ? (allowLongTimers ? 4 : 1) : prev + 1;
            setCurrentPhaseAndReset(nextCycle === 4 ? "long" : "short");
            return nextCycle;
          });
        } else {
          if (currentPhase === "long") {
            setCurrentCycle(1);
          }
          setCurrentPhaseAndReset("focus");
        }
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  // Pause tick for display
  const isPaused = !isRunning && !!pauseStartRef.current;
  useEffect(() => {
    let id: NodeJS.Timeout | null = null;
    if (isPaused) {
      id = setInterval(() => setPauseTick((p) => p + 1), 1000);
    }
    return () => {
      if (id) clearInterval(id);
    };
  }, [isPaused]);

  // Auto-start breaks
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (autoStartBreaks && !isRunning && !isPaused && hasManuallyStartedRef.current) {
      handleStart();
    }
  }, [currentPhase, autoStartBreaks, isPaused]);

  function setCurrentPhaseAndReset(phase: TimerPhase) {
    setError(null);
    const total = Math.floor((phase === "focus" ? focusMinutes : phase === "short" ? shortBreakMinutes : effectiveLongBreakMinutes) * 60) || 1;
    phaseTotalSecondsRef.current = total;
    setTimeLeft(total);
    pauseStartRef.current = null;
    setCurrentPhase(phase);
    setIsRunning(false);

    if (phase !== "focus") {
      // If we were in focus and are resetting/stopping, try to save partial time if > 30s?
      if (currentPhase === "focus" && focusSessionSubjectRef.current && focusStartRef.current) {
         const subject = focusSessionSubjectRef.current;
         const activeSeconds = Math.floor((Date.now() - focusStartRef.current) / 1000) - totalPausedSecondsRef.current;
         const unsavedSeconds = activeSeconds - lastSaveSecondRef.current;
         
         // If more than 30s unsaved, round up to 1m and save? 
         // Or just save as fraction? "number" supports floats.
         // Let's save precise fraction to be nicer. 0.5 mins etc.
         if (unsavedSeconds > 5) {
            const minutesToAdd = unsavedSeconds / 60;
            const currentDate = getLocalDateString();
             // We can't await here easily as this is synchronous state update, but we can fire and forget or use void
             window.electronAPI.timerDb.addOrUpdateTimerData(subject, currentDate, minutesToAdd)
                .catch(err => console.error("Final save failed", err));
         }
      }

      focusSessionSubjectRef.current = null;
      lastSaveSecondRef.current = 0;
    }
  }

  function handleStart() {
    setError(null);
    const isResuming = !!pauseStartRef.current;

    if (!selectedSubject && currentPhase === "focus") {
      setError("Please select a subject before starting.");
      return;
    }

    if (currentPhase === "focus") {
      if (!isResuming) {
        focusStartRef.current = Date.now();
        totalPausedSecondsRef.current = 0;
        lastSaveSecondRef.current = 0;
      }
      focusSessionSubjectRef.current = selectedSubject;
    }

    if (isResuming) {
      const pausedDuration = Math.floor((Date.now() - (pauseStartRef.current || Date.now())) / 1000);
      totalPausedSecondsRef.current += pausedDuration;
      pauseStartRef.current = null;
    }

    hasManuallyStartedRef.current = true;
    setActiveControl("start");
    setTimeout(() => setActiveControl(null), 300);
    setIsRunning(true);
    window.electronAPI?.playSound?.("click");
  }

  function handlePause() {
    if (!isRunning) return;

    setActiveControl("pause");
    setTimeout(() => setActiveControl(null), 300);
    setIsRunning(false);

    if (!pauseStartRef.current) {
      pauseStartRef.current = Date.now();
      // No rounding: pause exactly where we are
    }
    window.electronAPI?.playSound?.("click");
  }

  function handleReset() {
    setActiveControl("reset");
    setTimeout(() => setActiveControl(null), 300);
    setIsRunning(false);

    hasManuallyStartedRef.current = false;
    focusStartRef.current = null;
    focusSessionSubjectRef.current = null;
    lastSaveSecondRef.current = 0;

    setCurrentPhaseAndReset(currentPhase);
    window.electronAPI?.playSound?.("click");
  }

  function handleSwitchPhase(phase: TimerPhase) {
    if (isRunning) return;
    hasManuallyStartedRef.current = false;
    setCurrentPhaseAndReset(phase);
    window.electronAPI?.playSound?.("click");
  }

  function handleSubjectChange(displayName: string) {
    const isPaused = !isRunning && !!pauseStartRef.current;

    if (isRunning) {
      setError("Cannot change subject while timer is running. Pause first.");
      return;
    }

    const normalizedName = displayName.toLowerCase();
    if (subjects.includes(normalizedName)) {
      setSelectedSubject(normalizedName);

      if (isPaused && currentPhase === "focus") {
        focusSessionSubjectRef.current = normalizedName;
      }

      localStorage.setItem(LS_SELECTED_NAME, normalizedName);
    }
  }

  async function handleAddSubject(name: string) {
    if (isRunning) {
      setError("Cannot add subject while running. Pause first.");
      return;
    }

    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) {
      setError("Subject name cannot be empty");
      return;
    }

    const visibleSubjects = subjects.filter(s => !hiddenSubjects.includes(s));
    if (visibleSubjects.length >= MAX_SUBJECTS) {
      setError(`Max ${MAX_SUBJECTS} subjects. Hide some to add more.`);
      return;
    }

    await window.electronAPI.timerDb.addSubject(normalized);
    loadSubjects();
    setSelectedSubject(normalized);
    localStorage.setItem(LS_SELECTED_NAME, normalized);
  }

  function handleHideSubject(displayName: string) {
    if (isRunning) {
      setError("Cannot hide subject while running. Pause first.");
      return;
    }

    const subjectName = displayName.toLowerCase();
    if (!subjects.includes(subjectName)) return;

    const nextHidden = [...hiddenSubjects, subjectName];
    setHiddenSubjects(nextHidden);
    saveHiddenSubjects(nextHidden);

    const visibleSubjects = subjects.filter(s => !nextHidden.includes(s));
    const nextSelected = visibleSubjects.length > 0 ? visibleSubjects[0] : null;

    setSelectedSubject(nextSelected);
    if (nextSelected) {
      localStorage.setItem(LS_SELECTED_NAME, nextSelected);
    } else {
      localStorage.removeItem(LS_SELECTED_NAME);
    }
  }

  const computedPauseSeconds = (() => {
    let s = totalPausedSecondsRef.current;
    if (pauseStartRef.current) {
      s += Math.floor((Date.now() - pauseStartRef.current) / 1000);
    }
    void pauseTick;
    return s;
  })();

  const value: TimerContextType = {
    subjects,
    selectedSubject,
    hiddenSubjects,
    focusMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    allowLongTimers,
    autoStartBreaks,
    currentPhase,
    timeLeft,
    isRunning,
    activeControl,
    currentCycle,
    error,
    isPaused,
    pauseSeconds: computedPauseSeconds,
    phaseTotalSeconds: phaseTotalSecondsRef.current,
    
    setFocusMinutes,
    setShortBreakMinutes,
    setLongBreakMinutes,
    setAllowLongTimers,
    setAutoStartBreaks,
    
    handleStart,
    handlePause,
    handleReset,
    handleSwitchPhase,
    handleSubjectChange,
    handleAddSubject,
    handleHideSubject,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}
