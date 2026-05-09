import { create } from 'zustand';

type TimerPhase = 'focus' | 'short' | 'long';

interface TimerStore {
  // Timer state (persisted across route changes)
  timeLeft: number;
  currentPhase: TimerPhase;
  isRunning: boolean;
  isPaused: boolean;
  currentCycle: number;
  selectedSubject: string | null;
  phaseTotalSeconds: number;

  // Actions
  setTimeLeft: (v: number) => void;
  setCurrentPhase: (v: TimerPhase) => void;
  setIsRunning: (v: boolean) => void;
  setIsPaused: (v: boolean) => void;
  setCurrentCycle: (v: number) => void;
  setSelectedSubject: (v: string | null) => void;
  setPhaseTotalSeconds: (v: number) => void;
}

export const useTimerStore = create<TimerStore>((set) => ({
  timeLeft: 25 * 60,
  currentPhase: 'focus',
  isRunning: false,
  isPaused: false,
  currentCycle: 1,
  selectedSubject: null,
  phaseTotalSeconds: 25 * 60,

  setTimeLeft: (timeLeft) => set({ timeLeft }),
  setCurrentPhase: (currentPhase) => set({ currentPhase }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setCurrentCycle: (currentCycle) => set({ currentCycle }),
  setSelectedSubject: (selectedSubject) => set({ selectedSubject }),
  setPhaseTotalSeconds: (phaseTotalSeconds) => set({ phaseTotalSeconds }),
}));
