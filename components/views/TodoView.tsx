import { useState, useEffect } from "react";
import { Plus, Calendar as CalendarIcon, Star, Trash2, Clock } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../Check";
import { Input } from "../ui/input";
import { Calendar as ShadCalendar } from "../ui/calendar";
import { TimePicker } from "../ui/timepicker";

interface Todo {
  id: string; // IPC sends as number, but we can treat as string/any or convert. 
              // dataService used string IDs for csv? storage.ts uses number. 
              // React keys need to handle this.
  text: string;
  done: boolean;
  dueDate?: string;
  starred: boolean;
}



function formatDateForDisplay(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function TodoView() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [editingDueFor, setEditingDueFor] = useState<string | null>(null);
  const [editingDueValue, setEditingDueValue] = useState<Date | null>(null);

  const getCurrentDate = () => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "numeric",
      month: "long",
    };
    return today.toLocaleDateString("en-US", options);
  };

  // Load todos from IPC
  const loadTodos = async () => {
    try {
      const allTodos = await window.electronAPI.getAllTodos();
      // Ensure data structure matches
      setTodos(allTodos.map((t: any) => ({
        id: String(t.id),
        text: t.text,
        done: t.done,
        starred: t.starred,
        dueDate: t.dueDate,
      })));
    } catch (err) {
      console.error("Failed to load todos", err);
    }
  };

  useEffect(() => {
    loadTodos();
  }, []);

  const addTask = async () => {
    if (!newTaskText.trim()) return;
    try {
      await window.electronAPI.addTodo({ text: newTaskText.trim() });
      setNewTaskText("");
      loadTodos();
    } catch (err) {
      console.error("Failed to add todo", err);
    }
  };

  const toggleTodo = async (idStr: string) => {
    const id = Number(idStr);
    const todo = todos.find(t => t.id === idStr);
    if (todo) {
      await window.electronAPI.updateTodo(id, { done: !todo.done });
      loadTodos();
    }
  };

  const toggleStar = async (idStr: string) => {
    const id = Number(idStr);
    const todo = todos.find(t => t.id === idStr);
    if (todo) {
      await window.electronAPI.updateTodo(id, { starred: !todo.starred });
      loadTodos();
    }
  };

  const deleteTodo = async (idStr: string) => {
    const id = Number(idStr);
    await window.electronAPI.deleteTodo(id);
    loadTodos();
  };

  const openDueEditor = (todo: Todo) => {
    setEditingDueFor(todo.id);
    if (todo.dueDate) {
      const d = new Date(todo.dueDate);
      if (!isNaN(d.getTime())) {
        setEditingDueValue(d);
      } else {
        setEditingDueValue(null);
      }
    } else {
      setEditingDueValue(null);
    }
  };

  const closeDueEditor = () => {
    setEditingDueFor(null);
    setEditingDueValue(null);
  };

  const saveDueDate = async (todoIdStr: string) => {
    const id = Number(todoIdStr);
    if (!editingDueValue) {
      await window.electronAPI.updateTodo(id, { dueDate: undefined });
    } else {
      await window.electronAPI.updateTodo(id, { dueDate: editingDueValue.toISOString() });
    }
    loadTodos();
    closeDueEditor();
  };

  // Sort: starred first, then incomplete, then completed
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    if (a.done && !b.done) return 1;
    if (!a.done && b.done) return -1;
    return 0;
  });

  return (

    <div className="w-full h-full flex flex-col p-2">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
          My Day
        </h1>
        <div className="text-sm text-white opacity-90">{getCurrentDate()}</div>
      </div>

      <div className="space-y-2 flex-1 overflow-auto break-words min-h-0">
        {sortedTodos.map((todo) => (
          <div key={todo.id} className="bg-white rounded-lg shadow-sm p-3 transition-all duration-200 hover:bg-gray-50 hover:shadow-md cursor-pointer group">
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={todo.done} 
                onChange={() => toggleTodo(todo.id)} 
                className="h-5 w-5 rounded-full border-2 border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" 
              />

              <div className="flex-1 min-w-0">
                <div className={`text-gray-900 font-medium ${todo.done ? "line-through opacity-60" : ""}`}>{todo.text}</div>

                <div className="flex items-center gap-3 mt-1">
                  {todo.dueDate && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                      <CalendarIcon className="w-3 h-3" />
                      {formatDateForDisplay(todo.dueDate)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 transition-all duration-200 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  onClick={() => openDueEditor(todo)}
                  title={todo.dueDate ? "Edit due date/time" : "Set due date/time"}
                >
                  <Clock className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 transition-all duration-200 font-medium ${todo.starred ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50" : "text-gray-400 hover:text-yellow-500 hover:bg-gray-100"}`}
                  onClick={() => toggleStar(todo.id)}
                >
                  <Star className={`h-4 w-4 ${todo.starred ? "fill-current" : ""}`} />
                </Button>

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 transition-all duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 font-medium" 
                  onClick={() => deleteTodo(todo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 input-glass-compact transition-all duration-200">
        <div className="flex items-center gap-3 h-full">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-800 hover:bg-gray-800/20 transition-colors font-medium" onClick={addTask}>
            <Plus className="h-4 w-4 stroke-2" />
          </Button>

          <div className="flex-1 h-full">
            <Input
              type="text"
              placeholder="Add a task"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addTask()}
              className="w-full h-full bg-transparent text-white placeholder:text-white/80 text-base font-medium focus:outline-none focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* Due date modal */}
      {editingDueFor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDueEditor} />

          <div className="relative z-50 max-w-3xl w-full mx-4">
            <div className="bg-black/60 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex flex-col md:flex-row gap-4 items-stretch">
                <div className="flex-shrink-0">
                  <ShadCalendar
                    mode="single"
                    selected={editingDueValue ?? undefined}
                    onSelect={(date) => setEditingDueValue(date ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), editingDueValue?.getHours() ?? 12, editingDueValue?.getMinutes() ?? 0, 0, 0) : null)}
                  />
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <TimePicker date={editingDueValue} setDate={setEditingDueValue} />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={closeDueEditor}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (editingDueFor !== null) saveDueDate(editingDueFor);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
