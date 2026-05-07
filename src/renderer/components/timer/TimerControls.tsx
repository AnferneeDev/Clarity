import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface TimerControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  selectedSubject: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  className?: string;
}

export default function TimerControls({
  isRunning,
  isPaused,
  selectedSubject,
  onStart,
  onPause,
  onReset,
  className,
}: TimerControlsProps) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className ?? ''}`}>
      {!isRunning ? (
        <Button
          onClick={onStart}
          disabled={!selectedSubject}
          className="bg-green-600 hover:bg-green-700 text-white px-8"
        >
          <Play className="w-5 h-5 mr-2" />
          Start
        </Button>
      ) : (
        <Button
          onClick={onPause}
          className="bg-yellow-600 hover:bg-yellow-700 text-white px-8"
        >
          <Pause className="w-5 h-5 mr-2" />
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
      )}
      <Button
        onClick={onReset}
        variant="outline"
        className="border-gray-600 text-white hover:bg-white/5"
      >
        <RotateCcw className="w-5 h-5" />
      </Button>
    </div>
  );
}
