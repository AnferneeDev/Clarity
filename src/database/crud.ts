// src/main/crud.ts
import { csvDb } from "./csvDb";

export function query<T = any>(table: string, where?: Record<string, any>, options: { orderBy?: string; limit?: number } = {}): T[] {
  let data: any[] = [];

  switch (table) {
    case "subjects":
      data = csvDb.getSubjects();
      break;
    case "todos":
      data = csvDb.getTodos();
      break;
    case "notes":
      data = csvDb.getNotes();
      break;
    case "settings":
      data = csvDb.getSettings();
      break;
    default:
      return [] as T[];
  }

  if (where && Object.keys(where).length > 0) {
    data = data.filter((item) => {
      return Object.entries(where).every(([key, value]) => item[key] == value);
    });
  }

  if (options.orderBy) {
    const [field, direction = "ASC"] = options.orderBy.split(" ");
    data.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal < bVal) return direction === "DESC" ? 1 : -1;
      if (aVal > bVal) return direction === "DESC" ? -1 : 1;
      return 0;
    });
  }

  if (options.limit) {
    data = data.slice(0, options.limit);
  }

  return data as T[];
}

export function insert(table: string, data: Record<string, any>): { id: number } {
  let id: number;

  switch (table) {
    case "subjects": {
      // This now correctly handles case-insensitive duplicates
      id = csvDb.addSubject(data.name);
      break;
    }
    case "todos": {
      const todoData = {
        date: data.date || "",
        text: data.text || "",
        done: data.done || 0,
        starred: data.starred || 0,
        due_date: data.due_date || null,
        created_at: data.created_at || new Date().toISOString(),
      };
      id = csvDb.addTodo(todoData);
      break;
    }
    case "notes": {
      const noteData = {
        title: data.title || "",
        content: data.content || null,
        color: data.color || null,
        created_at: data.created_at || new Date().toISOString(),
      };
      id = csvDb.addNote(noteData);
      break;
    }
    case "settings": {
      csvDb.setSetting(data.key, data.value);
      id = 0;
      break;
    }
    default:
      throw new Error(`Unknown table: ${table}`);
  }

  return { id };
}

export function update(table: string, id: number, data: Record<string, any>): boolean {
  switch (table) {
    case "subjects":
      return csvDb.updateSubject(id, data);
    case "todos":
      return csvDb.updateTodo(id, data);
    case "notes":
      return csvDb.updateNote(id, data);
    default:
      return false;
  }
}

export function remove(table: string, id: number): boolean {
  switch (table) {
    case "subjects":
      return csvDb.deleteSubject(id);
    case "todos":
      return csvDb.deleteTodo(id);
    case "notes":
      return csvDb.deleteNote(id);
    default:
      return false;
  }
}

export function setSetting(key: string, value: string): void {
  csvDb.setSetting(key, value);
}

export function getSetting(key: string): string | null {
  return csvDb.getSetting(key);
}
