import { create } from 'zustand';
import type { TimerPhase } from '@/lib/types';

interface TimerStore {
  timeLeft: number;
  currentPhase: TimerPhase;
  isRunning: boolean;
  isPaused: boolean;
  currentCycle: number;
  selectedSubject: string | null;

  setTimeLeft: (v: number) => void;
  setCurrentPhase: (v: TimerPhase) => void;
  setIsRunning: (v: boolean) => void;
  setIsPaused: (v: boolean) => void;
  setCurrentCycle: (v: number) => void;
  setSelectedSubject: (v: string | null) => void;
}

export const useTimerStore = create<TimerStore>((set) => ({
  timeLeft: 25 * 60,
  currentPhase: 'focus',
  isRunning: false,
  isPaused: false,
  currentCycle: 1,
  selectedSubject: null,

  setTimeLeft: (timeLeft) => set({ timeLeft }),
  setCurrentPhase: (currentPhase) => set({ currentPhase }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setCurrentCycle: (currentCycle) => set({ currentCycle }),
  setSelectedSubject: (selectedSubject) => set({ selectedSubject }),
}));
