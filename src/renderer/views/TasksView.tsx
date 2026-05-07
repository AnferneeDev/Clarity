import { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { ListTodo, Plus, Star, Trash2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function TasksView() {
  const { tasks, isLoading, addTask, updateTask, deleteTask } = useTasks();
  const [newText, setNewText] = useState('');

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    await addTask(text, false, undefined);
    setNewText('');
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-white text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading tasks...
      </div>
    );
  }

  const activeTasks = tasks.filter(t => !t.done);
  const completedTasks = tasks.filter(t => t.done);

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6 overflow-auto">
      <div className="flex items-center gap-3 mb-4">
        <ListTodo className="w-6 h-6 text-white" />
        <h2 className="text-2xl font-bold text-white">Tasks</h2>
      </div>

      {/* Add task */}
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="Add a new task..."
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="bg-white/5 border-gray-600 text-white placeholder:text-gray-500 flex-1"
        />
        <Button onClick={handleAdd} className="bg-[#2a1636] hover:bg-[#3a2050] text-white">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Active tasks */}
      <div className="space-y-2 mb-6">
        {activeTasks.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No active tasks</p>
        ) : (
          activeTasks.map(task => (
            <Card key={task.id} className="glass-card bg-white/5 border-gray-700/30">
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <button
                  onClick={() => updateTask(task.id, { done: true })}
                  className="w-5 h-5 rounded-full border border-gray-500 hover:border-green-400 hover:bg-green-400/20 transition flex-shrink-0"
                />
                <span className="flex-1 text-white text-sm">{task.text}</span>
                <button
                  onClick={() => updateTask(task.id, { starred: !task.starred })}
                  className={`${task.starred ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'} transition`}
                >
                  <Star className="w-4 h-4" fill={task.starred ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-gray-600 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Completed */}
      {completedTasks.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-1">
            {completedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 py-1 px-2">
                <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-gray-500 line-through flex-1">{task.text}</span>
                <button
                  onClick={() => updateTask(task.id, { done: false })}
                  className="text-gray-600 hover:text-gray-400 text-xs"
                >
                  Undo
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-gray-600 hover:text-red-400 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
