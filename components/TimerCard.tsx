// src/renderer/components/views/timer/TimerCard.tsx
import React, { useEffect } from "react";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Button } from "./ui/button";
import { Play, Pause, X } from "lucide-react";

type TimerPhase = "focus" | "short" | "long";
type Control = "start" | "pause" | "reset" | null;

interface TimerCardProps {
  className?: string;
  timeLeft: number;
  currentPhase: TimerPhase;
  isRunning: boolean;
  isPaused?: boolean;
  pauseSeconds?: number;
  currentCycle: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  selectedSubject: string;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onSwitchPhase?: (phase: TimerPhase) => void;
  allowLongTimers?: boolean;
  activeControl?: Control;
  setActiveControl?: (c: Control) => void;
  phaseTotalSeconds?: number;
  autoStartBreaks?: boolean;
}

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export default function TimerCard({
  className,
  timeLeft = 25 * 60,
  currentPhase = "focus",
  isRunning = false,
  isPaused = false,
  pauseSeconds = 0,
  currentCycle = 1,
  focusMinutes = 25,
  shortBreakMinutes = 5,
  longBreakMinutes = 15,
  selectedSubject = "General",
  onStart,
  onPause,
  onReset,
  onSwitchPhase,
  allowLongTimers = true,
  setActiveControl,
  phaseTotalSeconds = 25 * 60,
  autoStartBreaks = false,
}: TimerCardProps) {
  const FOCUS_COLOR = "239 68 68";
  const SHORT_BREAK_COLOR = "37 99 235";
  const LONG_BREAK_COLOR = "16 185 129";
  const PAUSED_COLOR = "75 85 99";

  useEffect(() => {
    let color = FOCUS_COLOR;
    if (isPaused) {
      color = PAUSED_COLOR;
    } else if (currentPhase === "short") {
      color = SHORT_BREAK_COLOR;
    } else if (currentPhase === "long") {
      color = LONG_BREAK_COLOR;
    }
    document.documentElement.style.setProperty("--accent-primary-rgb", color);

    return () => {
      document.documentElement.style.setProperty("--accent-primary-rgb", FOCUS_COLOR);
    };
  }, [currentPhase, isPaused]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.max(0, timeLeft % 60);

  const tabBase = "px-4 py-2 rounded-lg transition-all duration-300 font-medium";
  const buttonBase = "flex-1 flex items-center gap-2 transition-all duration-300 px-6 py-3 rounded-lg font-medium text-lg";

  const tabActiveClass = "bg-[rgb(var(--accent-primary-rgb))] text-white hover:brightness-110";
  const tabInactiveClass = "bg-gray-400/80 text-white/90 hover:bg-[rgb(var(--accent-primary-rgb))]/50";
  const tabDisabledClass = "bg-gray-400/50 text-white/60 cursor-not-allowed";

  const handleStart = () => {
    onStart?.();
  };
  const handlePause = () => {
    onPause?.();
  };
  const handleReset = () => {
    onReset?.();
  };
  const handleSwitch = (phase: TimerPhase) => {
    if (isRunning) return;
    onSwitchPhase?.(phase);
  };

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const totalSeconds = Math.max(1, phaseTotalSeconds);
  const progress = (totalSeconds - timeLeft) / totalSeconds;
  const strokeDashoffset = circumference * (1 - progress);
  const totalDots = 60;
  const remainingDots = Math.max(0, Math.floor((timeLeft / totalSeconds) * totalDots));

  let displayLabel = selectedSubject.toUpperCase();
  let displayMinutes = minutes;
  let displaySeconds = seconds;
  if (isPaused) {
    const pMin = Math.floor((pauseSeconds || 0) / 60);
    const pSec = (pauseSeconds || 0) % 60;
    displayLabel = "PAUSED";
    displayMinutes = pMin;
    displaySeconds = pSec;
  } else if (currentPhase === "short") {
    displayLabel = "SHORT BREAK";
  } else if (currentPhase === "long") {
    displayLabel = "LONG BREAK";
  }

  const circleStroke = "rgb(var(--accent-primary-rgb))";
  const playActive = isRunning === true;
  const pauseActive = isPaused === true;

  const activeHoverClass = "hover:brightness-110";
  const inactiveHoverClass = "hover:bg-[rgb(var(--accent-primary-rgb))]/50";
  const playClass = `${buttonBase} ${playActive ? `bg-[rgb(var(--accent-primary-rgb))] text-white ${activeHoverClass}` : `bg-gray-400/80 text-white ${inactiveHoverClass}`}`;
  const pauseClass = `${buttonBase} ${pauseActive ? `bg-[rgb(var(--accent-primary-rgb))] text-white ${activeHoverClass}` : `bg-gray-400/80 text-white ${inactiveHoverClass}`}`;
  const resetClass = `${buttonBase} bg-black/80 text-white ${inactiveHoverClass}`;

  return (
    <Card className={`glass-card shadow-xl border border-glass-border ${className || ""}`}>
      <CardContent className="flex flex-col items-center space-y-2 pt-1">
        <div className="text-center mb-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Pomodoro Timer</h2>
        </div>
        <div className="flex justify-center gap-3 text-sm font-medium mb-6">
          <button className={`${tabBase} ${isRunning ? tabDisabledClass : currentPhase === "focus" ? tabActiveClass : tabInactiveClass}`} onClick={() => handleSwitch("focus")} disabled={isRunning}>
            Pomodoro
          </button>
          <button className={`${tabBase} ${isRunning ? tabDisabledClass : currentPhase === "short" ? tabActiveClass : tabInactiveClass}`} onClick={() => handleSwitch("short")} disabled={isRunning}>
            Short Break
          </button>
          {/* CHANGED: This button is now correctly hidden when allowLongTimers is false */}
          {allowLongTimers && (
            <button className={`${tabBase} ${isRunning ? tabDisabledClass : currentPhase === "long" ? tabActiveClass : tabInactiveClass}`} onClick={() => handleSwitch("long")} disabled={isRunning}>
              Long Break
            </button>
          )}
        </div>
        <div className="relative">
          <svg width="280" height="280" viewBox="0 0 100 100" className="transform -rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--timer-circle-bg)" strokeWidth="0.8" />
            {Array.from({ length: totalDots }).map((_, i) => {
              const angle = (i / totalDots) * -360;
              const rad = (angle * Math.PI) / 180;
              const dotRadius = 44;
              const x = 50 + dotRadius * Math.cos(rad);
              const y = 50 + dotRadius * Math.sin(rad);
              const isVisible = i < remainingDots;
              return <circle key={i} cx={x} cy={y} r="1.5" fill={isVisible ? "white" : "transparent"} opacity={isVisible ? 0.8 : 0} />;
            })}
            <circle cx="50" cy="50" r={radius} fill="none" stroke={circleStroke} strokeWidth="2.4" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`timer-text mb-3 tracking-tighter text-5xl font-light ${isRunning ? "animate-pulse" : ""}`}>
              {pad2(displayMinutes)}:{pad2(displaySeconds)}
            </div>
            <div className="font-bold tracking-wider text-lg flex flex-col items-center">
              <span style={{ color: circleStroke }}>{displayLabel}</span>
              <span className="text-white">TIME</span>
            </div>
            {allowLongTimers && <div className="text-sm text-white/70 mt-3 bg-white/10 px-3 py-1 rounded-full">Cycle: {currentCycle}/4</div>}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-4 w-full max-w-md mx-auto pb-6">
        <Button className={playClass} onClick={handleStart}>
          <Play className="w-5 h-5" /> Start
        </Button>
        <Button className={pauseClass} onClick={handlePause}>
          <Pause className="w-5 h-5" /> Pause
        </Button>
        <Button className={resetClass} onClick={handleReset}>
          <X className="w-5 h-5 text-white" /> Reset
        </Button>
      </CardFooter>
    </Card>
  );
}
