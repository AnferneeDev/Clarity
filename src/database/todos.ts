// src/main/todos.ts
import { query, insert, update, remove } from "./crud";

export function getTodosByDate(date: string) {
  // Now simply returns the todos without any subject joining.
  return query("todos", { date }, { orderBy: "starred DESC, id" });
}

export function addTodo(todo: { date: string; text: string; starred?: boolean; dueDate?: string }) {
  // No longer accepts subjectId.
  const result = insert("todos", {
    date: todo.date,
    text: todo.text,
    done: 0,
    starred: todo.starred ? 1 : 0,
    due_date: todo.dueDate || null,
    created_at: new Date().toISOString(),
  });

  return { success: true, id: result.id };
}

export function updateTodo(
  id: number,
  updates: {
    done?: boolean;
    starred?: boolean;
    text?: string;
    dueDate?: string;
  }
) {
  const updateData: any = {};

  if (updates.done !== undefined) updateData.done = updates.done ? 1 : 0;
  if (updates.starred !== undefined) updateData.starred = updates.starred ? 1 : 0;
  if (updates.text !== undefined) updateData.text = updates.text;
  if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;

  return update("todos", id, updateData);
}

export function deleteTodo(id: number) {
  return remove("todos", id);
}

export function getStarredTodos() {
  // Now simply returns the starred todos without any subject joining.
  return query("todos", { starred: 1 }, { orderBy: "id" });
}

// Notes functions
export function getNotes() {
  return query("notes", {}, { orderBy: "created_at DESC" });
}

export function getNoteById(id: number) {
  const notes = query("notes", { id });
  return notes.length > 0 ? notes[0] : null;
}

export function addNote(note: { title: string; content?: string; color?: string }) {
  const result = insert("notes", {
    title: note.title,
    content: note.content || null,
    color: note.color || null,
    created_at: new Date().toISOString(),
  });

  return { success: true, id: result.id };
}

export function updateNote(id: number, updates: { title?: string; content?: string; color?: string }) {
  return update("notes", id, updates);
}

export function deleteNote(id: number) {
  return remove("notes", id);
}

// ... getTodosByDate and other functions are unchanged ...

// ✨ ADD THIS NEW FUNCTION ✨
export function getAllTodos() {
  // Queries all todos without a date filter, just like NotesView does.
  return query("todos", {}, { orderBy: "starred DESC, id" });
}
