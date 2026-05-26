import { useState, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, X } from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  is_hidden: boolean;
}

interface SubjectPickerProps {
  subjects: Subject[];
  selectedSubject: string | null;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  allowLongTimers: boolean;
  autoStartBreaks: boolean;
  isRunning: boolean;
  onSelectSubject: (name: string) => void;
  onAddSubject: (name: string) => Promise<void>;
  onHideSubject: (name: string) => Promise<void>;
  onSetFocusMinutes: (v: number) => void;
  onSetShortBreakMinutes: (v: number) => void;
  onSetLongBreakMinutes: (v: number) => void;
  onSetAllowLongTimers: (v: boolean) => void;
  onSetAutoStartBreaks: (v: boolean) => void;
  className?: string;
}

function capitalize(s: string) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const focusOptions = [
  { key: '25m', label: '25m', minutes: 25 },
  { key: '30m', label: '30m', minutes: 30 },
  { key: '50m', label: '50m', minutes: 50 },
  { key: '60m', label: '60m', minutes: 60 },
  { key: '70m', label: '70m', minutes: 70 },
  { key: '90m', label: '90m', minutes: 90 },
];

const shortBreakOptions = [
  { key: '5m', label: '5m', minutes: 5 },
  { key: '10m', label: '10m', minutes: 10 },
  { key: '20m', label: '20m', minutes: 20 },
];

const longBreakOptions = [
  { key: '15m', label: '15m', minutes: 15 },
  { key: '20m', label: '20m', minutes: 20 },
  { key: '30m', label: '30m', minutes: 30 },
];

const activeClass = 'bg-[rgb(var(--accent-primary-rgb))] text-white border-[rgb(var(--accent-primary-rgb))] hover:brightness-110';
const inactiveClass = 'bg-gray-400/80 text-white/90 border-gray-700/50 hover:bg-[rgb(var(--accent-primary-rgb))]/50';

const SubjectPicker = memo(function SubjectPicker({
  subjects,
  selectedSubject,
  focusMinutes,
  shortBreakMinutes,
  longBreakMinutes,
  allowLongTimers,
  autoStartBreaks,
  isRunning,
  onSelectSubject,
  onAddSubject,
  onHideSubject,
  onSetFocusMinutes,
  onSetShortBreakMinutes,
  onSetLongBreakMinutes,
  onSetAllowLongTimers,
  onSetAutoStartBreaks,
  className,
}: SubjectPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');

  const visibleSubjects = subjects.filter(s => !s.is_hidden);

  function isActive(a: number, b: number) {
    return Math.abs((a || 0) - (b || 0)) < 0.001;
  }

  const handleAdd = () => {
    const name = newSubject.trim();
    if (!name) return;
    onAddSubject(name);
    setNewSubject('');
    setDialogOpen(false);
  };

  return (
    <Card className={`relative glass-card shadow-lg border border-glass-border ${className || ''}`}>
      {/* Locked overlay when running */}
      {isRunning && (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed"
          onClick={() => alert('Please pause or reset the timer to change settings.')}
        />
      )}

      <CardContent className="space-y-3 pt-1">
        {/* Subjects */}
        <div className="space-y-3">
          <Label className="text-white text-sm font-medium">Subjects</Label>
          <div className="grid grid-cols-2 gap-2">
            {visibleSubjects.map(subject => (
              <div key={subject.id} className="relative group">
                <Button
                  size="sm"
                  className={`w-full justify-center text-white ${selectedSubject === subject.name ? activeClass : inactiveClass
                    }`}
                  onClick={() => onSelectSubject(subject.name)}
                  disabled={isRunning}
                >
                  {capitalize(subject.name)}
                </Button>
                {!isRunning && (
                  <button
                    type="button"
                    title={`Hide ${subject.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHideSubject(subject.name);
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <div className="relative">
              <Button
                size="sm"
                className={`w-full justify-center text-white ${inactiveClass} flex items-center gap-2`}
                onClick={() => setDialogOpen(true)}
                disabled={isRunning}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </div>

        {/* Focus Duration */}
        <div className="space-y-3">
          <Label className="text-white text-sm font-medium">Focus Duration</Label>
          <div className="grid grid-cols-3 gap-2">
            {focusOptions.map(opt => (
              <Button
                key={opt.key}
                size="sm"
                className={`w-full text-white ${isActive(opt.minutes, focusMinutes) ? activeClass : inactiveClass}`}
                onClick={() => onSetFocusMinutes(opt.minutes)}
                disabled={isRunning}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Short Break */}
        <div className="space-y-3">
          <Label className="text-white text-sm font-medium">Short Break</Label>
          <div className="grid grid-cols-3 gap-2">
            {shortBreakOptions.map(opt => (
              <Button
                key={opt.key}
                size="sm"
                className={`w-full text-white ${isActive(opt.minutes, shortBreakMinutes) ? activeClass : inactiveClass}`}
                onClick={() => onSetShortBreakMinutes(opt.minutes)}
                disabled={isRunning}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Long Break */}
        {allowLongTimers && (
          <div className="space-y-3">
            <Label className="text-white text-sm font-medium">Long Break</Label>
            <div className="grid grid-cols-3 gap-2">
              {longBreakOptions.map(opt => (
                <Button
                  key={opt.key}
                  size="sm"
                  className={`w-full text-white ${isActive(opt.minutes, longBreakMinutes) ? activeClass : inactiveClass}`}
                  onClick={() => onSetLongBreakMinutes(opt.minutes)}
                  disabled={isRunning}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Toggles */}
        <div className="flex items-center justify-between pt-4 gap-6">
          <div className="flex items-center gap-2">
            <Label className="text-white text-sm font-medium">Enable Long Breaks</Label>
            <Switch
              checked={allowLongTimers}
              onCheckedChange={(v) => onSetAllowLongTimers(Boolean(v))}
              disabled={isRunning}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-white text-sm font-medium">Auto Start Pomodoros/Breaks</Label>
            <Switch
              checked={autoStartBreaks}
              onCheckedChange={(v) => onSetAutoStartBreaks(Boolean(v))}
              disabled={isRunning}
            />
          </div>
        </div>
      </CardContent>

      {/* Add Subject Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-800 border border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Add a new subject</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Enter subject name"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          <DialogFooter>
            <Button className="bg-gray-400/80 text-white hover:bg-[rgb(var(--accent-primary-rgb))]/50" onClick={handleAdd}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
});

export default SubjectPicker;
