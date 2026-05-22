import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Modal } from '@/components/ui/Modal';
import { useAccentColor } from '@/context/AccentColor';

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
  onAddSubject: (name: string) => void;
  onHideSubject: (name: string) => void;
  onSetFocusMinutes: (v: number) => void;
  onSetShortBreakMinutes: (v: number) => void;
  onSetLongBreakMinutes: (v: number) => void;
  onSetAllowLongTimers: (v: boolean) => void;
  onSetAutoStartBreaks: (v: boolean) => void;
}

const FOCUS_PRESETS = [25, 30, 50, 60, 70, 90];
const SHORT_PRESETS = [5, 10, 20];
const LONG_PRESETS = [15, 20, 30];

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
  onHideSubject,
  onSetFocusMinutes,
  onSetShortBreakMinutes,
  onSetLongBreakMinutes,
  onSetAllowLongTimers,
  onSetAutoStartBreaks,
}: SubjectPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const { accentColor } = useAccentColor();

  const visibleSubjects = subjects.filter(s => !s.is_hidden);

  const handleAdd = () => {
    const name = newSubject.trim();
    if (!name) return;
    onAddSubject(name);
    setNewSubject('');
    setDialogOpen(false);
  };

  const renderPresetButtons = (presets: number[], current: number, onSet: (v: number) => void) => (
    <View className="flex-row flex-wrap gap-2">
      {presets.map(m => (
        <TouchableOpacity
          key={m}
          className={`px-3 py-1.5 rounded-lg ${current === m ? '' : 'bg-white/10'}`}
          style={current === m ? { backgroundColor: accentColor } : undefined}
          onPress={() => onSet(m)}
        >
          <Text className={`text-white text-sm font-medium ${current === m ? '' : 'text-white/80'}`}>
            {m}m
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View className="bg-white/5 border border-gray-700/30 rounded-2xl p-4">
      {isRunning && (
        <View className="absolute inset-0 bg-black/40 z-10 rounded-2xl items-center justify-center">
          <Text className="text-white/80 text-sm">Timer is running</Text>
        </View>
      )}

      <Text className="text-white text-lg font-semibold mb-3">Subjects</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {visibleSubjects.map(s => (
          <View key={s.id} className="relative">
            <TouchableOpacity
              className="px-4 py-2 rounded-lg"
              style={{ backgroundColor: selectedSubject === s.name ? accentColor : 'rgba(255,255,255,0.1)' }}
              onPress={() => onSelectSubject(s.name)}
            >
              <Text className="text-white font-medium">{s.name}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center"
              onPress={() => onHideSubject(s.name)}
            >
              <X size={12} color="white" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          className="px-4 py-2 rounded-lg bg-white/10 border border-gray-700/30 border-dashed"
          onPress={() => setDialogOpen(true)}
        >
          <Plus size={18} color="#a78bfa" />
        </TouchableOpacity>
      </View>

      <Text className="text-white text-lg font-semibold mb-2">Focus Duration</Text>
      {renderPresetButtons(FOCUS_PRESETS, focusMinutes, onSetFocusMinutes)}

      <Text className="text-white text-lg font-semibold mt-4 mb-2">Short Break</Text>
      {renderPresetButtons(SHORT_PRESETS, shortBreakMinutes, onSetShortBreakMinutes)}

      {allowLongTimers && (
        <>
          <Text className="text-white text-lg font-semibold mt-4 mb-2">Long Break</Text>
          {renderPresetButtons(LONG_PRESETS, longBreakMinutes, onSetLongBreakMinutes)}
        </>
      )}

      <View className="mt-4 gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-white/80 text-sm">Enable Long Breaks</Text>
          <Switch checked={allowLongTimers} onCheckedChange={onSetAllowLongTimers} />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-white/80 text-sm">Auto Start Pomodoros/Breaks</Text>
          <Switch checked={autoStartBreaks} onCheckedChange={onSetAutoStartBreaks} />
        </View>
      </View>

      <Modal visible={dialogOpen} onClose={() => { setDialogOpen(false); setNewSubject(''); }} title="Add Subject">
        <Input
          placeholder="Subject name..."
          value={newSubject}
          onChangeText={setNewSubject}
          onSubmitEditing={handleAdd}
          autoFocus
        />
        <Button className="mt-3" onPress={handleAdd}>
          Add Subject
        </Button>
      </Modal>
    </View>
  );
}
