import { View, ActivityIndicator } from 'react-native';
import { usePomodoroTimer } from '@/hooks/usePomodoroTimer';
import { useAuth } from '@/hooks/useAuth';
import TimerDisplay from '@/components/timer/TimerDisplay';
import SubjectPicker from '@/components/timer/SubjectPicker';

export default function TimerScreen() {
  const { user } = useAuth();
  const timer = usePomodoroTimer(user?.id || null);

  if (timer.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return (
    <View className="flex-1 p-3 bg-black">
      <TimerDisplay
        timeLeft={timer.timeLeft}
        currentPhase={timer.currentPhase}
        isRunning={timer.isRunning}
        isPaused={timer.isPaused}
        currentCycle={timer.currentCycle}
        selectedSubject={timer.selectedSubject}
        phaseTotalSeconds={timer.phaseTotalSeconds}
        allowLongTimers={timer.allowLongTimers}
        onStart={timer.handleStart}
        onPause={timer.handlePause}
        onReset={timer.handleReset}
        onSwitchPhase={timer.switchPhase}
      />
      <View className="mt-4 flex-1">
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
        />
      </View>
    </View>
  );
}
