import { useState, useEffect } from "react";
import { Plus, Calendar as CalendarIcon, Star, Trash2, Clock } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../Check";
import { Input } from "../ui/input";
import { Calendar as ShadCalendar } from "../ui/calendar";
import { TimePicker } from "../ui/timepicker"; // new component file (below)

interface Todo {
  id: number;
  text: string;
  done: boolean;
  due_date?: string | null;
  category?: string;
  starred: boolean;
}

interface Reminder {
  todoId: number;
  dueEpoch: number;
}

const LS_REMINDERS = "pomodoro:reminders";
const REMINDER_LIMIT = 20;

/* -------------------------
   Helper conversions
   ------------------------- */
function formatEpochForDisplay(epoch?: number) {
  if (!epoch) return "";
  const d = new Date(epoch);
  return d.toLocaleString();
}

function localDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* -------------------------
   localStorage helpers
   ------------------------- */
function loadRemindersFromLS(): Reminder[] {
  try {
    const raw = localStorage.getItem(LS_REMINDERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r) => ({
      todoId: Number(r.todoId),
      dueEpoch: Number(r.dueEpoch),
    }));
  } catch {
    return [];
  }
}

function saveRemindersToLS(list: Reminder[]) {
  try {
    localStorage.setItem(LS_REMINDERS, JSON.stringify(list));
  } catch {}
}

/* -------------------------
   Component
   ------------------------- */
