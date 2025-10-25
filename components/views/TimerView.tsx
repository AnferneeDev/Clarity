import React, { useEffect, useRef, useState } from "react";
import SetupCard from "../SetupCard";
import TimerCard from "../TimerCard";
import { localDateString } from "../../src/timeUtils";

type TimerPhase = "focus" | "short" | "long";
type Control = "start" | "pause" | "reset" | null;

const LS_FOCUS = "pomodoro:focus_minutes";
const LS_SHORT = "pomodoro:short_break_minutes";
const LS_LONG = "pomodoro:long_break_minutes";
const LS_ALLOW_LONG = "pomodoro:allow_long_timers";
const LS_AUTO_START = "pomodoro:auto_start_breaks";
const LS_SELECTED_NAME = "pomodoro:selected_subject_name";
const LS_HIDDEN_SUBJECTS = "pomodoro:hidden_subjects";

const MAX_SUBJECTS = 6;

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
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveHiddenSubjects(ids: string[]) {
  try {
    localStorage.setItem(LS_HIDDEN_SUBJECTS, JSON.stringify(ids));
  } catch (err) {
    console.error("[Storage] Failed to save hidden subjects:", err);
  }
}

function formatSubjectName(subject: string): string {
  if (!subject) return "";
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

export default function TimerView() {
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
    console.log("[TimerView] Initializing component");
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      console.log("[TimerView] Loading subjects from timerDb");
      const allSubjects = await window.electronAPI.timerDb.getAllSubjects();
      console.log(`[TimerView] Loaded ${allSubjects.length} subjects:`, allSubjects);
      setSubjects(allSubjects);

      const hidden = loadHiddenSubjects();
      setHiddenSubjects(hidden);

      const visibleSubjects = allSubjects.filter((subject) => !hidden.includes(subject));

      const savedName = localStorage.getItem(LS_SELECTED_NAME);
      let chosen: string | null = null;

      if (savedName && visibleSubjects.includes(savedName)) {
        chosen = savedName;
      } else if (visibleSubjects.length > 0) {
        chosen = visibleSubjects[0];
      }

      setSelectedSubject(chosen);
      if (chosen) {
        localStorage.setItem(LS_SELECTED_NAME, chosen);
        console.log(`[TimerView] Selected subject: "${chosen}"`);
      }
    } catch (err) {
      console.error("[TimerView][Init] Failed to load subjects:", err);
      setError(`Failed to load subjects: ${String(err)}`);
    }
  };

  useEffect(() => {
    const isPaused = !!pauseStartRef.current;
    if (isRunning || isPaused) return;
    const total = Math.floor((currentPhase === "focus" ? focusMinutes : currentPhase === "short" ? shortBreakMinutes : effectiveLongBreakMinutes) * 60) || 1;
    phaseTotalSecondsRef.current = total;
    setTimeLeft(total);
    try {
      localStorage.setItem(LS_FOCUS, String(focusMinutes));
      localStorage.setItem(LS_SHORT, String(shortBreakMinutes));
      localStorage.setItem(LS_LONG, String(longBreakMinutes));
      localStorage.setItem(LS_ALLOW_LONG, String(allowLongTimers));
      localStorage.setItem(LS_AUTO_START, String(autoStartBreaks));
    } catch (err) {
      console.error("[Settings] Failed to save settings to localStorage:", err);
    }
  }, [focusMinutes, shortBreakMinutes, longBreakMinutes, effectiveLongBreakMinutes, currentPhase, allowLongTimers, autoStartBreaks, isRunning]);

  useEffect(() => {
    window.electronAPI.setTrayState(isRunning ? "active" : "idle");
  }, [isRunning]);

  const autoSaveFocusTime = async () => {
    const subject = focusSessionSubjectRef.current;

    if (currentPhase !== "focus" || !focusStartRef.current || !subject) {
      return;
    }

    const activeSeconds = Math.floor((Date.now() - focusStartRef.current) / 1000) - totalPausedSecondsRef.current;

    // Only save if we've crossed a full minute boundary since last save
    if (activeSeconds >= lastSaveSecondRef.current + 60) {
      try {
        const currentDate = localDateString();
        await window.electronAPI.timerDb.addOrUpdateTimerData(subject, currentDate, 1);
        lastSaveSecondRef.current += 60;
        console.log(`[AutoSave] ✅ Saved 1m for "${subject}"`);
      } catch (err) {
        console.error(`[AutoSave] ❌ Failed to save for "${subject}":`, err);
        setError(`Auto-save failed: ${String(err)}`);
      }
    }
  };

  useEffect(() => {
    if (isRunning && currentPhase === "focus" && focusSessionSubjectRef.current) {
      console.log(`[AutoSave] Starting auto-save for "${focusSessionSubjectRef.current}"`);
      autoSaveIntervalRef.current = setInterval(() => {
        autoSaveFocusTime();
      }, 10000); // Check every 10 seconds
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

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    console.log("[Timer] Starting timer");
    targetTimeRef.current = Date.now() + timeLeft * 1000;

    const tick = async () => {
      const remaining = targetTimeRef.current ? Math.round((targetTimeRef.current - Date.now()) / 1000) : 0;
      setTimeLeft(remaining > 0 ? remaining : 0);

      if (remaining <= 0) {
        console.log("[Timer] Timer completed");
        setIsRunning(false);
        setActiveControl(null);

        if (currentPhase === "focus") {
          try {
            await window.electronAPI.notify("Pomodoro complete", `Focus session finished.`);
          } catch (err) {
            console.error("[Timer] Notification failed:", err);
          }
          setCurrentCycle((prev) => {
            const nextCycle = prev >= 4 ? (allowLongTimers ? 4 : 1) : prev + 1;
            setCurrentPhaseAndReset(nextCycle === 4 ? "long" : "short");
            return nextCycle;
          });
        } else {
          try {
            const breakType = currentPhase === "long" ? "Long break" : "Short break";
            await window.electronAPI.notify("Break ended", `${breakType} finished — time to focus!`);
          } catch (err) {
            console.error("[Timer] Notification failed:", err);
          }
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

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (autoStartBreaks && !isRunning && !isPaused && hasManuallyStartedRef.current) {
      console.log("[AutoStart] Auto-starting next phase");
      handleStart();
    }
  }, [currentPhase, autoStartBreaks, isPaused]);

  function setCurrentPhaseAndReset(phase: TimerPhase) {
    console.log(`[Phase] Switching to ${phase} phase`);
    setError(null);
    const total = Math.floor((phase === "focus" ? focusMinutes : phase === "short" ? shortBreakMinutes : effectiveLongBreakMinutes) * 60) || 1;
    phaseTotalSecondsRef.current = total;
    setTimeLeft(total);
    pauseStartRef.current = null;
    setCurrentPhase(phase);
    setIsRunning(false);

    if (phase !== "focus") {
      focusSessionSubjectRef.current = null;
      lastSaveSecondRef.current = 0;
    }
  }

  async function handleStart() {
    console.log("[Control] Start pressed");
    setError(null);
    const isResuming = !!pauseStartRef.current;

    if (!selectedSubject && currentPhase === "focus") {
      setError("Please select a subject before starting.");
      return;
    }

    if (currentPhase === "focus" && !isResuming) {
      focusStartRef.current = Date.now();
      focusSessionSubjectRef.current = selectedSubject;
      lastSaveSecondRef.current = 0;
      console.log(`[Control] Started focus for "${selectedSubject}"`);
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
  }

  function handlePause() {
    console.log("[Control] Pause pressed");
    if (!isRunning) return;

    setActiveControl("pause");
    setTimeout(() => setActiveControl(null), 300);
    setIsRunning(false);

    if (!pauseStartRef.current) {
      pauseStartRef.current = Date.now();
      const currentMinutes = Math.floor(timeLeft / 60);
      const currentSeconds = timeLeft % 60;

      if (currentSeconds >= 30) {
        const roundedMinutes = currentMinutes + 1;
        const roundedTimeLeft = roundedMinutes * 60;
        setTimeLeft(roundedTimeLeft);
        phaseTotalSecondsRef.current = roundedTimeLeft;
      }
    }
  }

  async function handleReset() {
    console.log("[Control] Reset pressed");
    setActiveControl("reset");
    setTimeout(() => setActiveControl(null), 300);
    setIsRunning(false);

    hasManuallyStartedRef.current = false;
    focusStartRef.current = null;
    focusSessionSubjectRef.current = null;
    lastSaveSecondRef.current = 0;

    setCurrentPhaseAndReset(currentPhase);
  }

  async function handleSwitchPhase(phase: TimerPhase) {
    if (isRunning) return;
    hasManuallyStartedRef.current = false;
    setCurrentPhaseAndReset(phase);
  }

  async function handleSubjectChange(displayName: string) {
    if (isRunning) {
      setError("Cannot change subject while running");
      return;
    }

    const normalizedName = displayName.toLowerCase();
    if (subjects.includes(normalizedName)) {
      setSelectedSubject(normalizedName);
      try {
        localStorage.setItem(LS_SELECTED_NAME, normalizedName);
      } catch (err) {
        console.error("[Control] Failed to save subject:", err);
      }
    }
  }

  async function handleAddSubject(name: string) {
    if (isRunning) {
      setError("Cannot add subject while running");
      return;
    }

    const normalized = String(name || "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      setError("Subject name cannot be empty");
      return;
    }

    const visibleSubjects = subjects.filter((subject) => !hiddenSubjects.includes(subject));
    if (visibleSubjects.length >= MAX_SUBJECTS) {
      setError(`Max ${MAX_SUBJECTS} subjects. Hide some to add more.`);
      return;
    }

    try {
      const exists = await window.electronAPI.timerDb.checkIfSubjectExists(normalized);

      if (exists) {
        if (!hiddenSubjects.includes(normalized)) {
          setSelectedSubject(normalized);
          localStorage.setItem(LS_SELECTED_NAME, normalized);
        } else {
          await window.electronAPI.timerDb.unhideSubject(normalized);
          const updatedHidden = hiddenSubjects.filter((s) => s !== normalized);
          setHiddenSubjects(updatedHidden);
          saveHiddenSubjects(updatedHidden);
          await loadSubjects();
          setSelectedSubject(normalized);
          localStorage.setItem(LS_SELECTED_NAME, normalized);
        }
      } else {
        await window.electronAPI.timerDb.addOrUpdateTimerData(normalized, localDateString(), 0);
        await loadSubjects();
        setSelectedSubject(normalized);
        localStorage.setItem(LS_SELECTED_NAME, normalized);
      }
    } catch (err) {
      console.error("[Control] Failed to add subject:", err);
      setError(`Failed to add subject: ${String(err)}`);
    }
  }

  async function handleHideSubjectByName(displayName: string) {
    if (isRunning) {
      setError("Cannot hide subject while running");
      return;
    }

    const subjectName = displayName.toLowerCase();
    if (!subjects.includes(subjectName)) {
      return;
    }

    try {
      await window.electronAPI.timerDb.hideSubject(subjectName);

      const nextHidden = [...hiddenSubjects, subjectName];
      setHiddenSubjects(nextHidden);
      saveHiddenSubjects(nextHidden);

      const visibleSubjects = subjects.filter((subject) => !nextHidden.includes(subject));
      const nextSelected = visibleSubjects.length > 0 ? visibleSubjects[0] : null;

      setSelectedSubject(nextSelected);
      if (nextSelected) {
        localStorage.setItem(LS_SELECTED_NAME, nextSelected);
      } else {
        localStorage.removeItem(LS_SELECTED_NAME);
      }
    } catch (err) {
      console.error("[Control] Failed to hide subject:", err);
      setError(`Failed to hide subject: ${String(err)}`);
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

  const visibleSubjectsForDisplay = subjects.filter((subject) => !hiddenSubjects.includes(subject)).map((subject) => formatSubjectName(subject));
  const displaySelectedSubject = selectedSubject ? formatSubjectName(selectedSubject) : "";

  return (
    <div className="h-full flex flex-col p-2 mt-6">
      {error && <div className="bg-red-500 text-white p-2 rounded mb-4 text-center">{error}</div>}
      <div className="flex-1 grid md:grid-cols-2 gap-6">
        <TimerCard
          className="order-1"
          timeLeft={timeLeft}
          currentPhase={currentPhase}
          isRunning={isRunning}
          isPaused={isPaused}
          pauseSeconds={computedPauseSeconds}
          currentCycle={currentCycle}
          selectedSubject={displaySelectedSubject}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
          onSwitchPhase={handleSwitchPhase}
          allowLongTimers={allowLongTimers}
          activeControl={activeControl}
          phaseTotalSeconds={phaseTotalSecondsRef.current}
          autoStartBreaks={autoStartBreaks}
          focusMinutes={focusMinutes}
          shortBreakMinutes={shortBreakMinutes}
          longBreakMinutes={longBreakMinutes}
        />
        <SetupCard
          className="order-2"
          subjects={visibleSubjectsForDisplay}
          selectedSubject={displaySelectedSubject}
          focusMinutes={focusMinutes}
          shortBreakMinutes={shortBreakMinutes}
          longBreakMinutes={longBreakMinutes}
          allowLongTimers={allowLongTimers}
          autoStartBreaks={autoStartBreaks}
          isRunning={isRunning}
          onSubjectChange={handleSubjectChange}
          onAddSubject={handleAddSubject}
          onUpdateFocus={setFocusMinutes}
          onUpdateShortBreak={setShortBreakMinutes}
          onUpdateLongBreak={setLongBreakMinutes}
          onToggleLongTimers={setAllowLongTimers}
          onToggleAutoStart={setAutoStartBreaks}
          onHideSubject={handleHideSubjectByName}
        />
      </div>
    </div>
  );
}
