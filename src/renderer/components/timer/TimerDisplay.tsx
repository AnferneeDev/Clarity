import { Card, CardContent } from '@/components/ui/card';
import { pad2 } from '../../lib/utils';

type TimerPhase = 'focus' | 'short' | 'long';

interface TimerDisplayProps {
  timeLeft: number;
  currentPhase: TimerPhase;
  isRunning: boolean;
  isPaused: boolean;
  currentCycle: number;
  selectedSubject: string | null;
  phaseTotalSeconds: number;
  className?: string;
}

const PHASE_LABELS: Record<TimerPhase, string> = {
  focus: 'Focus',
  short: 'Short Break',
  long: 'Long Break',
};

const PHASE_COLORS: Record<TimerPhase, string> = {
  focus: '239 68 68',
  short: '37 99 235',
  long: '59 130 246',
};

export default function TimerDisplay({
  timeLeft,
  currentPhase,
  isRunning,
  isPaused,
  currentCycle,
  selectedSubject,
  phaseTotalSeconds,
  className,
}: TimerDisplayProps) {
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const ratio = Math.max(0, timeLeft) / phaseTotalSeconds;
  const color = PHASE_COLORS[currentPhase];

  return (
    <Card className={`glass-card bg-white/5 border-gray-700/30 ${className ?? ''}`}>
      <CardContent className="flex flex-col items-center justify-center h-full py-8">
        {/* Phase label */}
        <div className="text-sm text-gray-400 mb-2">
          {PHASE_LABELS[currentPhase]} {currentPhase === 'focus' ? `#${currentCycle}` : ''}
        </div>

        {/* Clock */}
        <div
          className="text-7xl md:text-8xl font-mono font-bold text-white tracking-wider tabular-nums select-none mb-4"
          style={{ color: `rgb(${color})` }}
        >
          {hours > 0 ? (
            <>{pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}</>
          ) : (
            <>{pad2(minutes)}:{pad2(seconds)}</>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{
              width: `${(1 - ratio) * 100}%`,
              backgroundColor: `rgb(${color})`,
            }}
          />
        </div>

        {/* Status */}
        <div className="text-xs text-gray-500">
          {isPaused ? 'Paused' : isRunning ? 'Running' : 'Ready'}
          {selectedSubject ? ` — ${selectedSubject}` : ''}
        </div>
      </CardContent>
    </Card>
  );
}