export default function TodoView() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [editingDueFor, setEditingDueFor] = useState<number | null>(null);
  const [editingDueValue, setEditingDueValue] = useState<Date | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>(() => loadRemindersFromLS());

  const getCurrentDate = () => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "numeric",
      month: "long",
    };
    return today.toLocaleDateString("en-US", options);
  };
  const getTodayDateString = () => localDateString();

  // Load todos
  const loadTodos = async () => {
    try {
      const todosFromDb = (await window.electronAPI.getAllTodos()) as Todo[];
      setTodos(todosFromDb || []);
    } catch (error) {
      console.error("Failed to load todos:", error);
    }
  };

  const loadReminders = async () => {
    try {
      if (window.electronAPI && typeof window.electronAPI.listReminders === "function") {
        const list = (await window.electronAPI.listReminders()) as Array<{
          id: string;
          title?: string;
          body?: string;
          timestamp: number;
        }>;
        const mapped: Reminder[] = list
          .filter((r) => typeof r.id === "string" && r.id.startsWith("todo_") && Number.isFinite(Number(r.id.split("_")[1])))
          .map((r) => {
            const todoId = Number(r.id.split("_")[1]);
            const dueEpoch = Number(r.timestamp);
            return { todoId, dueEpoch };
          });
        if (mapped.length > 0) {
          setReminders(mapped);
          saveRemindersToLS(mapped);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to load reminders from main, falling back to localStorage", err);
    }
    const ls = loadRemindersFromLS();
    setReminders(ls);
  };

  useEffect(() => {
    loadTodos();
    loadReminders();
  }, []);

  // CRUD
  const addTask = async () => {
    if (!newTaskText.trim()) return;
    try {
      const today = getTodayDateString();
      await window.electronAPI.addTodo({
        date: today,
        text: newTaskText.trim(),
        starred: false,
      });
      setNewTaskText("");
      await loadTodos();
    } catch (err) {
      console.error("Failed to add todo:", err);
    }
  };

  const toggleTodo = async (id: number) => {
    try {
      const todo = todos.find((t) => t.id === id);
      if (todo) {
        await window.electronAPI.updateTodo(id, { done: !todo.done });
        await loadTodos();
      }
    } catch (err) {
      console.error("Failed to toggle todo:", err);
    }
  };

  const toggleStar = async (id: number) => {
    try {
      const todo = todos.find((t) => t.id === id);
      if (todo) {
        await window.electronAPI.updateTodo(id, { starred: !todo.starred });
        await loadTodos();
      }
    } catch (err) {
      console.error("Failed to star todo:", err);
    }
  };

  const deleteTodo = async (id: number) => {
    try {
      await window.electronAPI.deleteTodo(id);
      try {
        const rid = `todo_${id}`;
        await window.electronAPI.removeReminder(rid);
      } catch {}
      const next = reminders.filter((r) => r.todoId !== id);
      setReminders(next);
      saveRemindersToLS(next);
      await loadTodos();
    } catch (err) {
      console.error("Failed to delete todo:", err);
    }
  };

  // Due editor (open in centered modal)
  const openDueEditor = (todo: Todo) => {
    setEditingDueFor(todo.id);
    const r = reminders.find((x) => x.todoId === todo.id);
    if (r) {
      setEditingDueValue(new Date(r.dueEpoch));
    } else if (todo.due_date) {
      const d = new Date(todo.due_date);
      if (!Number.isNaN(d.getTime())) {
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

  const saveDueDate = async (todoId: number) => {
    try {
      if (!editingDueValue) {
        await window.electronAPI.updateTodo(todoId, { dueDate: null });
        try {
          const rid = `todo_${todoId}`;
          await window.electronAPI.removeReminder(rid);
        } catch {}
        const next = reminders.filter((r) => r.todoId !== todoId);
        setReminders(next);
        saveRemindersToLS(next);
        await loadTodos();
        closeDueEditor();
        return;
      }
      const epoch = editingDueValue.getTime();
      if (!Number.isFinite(epoch)) {
        alert("Invalid date/time");
        return;
      }
      const exists = reminders.some((r) => r.todoId === todoId);
      if (!exists && reminders.length >= REMINDER_LIMIT) {
        alert(`Max reminders reached (${REMINDER_LIMIT}). Remove one before adding a new reminder.`);
        return;
      }
      const iso = new Date(epoch).toISOString();
      await window.electronAPI.updateTodo(todoId, { dueDate: iso });

      try {
        const rid = `todo_${todoId}`;
        const todoObj = todos.find((t) => t.id === todoId);
        const title = todoObj?.text ? String(todoObj.text).slice(0, 120) : `Todo #${todoId}`;
        await window.electronAPI.addReminder({
          id: rid,
          title,
          body: "",
          timestamp: epoch,
        } as any);
      } catch (err) {
        console.warn("Failed to add reminder to main process:", err);
      }

      const next = reminders.some((r) => r.todoId === todoId) ? reminders.map((r) => (r.todoId === todoId ? { ...r, dueEpoch: epoch } : r)) : [...reminders, { todoId, dueEpoch: epoch }];

      setReminders(next);
      saveRemindersToLS(next);
      await loadTodos();
      closeDueEditor();
    } catch (err) {
      console.error("Failed to save due date:", err);
    }
  };

  // display conversion
  const formatDueDisplayFromTodo = (t: Todo) => {
    const r = reminders.find((x) => x.todoId === t.id);
    if (r) return formatEpochForDisplay(r.dueEpoch);
    if (t.due_date) {
      const d = new Date(t.due_date);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    }
    return "";
  };

  // Sort
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
        <h1 className="text-3xl font-bold text-white mb-1 text-semibold" style={{ fontFamily: "Segoe UI, system-ui, sans-serif" }}>
          My Day
        </h1>
        <div className="text-sm text-white opacity-90 text-medium">{getCurrentDate()}</div>
      </div>

      <div className="space-y-2 flex-1 overflow-auto break-words min-h-0">
        {sortedTodos.map((todo) => (
          <div key={todo.id} className="bg-white rounded-lg shadow-sm p-3 transition-all duration-200 hover:bg-gray-50 hover:shadow-md cursor-pointer group">
            <div className="flex items-center gap-3">
              <Checkbox checked={todo.done} onChange={() => toggleTodo(todo.id)} className="h-5 w-5 rounded-full border-2 border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />

              <div className="flex-1 min-w-0">
                <div className={`text-gray-900 text-medium ${todo.done ? "line-through opacity-60" : ""}`}>{todo.text}</div>

                <div className="flex items-center gap-3 mt-1">
                  {todo.category && <span className="text-xs text-gray-500 text-medium">{todo.category}</span>}
                  {formatDueDisplayFromTodo(todo) && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 text-medium">
                      <CalendarIcon className="w-3 h-3" />
                      {formatDueDisplayFromTodo(todo)}
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
                  title={todo.due_date ? "Edit due date/time" : "Set due date/time"}
                >
                  <Clock className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 transition-all duration-200 text-medium ${todo.starred ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50" : "text-gray-400 hover:text-yellow-500 hover:bg-gray-100"}`}
                  onClick={() => toggleStar(todo.id)}
                >
                  <Star className={`h-4 w-4 ${todo.starred ? "fill-current" : ""}`} />
                </Button>

                <Button variant="ghost" size="icon" className="h-7 w-7 transition-all duration-200 text-gray-400 hover:text-red-500 hover:bg-red-50 text-medium" onClick={() => deleteTodo(todo.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 input-glass-compact transition-all duration-200">
        <div className="flex items-center gap-3 h-full">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-800 hover:bg-gray-800/20 transition-colors text-medium" onClick={addTask}>
            <Plus className="h-4 w-4 stroke-2" />
          </Button>

          <div className="flex-1 h-full">
            <Input
              type="text"
              placeholder="Add a task"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addTask()}
              className="w-full h-full bg-transparent text-white placeholder:text-white/80 text-base text-medium focus:outline-none focus:ring-0"
            />
          </div>
        </div>
      </div>

      {/* Centered glass modal for calendar + time picker */}
      {editingDueFor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeDueEditor} />

          {/* Glass panel */}
          <div className="relative z-50 max-w-3xl w-full mx-4">
            <div className="bg-black/60 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-2xl">
              <div className="flex flex-col md:flex-row gap-4 items-stretch">
                {/* Calendar */}
                <div className="flex-shrink-0">
                  <ShadCalendar
                    mode="single"
                    selected={editingDueValue ?? undefined}
                    onSelect={(date) => setEditingDueValue(date ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), editingDueValue?.getHours() ?? 12, editingDueValue?.getMinutes() ?? 0, 0, 0) : null)}
                  />
                </div>

                {/* Floating time picker to the right */}
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
