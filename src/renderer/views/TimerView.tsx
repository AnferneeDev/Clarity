import { usePomodoroTimer } from '../hooks/usePomodoroTimer';
import TimerDisplay from '../components/timer/TimerDisplay';
import SubjectPicker from '../components/timer/SubjectPicker';

export default function TimerView() {
  const timer = usePomodoroTimer();

  if (timer.isLoading) {
    return <div className="h-full flex items-center justify-center text-white text-sm">Loading timer...</div>;
  }

  return (
    <div className="h-full flex flex-col p-2 mt-6">
      <div className="flex-1 grid md:grid-cols-2 gap-6">
        <TimerDisplay
          timeLeft={timer.timeLeft}
          currentPhase={timer.currentPhase}
          isRunning={timer.isRunning}
          isPaused={timer.isPaused}
          currentCycle={timer.currentCycle}
          selectedSubject={timer.selectedSubject}
          phaseTotalSeconds={timer.phaseTotalSeconds}
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
          onDeleteSubject={timer.deleteSubject}
          onSetFocusMinutes={timer.setFocusMinutes}
          onSetShortBreakMinutes={timer.setShortBreakMinutes}
          onSetLongBreakMinutes={timer.setLongBreakMinutes}
          onSetAllowLongTimers={timer.setAllowLongTimers}
          onSetAutoStartBreaks={timer.setAutoStartBreaks}
          onStart={timer.handleStart}
          onPause={timer.handlePause}
          onReset={timer.handleReset}
          className="order-2"
        />
      </div>
    </div>
  );
}
