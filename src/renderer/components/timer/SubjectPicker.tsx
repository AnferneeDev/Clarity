import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import TimerControls from './TimerControls';

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
  _onHideSubject?: (name: string) => Promise<void>;
  _onDeleteSubject?: (name: string) => Promise<void>;
  onSetFocusMinutes: (v: number) => void;
  onSetShortBreakMinutes: (v: number) => void;
  onSetLongBreakMinutes: (v: number) => void;
  onSetAllowLongTimers: (v: boolean) => void;
  onSetAutoStartBreaks: (v: boolean) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  className?: string;
}

export default function SubjectPicker({
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
  onSetFocusMinutes,
  onSetShortBreakMinutes,
  onSetLongBreakMinutes,
  onSetAllowLongTimers,
  onSetAutoStartBreaks,
  onStart,
  onPause,
  onReset,
  className,
}: SubjectPickerProps) {
  const [newSubject, setNewSubject] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const visibleSubjects = subjects.filter(s => !s.is_hidden);

  const handleAdd = async () => {
    const name = newSubject.trim();
    if (!name) return;
    await onAddSubject(name);
    setNewSubject('');
    setDialogOpen(false);
  };

  return (
    <Card className={`glass-card bg-white/5 border-gray-700/30 flex flex-col ${className ?? ''}`}>
      <CardContent className="flex-1 flex flex-col py-6 space-y-5 overflow-auto">
        {/* Subject chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-gray-400 uppercase tracking-wider">Subject</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="text-purple-400 hover:text-purple-300 h-6 px-2"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleSubjects.map(subj => (
              <button
                key={subj.id}
                onClick={() => onSelectSubject(subj.name)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  selectedSubject === subj.name
                    ? 'bg-[#2a1636] text-white border border-purple-500/30'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-transparent'
                }`}
              >
                {subj.name}
              </button>
            ))}
            {visibleSubjects.length === 0 && (
              <span className="text-sm text-gray-500">No subjects yet</span>
            )}
          </div>
        </div>

        {/* Timer settings */}
        <div className="space-y-3">
          <Label className="text-xs text-gray-400 uppercase tracking-wider">Timer Settings (min)</Label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-gray-500">Focus</Label>
              <Input
                type="number"
                min={1}
                max={allowLongTimers ? 999 : 120}
                value={focusMinutes}
                onChange={e => onSetFocusMinutes(Math.max(1, Number(e.target.value) || 25))}
                className="bg-white/5 border-gray-600 text-white text-sm h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Short</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={shortBreakMinutes}
                onChange={e => onSetShortBreakMinutes(Math.max(1, Number(e.target.value) || 5))}
                className="bg-white/5 border-gray-600 text-white text-sm h-8"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Long</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={longBreakMinutes}
                onChange={e => onSetLongBreakMinutes(Math.max(1, Number(e.target.value) || 15))}
                className="bg-white/5 border-gray-600 text-white text-sm h-8"
              />
            </div>
          </div>
        </div>

        {/* Switches */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-400">Allow long timers ({'>'}2h)</Label>
            <Switch checked={allowLongTimers} onCheckedChange={onSetAllowLongTimers} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-400">Auto-start breaks</Label>
            <Switch checked={autoStartBreaks} onCheckedChange={onSetAutoStartBreaks} />
          </div>
        </div>

        {/* Controls */}
        <TimerControls
          isRunning={isRunning}
          isPaused={false}
          selectedSubject={!!selectedSubject}
          onStart={onStart}
          onPause={onPause}
          onReset={onReset}
        />
      </CardContent>

      {/* Add Subject Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0a0810] border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Add Subject</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Subject name..."
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="bg-white/5 border-gray-600 text-white"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-600 text-white">
              Cancel
            </Button>
            <Button onClick={handleAdd} className="bg-[#2a1636] hover:bg-[#3a2050] text-white">
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
