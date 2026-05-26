'use client';

import { usePomodoroTimer } from '@/hooks/usePomodoroTimer';
import TimerDisplay from '@/components/timer/TimerDisplay';
import SubjectPicker from '@/components/timer/SubjectPicker';

// Skeleton that matches the two-column layout shape so the view
// doesn't replace its entire structure while subjects are loading.
function TimerSkeleton() {
  return (
    <div className="h-full flex flex-col p-2 mt-6">
      <div className="flex-1 grid md:grid-cols-2 gap-6 animate-pulse">
        {/* Left card placeholder */}
        <div className="glass-card shadow-xl border border-glass-border rounded-2xl" />
        {/* Right card placeholder */}
        <div className="glass-card shadow-lg border border-glass-border rounded-2xl" />
      </div>
    </div>
  );
}

export default function TimerPageContent() {
  const timer = usePomodoroTimer();

  if (timer.isLoading) {
    return <TimerSkeleton />;
  }

  return (
    <div className="h-full flex flex-col p-2 mt-6">
      <div className="flex-1 grid md:grid-cols-2 gap-6">
        <TimerDisplay
          timeLeft={timer.timeLeft}
          currentPhase={timer.currentPhase}
          isRunning={timer.isRunning}
          isPaused={timer.isPaused}
          pauseSeconds={0}
          currentCycle={timer.currentCycle}
          selectedSubject={timer.selectedSubject}
          phaseTotalSeconds={timer.phaseTotalSeconds}
          allowLongTimers={timer.allowLongTimers}
          onStart={timer.handleStart}
          onPause={timer.handlePause}
          onReset={timer.handleReset}
          onSwitchPhase={timer.switchPhase}
          className="order-1"
        />
        <SubjectPicker
          subjects={timer.subjects}
          selectedSubject={timer.selectedSubject}
          focusMinutes={timer.focusMinutes}
          shortBreakMinutes={timer.shortBreakMinutes}
          longBreakMinutes={timer.longBreakMinutes}
          allowLongTimers={timer.allowLongTimers}
          autoStartBreaks={timer.autoStartBreaks}
          isRunning={timer.isRunning}
          onSelectSubject={timer.selectSubject}
          onAddSubject={timer.addSubject}
          onHideSubject={timer.hideSubject}
          onSetFocusMinutes={timer.setFocusMinutes}
          onSetShortBreakMinutes={timer.setShortBreakMinutes}
          onSetLongBreakMinutes={timer.setLongBreakMinutes}
          onSetAllowLongTimers={timer.setAllowLongTimers}
          onSetAutoStartBreaks={timer.setAutoStartBreaks}
          className="order-2"
        />
      </div>
    </div>
  );
}
