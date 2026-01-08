/**
 * Mock Data Service
 * 
 * Temporary localStorage-based data layer.
 * This will be replaced by Supabase client once the frontend is polished.
 * 
 * SCHEMA (matches future Supabase tables):
 * - subjects: { id, name, createdAt }
 * - timerSessions: { id, subjectId, date, minutes, createdAt }
 * - todos: { id, text, done, starred, dueDate, createdAt }
 * - notes: { id, title, content, color, createdAt }
 * - settings: { key, value }
 */

// ============================================
// Types (will match Supabase schema)
// ============================================

export interface Subject {
  id: string;
  name: string;
  createdAt: string;
}

export interface TimerSession {
  id: string;
  subjectId: string;
  subjectName: string;
  date: string; // YYYY-MM-DD
  minutes: number;
  createdAt: string;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
  starred: boolean;
  dueDate?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  createdAt: string;
}

export interface AppSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
}

// ============================================
// Storage Keys
// ============================================

const KEYS = {
  SUBJECTS: "clarity_v2_subjects",
  SESSIONS: "clarity_v2_sessions",
  TODOS: "clarity_v2_todos",
  NOTES: "clarity_v2_notes",
  SETTINGS: "clarity_v2_settings",
  BACKGROUNDS: "clarity_v2_backgrounds",
} as const;

