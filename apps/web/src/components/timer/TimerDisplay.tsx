import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, X } from 'lucide-react';
import { pad2 } from '../../lib/utils';

const TOTAL_DOTS = 60;
const DOT_COORDINATES = Array.from({ length: TOTAL_DOTS }).map((_, i) => {
  const angle = (i / TOTAL_DOTS) * -360;
  const rad = (angle * Math.PI) / 180;
  const dotRadius = 44;
  return {
    x: 50 + dotRadius * Math.cos(rad),
    y: 50 + dotRadius * Math.sin(rad),
  };
});

type TimerPhase = 'focus' | 'short' | 'long';

const FOCUS_COLOR = '239 68 68';
const SHORT_BREAK_COLOR = '37 99 235';
const LONG_BREAK_COLOR = '16 185 129';
const PAUSED_COLOR = '75 85 99';

interface TimerDisplayProps {
  timeLeft: number;
  currentPhase: TimerPhase;
  isRunning: boolean;
  isPaused: boolean;
  pauseSeconds: number;
  currentCycle: number;
  selectedSubject: string | null;
  phaseTotalSeconds: number;
  allowLongTimers: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSwitchPhase: (phase: TimerPhase) => void;
  className?: string;
}

export default function TimerDisplay({
  timeLeft,
  currentPhase,
  isRunning,
  isPaused,
  pauseSeconds,
  currentCycle,
  selectedSubject,
  phaseTotalSeconds,
  allowLongTimers,
  onStart,
  onPause,
  onReset,
  onSwitchPhase,
  className,
}: TimerDisplayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Update the global accent color so the whole app (sidebar, buttons, etc.)
  // reflects the current timer phase. No cleanup return — we intentionally
  // keep the color when navigating away, and the brief FOCUS_COLOR flash
  // that the old cleanup caused is gone.
  useEffect(() => {
    let color = FOCUS_COLOR;
    if (isPaused) color = PAUSED_COLOR;
    else if (currentPhase === 'short') color = SHORT_BREAK_COLOR;
    else if (currentPhase === 'long') color = LONG_BREAK_COLOR;
    document.documentElement.style.setProperty('--accent-primary-rgb', color);
    const el = cardRef.current;
    if (el) el.style.setProperty('--accent-primary-rgb', color);
  }, [currentPhase, isPaused]);

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const totalSeconds = Math.max(1, phaseTotalSeconds || 1);
  const progress = (totalSeconds - timeLeft) / totalSeconds;
  const strokeDashoffset = circumference * (1 - progress);
  const totalDots = 60;
  const remainingDots = Math.max(0, Math.floor((timeLeft / totalSeconds) * totalDots));

  const displayMinutes = isPaused ? Math.floor(pauseSeconds / 60) : Math.floor(timeLeft / 60);
  const displaySeconds = isPaused ? pauseSeconds % 60 : timeLeft % 60;

  let displayLabel = (selectedSubject || '').toUpperCase();
  if (isPaused) displayLabel = 'PAUSED';
  else if (currentPhase === 'short') displayLabel = 'SHORT BREAK';
  else if (currentPhase === 'long') displayLabel = 'LONG BREAK';

  const circleStroke = `rgb(var(--accent-primary-rgb))`;

  const tabBase = 'px-4 py-2 rounded-lg transition-all duration-300 font-medium';
  const accentBg = 'bg-[rgb(var(--accent-primary-rgb))]';

  const handleSwitch = (phase: TimerPhase) => {
    if (isRunning) return;
    onSwitchPhase(phase);
  };

  return (
    <Card ref={cardRef} className={`glass-card shadow-xl border border-glass-border ${className || ''}`} style={{ '--accent-primary-rgb': FOCUS_COLOR } as React.CSSProperties}>
      <CardContent className="flex flex-col items-center space-y-2 pt-1">
        <div className="text-center mb-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Pomodoro Timer</h2>
        </div>

        {/* Phase tabs */}
        <div className="flex justify-center gap-3 text-sm font-medium mb-6">
          <button
            className={`${tabBase} ${isRunning ? 'bg-gray-400/50 text-white/60 cursor-not-allowed' : currentPhase === 'focus' ? `${accentBg} text-white hover:brightness-110` : 'bg-gray-400/80 text-white/90 hover:bg-[rgb(var(--accent-primary-rgb))]/50'}`}
            onClick={() => handleSwitch('focus')}
            disabled={isRunning}
          >
            Pomodoro
          </button>
          <button
            className={`${tabBase} ${isRunning ? 'bg-gray-400/50 text-white/60 cursor-not-allowed' : currentPhase === 'short' ? `${accentBg} text-white hover:brightness-110` : 'bg-gray-400/80 text-white/90 hover:bg-[rgb(var(--accent-primary-rgb))]/50'}`}
            onClick={() => handleSwitch('short')}
            disabled={isRunning}
          >
            Short Break
          </button>
          {allowLongTimers && (
            <button
              className={`${tabBase} ${isRunning ? 'bg-gray-400/50 text-white/60 cursor-not-allowed' : currentPhase === 'long' ? `${accentBg} text-white hover:brightness-110` : 'bg-gray-400/80 text-white/90 hover:bg-[rgb(var(--accent-primary-rgb))]/50'}`}
              onClick={() => handleSwitch('long')}
              disabled={isRunning}
            >
              Long Break
            </button>
          )}
        </div>

        {/* Clock dial */}
        <div className="relative">
          <svg width="280" height="280" viewBox="0 0 100 100" className="transform -rotate-90">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--timer-circle-bg)" strokeWidth="0.8" />

            {/* 60 dot indicators */}
            {DOT_COORDINATES.map((coord, i) => (
              <circle
                key={i}
                cx={coord.x}
                cy={coord.y}
                r="1.5"
                fill={i < remainingDots ? 'white' : 'transparent'}
                opacity={i < remainingDots ? 0.8 : 0}
              />
            ))}

            {/* Progress ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={circleStroke}
              strokeWidth="2.4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>

          {/* Center time display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`timer-text mb-3 tracking-tighter text-5xl font-light ${isRunning ? 'animate-pulse' : ''}`}>
              {pad2(displayMinutes)}:{pad2(displaySeconds)}
            </div>
            <div className="font-bold tracking-wider text-lg flex flex-col items-center">
              <span style={{ color: circleStroke }}>{displayLabel}</span>
              <span className="text-white">TIME</span>
            </div>
            {allowLongTimers && (
              <div className="text-sm text-white/70 mt-3 bg-white/10 px-3 py-1 rounded-full">
                Cycle: {currentCycle}/4
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Controls */}
      <CardFooter className="flex gap-4 w-full max-w-md mx-auto pb-6">
        <Button
          className={`flex-1 gap-2 px-6 py-3 rounded-lg font-medium text-lg ${
            isRunning
              ? 'bg-gray-400/80 text-white hover:bg-[rgb(var(--accent-primary-rgb))]/50'
              : `${accentBg} text-white hover:brightness-110`
          }`}
          onClick={onStart}
        >
          <Play className="w-5 h-5" /> Start
        </Button>
        <Button
          className={`flex-1 gap-2 px-6 py-3 rounded-lg font-medium text-lg ${
            isPaused
              ? `${accentBg} text-white hover:brightness-110`
              : 'bg-gray-400/80 text-white hover:bg-[rgb(var(--accent-primary-rgb))]/50'
          }`}
          onClick={onPause}
        >
          <Pause className="w-5 h-5" /> Pause
        </Button>
        <Button
          className="flex-1 gap-2 px-6 py-3 rounded-lg font-medium text-lg bg-black/80 text-white hover:bg-[rgb(var(--accent-primary-rgb))]/50"
          onClick={onReset}
        >
          <X className="w-5 h-5" /> Reset
        </Button>
      </CardFooter>
    </Card>
  );
}
