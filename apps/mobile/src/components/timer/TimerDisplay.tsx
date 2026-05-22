import { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Play, Pause, X } from 'lucide-react-native';
import { useAccentColor } from '@/context/AccentColor';
import { pad2 } from '@/lib/utils';

type TimerPhase = 'focus' | 'short' | 'long';

const FOCUS_COLOR = 'red';
const SHORT_BREAK_COLOR = 'blue';
const LONG_BREAK_COLOR = 'green';
const PAUSED_COLOR = 'gray';

interface TimerDisplayProps {
  timeLeft: number;
  currentPhase: TimerPhase;
  isRunning: boolean;
  isPaused: boolean;
  currentCycle: number;
  selectedSubject: string | null;
  phaseTotalSeconds: number;
  allowLongTimers: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSwitchPhase: (phase: TimerPhase) => void;
}

export default function TimerDisplay({
  timeLeft,
  currentPhase,
  isRunning,
  isPaused,
  currentCycle,
  selectedSubject,
  phaseTotalSeconds,
  allowLongTimers,
  onStart,
  onPause,
  onReset,
  onSwitchPhase,
}: TimerDisplayProps) {
  const { setAccent } = useAccentColor();

  useEffect(() => {
    if (isPaused) setAccent(PAUSED_COLOR);
    else if (currentPhase === 'short') setAccent(SHORT_BREAK_COLOR);
    else if (currentPhase === 'long') setAccent(LONG_BREAK_COLOR);
    else setAccent(FOCUS_COLOR);
    return () => setAccent(FOCUS_COLOR);
  }, [currentPhase, isPaused]);

  const accent = useAccentColor().accentColor;
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const totalSeconds = Math.max(1, phaseTotalSeconds || 1);
  const progress = (totalSeconds - timeLeft) / totalSeconds;
  const strokeDashoffset = circumference * (1 - progress);
  const totalDots = 60;
  const remainingDots = Math.max(0, Math.floor((timeLeft / totalSeconds) * totalDots));

  const displayMinutes = Math.floor(timeLeft / 60);
  const displaySeconds = timeLeft % 60;

  let displayLabel = (selectedSubject || '').toUpperCase();
  if (isPaused) displayLabel = 'PAUSED';
  else if (currentPhase === 'short') displayLabel = 'SHORT BREAK';
  else if (currentPhase === 'long') displayLabel = 'LONG BREAK';

  const handleSwitch = (phase: TimerPhase) => {
    if (isRunning) return;
    onSwitchPhase(phase);
  };

  const tabBase = 'px-4 py-2 rounded-lg';
  const activeTab = { backgroundColor: accent };

  return (
    <View className="bg-white/5 border border-gray-700/30 rounded-2xl p-4">
      <Text className="text-2xl font-bold text-white text-center tracking-tight mb-2">
        Pomodoro Timer
      </Text>

      <View className="flex-row justify-center gap-2 mb-6">
        {(['focus', 'short', ...(allowLongTimers ? ['long' as TimerPhase] : [])] as TimerPhase[]).map(phase => {
          const label = phase === 'focus' ? 'Pomodoro' : phase === 'short' ? 'Short Break' : 'Long Break';
          const isActive = currentPhase === phase;
          return (
            <TouchableOpacity
              key={phase}
              className={`${tabBase} ${isRunning ? 'bg-white/5 opacity-50' : isActive ? '' : 'bg-white/10'}`}
              style={isActive && !isRunning ? activeTab : undefined}
              onPress={() => handleSwitch(phase)}
              disabled={isRunning}
            >
              <Text className={`text-white text-sm font-medium ${isActive ? '' : 'text-white/70'}`}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="items-center justify-center relative" style={{ height: 280, width: 280, alignSelf: 'center' }}>
        <Svg width="280" height="280" viewBox="0 0 100 100" style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />

          {Array.from({ length: totalDots }).map((_, i) => {
            const angle = (i / totalDots) * -360;
            const rad = (angle * Math.PI) / 180;
            const dotRadius = 44;
            const x = 50 + dotRadius * Math.cos(rad);
            const y = 50 + dotRadius * Math.sin(rad);
            return (
              <Circle
                key={i}
                cx={x}
                cy={y}
                r="1.5"
                fill={i < remainingDots ? 'white' : 'transparent'}
                opacity={i < remainingDots ? 0.8 : 0}
              />
            );
          })}

          <Circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth="2.4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>

        <View className="absolute inset-0 items-center justify-center" style={{ transform: [] }}>
          <Text className="text-5xl font-light text-white tracking-tighter mb-3">
            {pad2(displayMinutes)}:{pad2(displaySeconds)}
          </Text>
          <View className="items-center">
            <Text className="text-lg font-bold tracking-wider" style={{ color: accent }}>
              {displayLabel}
            </Text>
            <Text className="text-white text-lg font-bold">TIME</Text>
          </View>
          {allowLongTimers && (
            <View className="bg-white/10 px-3 py-1 rounded-full mt-3">
              <Text className="text-sm text-white/70">Cycle: {currentCycle}/4</Text>
            </View>
          )}
        </View>
      </View>

      <View className="flex-row gap-3 mt-4">
        <TouchableOpacity
          className="flex-1 rounded-lg py-3 items-center"
          style={{ backgroundColor: isRunning ? 'rgba(156,163,175,0.3)' : accent }}
          onPress={onStart}
        >
          <View className="flex-row items-center gap-2">
            <Play size={20} color="white" />
            <Text className="text-white text-lg font-medium">Start</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 rounded-lg py-3 items-center"
          style={{ backgroundColor: isPaused ? accent : 'rgba(156,163,175,0.3)' }}
          onPress={onPause}
        >
          <View className="flex-row items-center gap-2">
            <Pause size={20} color="white" />
            <Text className="text-white text-lg font-medium">Pause</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-black/80 rounded-lg py-3 items-center"
          onPress={onReset}
        >
          <View className="flex-row items-center gap-2">
            <X size={20} color="white" />
            <Text className="text-white text-lg font-medium">Reset</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