// ============================================
// Helpers
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getLocalDateString(date = new Date()): string {
  return date.toISOString().split("T")[0];
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ============================================
// Subjects
// ============================================

export function getSubjects(): Subject[] {
  return loadFromStorage<Subject[]>(KEYS.SUBJECTS, []);
}

export function addSubject(name: string): Subject {
  const subjects = getSubjects();
  const normalized = name.trim().toLowerCase();
  
  // Check for duplicate (case-insensitive)
  const existing = subjects.find(s => s.name.toLowerCase() === normalized);
  if (existing) return existing;
  
  const newSubject: Subject = {
    id: generateId(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  
  subjects.push(newSubject);
  saveToStorage(KEYS.SUBJECTS, subjects);
  return newSubject;
}

export function deleteSubject(id: string): boolean {
  const subjects = getSubjects();
  const filtered = subjects.filter(s => s.id !== id);
  if (filtered.length === subjects.length) return false;
  
  saveToStorage(KEYS.SUBJECTS, filtered);
  
  // Also delete related sessions
  const sessions = getTimerSessions();
  saveToStorage(KEYS.SESSIONS, sessions.filter(s => s.subjectId !== id));
  
  return true;
}

// ============================================
// Timer Sessions
// ============================================

export function getTimerSessions(): TimerSession[] {
  return loadFromStorage<TimerSession[]>(KEYS.SESSIONS, []);
}

export function addTimerMinutes(subjectName: string, minutes: number, date?: string): TimerSession {
  const sessions = getTimerSessions();
  const targetDate = date || getLocalDateString();
  
  // Ensure subject exists
  const subject = addSubject(subjectName);
  
  // Find existing session for this subject+date
  const existing = sessions.find(
    s => s.subjectId === subject.id && s.date === targetDate
  );
  
  if (existing) {
    existing.minutes += minutes;
    saveToStorage(KEYS.SESSIONS, sessions);
    return existing;
  }
  
  // Create new session
  const newSession: TimerSession = {
    id: generateId(),
    subjectId: subject.id,
    subjectName: subject.name,
    date: targetDate,
    minutes,
    createdAt: new Date().toISOString(),
  };
  
  sessions.push(newSession);
  saveToStorage(KEYS.SESSIONS, sessions);
  return newSession;
}

export function getSessionsByDateRange(startDate: string, endDate: string): TimerSession[] {
  return getTimerSessions().filter(s => s.date >= startDate && s.date <= endDate);
}

export function getSubjectTotals(): Record<string, number> {
  const sessions = getTimerSessions();
  const totals: Record<string, number> = {};
  
  sessions.forEach(s => {
    totals[s.subjectName] = (totals[s.subjectName] || 0) + s.minutes;
  });
  
  return totals;
}

// ============================================
// Todos
// ============================================

export function getTodos(): Todo[] {
  return loadFromStorage<Todo[]>(KEYS.TODOS, []);
}

export function addTodo(text: string, dueDate?: string): Todo {
  const todos = getTodos();
  
  const newTodo: Todo = {
    id: generateId(),
    text: text.trim(),
    done: false,
    starred: false,
    dueDate,
    createdAt: new Date().toISOString(),
  };
  
  todos.push(newTodo);
  saveToStorage(KEYS.TODOS, todos);
  return newTodo;
}

export function updateTodo(id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>): Todo | null {
  const todos = getTodos();
  const todo = todos.find(t => t.id === id);
  if (!todo) return null;
  
  Object.assign(todo, updates);
  saveToStorage(KEYS.TODOS, todos);
  return todo;
}

export function deleteTodo(id: string): boolean {
  const todos = getTodos();
  const filtered = todos.filter(t => t.id !== id);
  if (filtered.length === todos.length) return false;
  
  saveToStorage(KEYS.TODOS, filtered);
  return true;
}

// ============================================
// Notes
// ============================================

export function getNotes(): Note[] {
  return loadFromStorage<Note[]>(KEYS.NOTES, []);
}

export function addNote(title = "Untitled", content = "", color = "#fef08a"): Note {
  const notes = getNotes();
  
  const newNote: Note = {
    id: generateId(),
    title,
    content,
    color,
    createdAt: new Date().toISOString(),
  };
  
  notes.push(newNote);
  saveToStorage(KEYS.NOTES, notes);
  return newNote;
}

export function updateNote(id: string, updates: Partial<Omit<Note, "id" | "createdAt">>): Note | null {
  const notes = getNotes();
  const note = notes.find(n => n.id === id);
  if (!note) return null;
  
  Object.assign(note, updates);
  saveToStorage(KEYS.NOTES, notes);
  return note;
}

export function deleteNote(id: string): boolean {
  const notes = getNotes();
  const filtered = notes.filter(n => n.id !== id);
  if (filtered.length === notes.length) return false;
  
  saveToStorage(KEYS.NOTES, filtered);
  return true;
}

// ============================================
// Settings
// ============================================

const DEFAULT_SETTINGS: AppSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
};

export function getSettings(): AppSettings {
  return loadFromStorage<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const settings = { ...getSettings(), ...updates };
  saveToStorage(KEYS.SETTINGS, settings);
  return settings;
}

// ============================================
// Backgrounds
// ============================================

type ViewType = "timer" | "stats" | "settings" | "todo" | "notes";

export function getBackgrounds(): Record<ViewType, string> {
  return loadFromStorage<Record<ViewType, string>>(KEYS.BACKGROUNDS, {
    timer: "",
    stats: "",
    settings: "",
    todo: "",
    notes: "",
  });
}

export function setBackground(view: ViewType, dataUrl: string): void {
  const backgrounds = getBackgrounds();
  backgrounds[view] = dataUrl;
  saveToStorage(KEYS.BACKGROUNDS, backgrounds);
}

export function removeBackground(view: ViewType): void {
  setBackground(view, "");
}

// ============================================
// Export all for easy import
// ============================================

const dataService = {
  // Subjects
  getSubjects,
  addSubject,
  deleteSubject,
  
  // Timer Sessions
  getTimerSessions,
  addTimerMinutes,
  getSessionsByDateRange,
  getSubjectTotals,
  
  // Todos
  getTodos,
  addTodo,
  updateTodo,
  deleteTodo,
  
  // Notes
  getNotes,
  addNote,
  updateNote,
  deleteNote,
  
  // Settings
  getSettings,
  updateSettings,
  
  // Backgrounds
  getBackgrounds,
  setBackground,
  removeBackground,
};

export default dataService;
