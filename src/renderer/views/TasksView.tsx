import { useState } from 'react';
import { Calendar as CalendarIcon, Clock, Plus, Star, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as ShadCalendar } from '@/components/ui/calendar';
import { TimePicker } from '@/components/ui/timepicker';
import { useTasks } from '../hooks/useTasks';

function formatDueDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function getCurrentDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function TasksView() {
  const { tasks, isLoading, addTask, updateTask, deleteTask } = useTasks();
  const [newText, setNewText] = useState('');
  const [editingDueFor, setEditingDueFor] = useState<number | null>(null);
  const [editingDueValue, setEditingDueValue] = useState<Date | null>(null);

  const sorted = [...tasks].sort((a, b) => {
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    if (a.done && !b.done) return 1;
    if (!a.done && b.done) return -1;
    return 0;
  });

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    await addTask(text, false, undefined);
    setNewText('');
  };

  const openDueEditor = (task: typeof tasks[0]) => {
    setEditingDueFor(task.id);
    if (task.due_date) {
      const d = new Date(task.due_date);
      if (!isNaN(d.getTime())) setEditingDueValue(d);
      else setEditingDueValue(null);
    } else {
      setEditingDueValue(null);
    }
  };

  const saveDueDate = async () => {
    if (editingDueFor === null) return;
    const isoDate = editingDueValue?.toISOString() ?? null;
    window.electronAPI.app.log(`[TASKS] saveDueDate — local: ${editingDueValue?.toLocaleString() || 'null'} → ISO: ${isoDate}`);
    await updateTask(editingDueFor, { due_date: isoDate });
    setEditingDueFor(null);
    setEditingDueValue(null);
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center text-white text-sm">Loading tasks...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col p-2">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
          My Day
        </h1>
        <div className="text-sm text-white opacity-90">{getCurrentDate()}</div>
      </div>

      {/* Task list */}
      <div className="space-y-2 flex-1 overflow-auto min-h-0">
        {sorted.map(task => (
          <div
            key={task.id}
            className="bg-white rounded-lg shadow-sm p-3 transition-all duration-200 hover:bg-gray-50 hover:shadow-md cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              {/* Checkbox */}
              <button
                onClick={() => updateTask(task.id, { done: !task.done })}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition flex-shrink-0 ${
                  task.done
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                {task.done && <Check className="w-3 h-3 text-white" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className={`text-gray-900 font-medium ${task.done ? 'line-through opacity-60' : ''}`}>
                  {task.text}
                </div>
                {task.due_date && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 font-medium">
                    <CalendarIcon className="w-3 h-3" />
                    {formatDueDate(task.due_date)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => openDueEditor(task)}
                  title={task.due_date ? 'Edit due date' : 'Set due date'}
                >
                  <Clock className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 transition-colors ${task.starred ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50' : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100'}`}
                  onClick={() => updateTask(task.id, { starred: !task.starred })}
                >
                  <Star className={`h-4 w-4 ${task.starred ? 'fill-current' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  onClick={() => deleteTask(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add task bar */}
      <div className="mt-4 input-glass-compact">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-800 hover:bg-gray-800/20" onClick={handleAdd}>
            <Plus className="h-4 w-4 stroke-2" />
          </Button>
          <Input
            type="text"
            placeholder="Add a task"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="w-full bg-transparent text-white placeholder:text-white/80 text-base font-medium focus:outline-none focus:ring-0 border-none"
          />
        </div>
      </div>

      {/* Due date modal */}
      {editingDueFor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setEditingDueFor(null); setEditingDueValue(null); }} />
          <div className="relative z-50 max-w-3xl w-full mx-4">
            <div className="bg-black/60 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex flex-col md:flex-row gap-4 items-stretch">
                <div className="flex-shrink-0">
                  <ShadCalendar
                    mode="single"
                    selected={editingDueValue ?? undefined}
                    onSelect={date => {
                      if (date) {
                        setEditingDueValue(new Date(date.getFullYear(), date.getMonth(), date.getDate(), editingDueValue?.getHours() ?? 12, editingDueValue?.getMinutes() ?? 0));
                      }
                    }}
                  />
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <TimePicker date={editingDueValue} setDate={setEditingDueValue} />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => { setEditingDueFor(null); setEditingDueValue(null); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveDueDate}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
