// src/main/csvDb.ts
import { app } from "electron";
import fs from "fs";
import path from "path";
import Papa from "papaparse";

export interface Subject {
  id: number;
  name: string;
  created_at: string;
}

export interface Todo {
  id: number;
  date: string;
  text: string;
  done: number;
  starred: number;
  due_date?: string;
  created_at: string;
}

export interface Note {
  id: number;
  title: string;
  content?: string;
  color?: string;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

class CsvDatabase {
  private basePath: string;

  constructor() {
    this.basePath = app.getPath("userData");
    this.ensureFilesExist();
  }

  private ensureFilesExist() {
    const files = {
      "subjects.csv": "id,name,created_at",
      "todos.csv": "id,date,text,done,starred,due_date,created_at",
      "notes.csv": "id,title,content,color,created_at",
      "settings.csv": "key,value",
    };

    Object.entries(files).forEach(([filename, headers]) => {
      const filePath = path.join(this.basePath, filename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, headers);
      }
    });
  }

  private readCSV<T>(filename: string): T[] {
    try {
      const filePath = path.join(this.basePath, filename);
      if (!fs.existsSync(filePath)) return [];

      const csvString = fs.readFileSync(filePath, "utf8");
      const result = Papa.parse<T>(csvString, {
        header: true,
        skipEmptyLines: true,
      });

      return result.data.map((row) => {
        const converted: any = { ...row };
        if ("id" in converted) converted.id = Number(converted.id);
        if ("subject_id" in converted && converted.subject_id) converted.subject_id = Number(converted.subject_id);
        if ("done" in converted) converted.done = Number(converted.done);
        if ("starred" in converted) converted.starred = Number(converted.starred);
        return converted;
      });
    } catch (error) {
      console.error(`Error reading ${filename}:`, error);
      return [];
    }
  }

  public writeCSV<T>(filename: string, data: T[]): void {
    const filePath = path.join(this.basePath, filename);
    const tempFilePath = `${filePath}.tmp`;
    const backupFilePath = `${filePath}.bak`;

    try {
      const csvString = Papa.unparse(data);
      fs.writeFileSync(tempFilePath, csvString, "utf8");
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, backupFilePath);
      }
      fs.renameSync(tempFilePath, filePath);
    } catch (error) {
      console.error(`CRITICAL WRITE ERROR for ${filename}:`, error);
      try {
        if (fs.existsSync(backupFilePath)) {
          fs.renameSync(backupFilePath, filePath);
        }
      } catch (restoreError) {
        console.error(`FATAL: Could not restore backup for ${filename}:`, restoreError);
      }
      throw error;
    }
  }

  private getNextId<T extends { id: number }>(data: T[]): number {
    if (data.length === 0) return 1;
    return Math.max(...data.map((item) => item.id)) + 1;
  }

  // Subjects
  getSubjects(): Subject[] {
    return this.readCSV<Subject>("subjects.csv");
  }

  addSubject(name: string): number {
    const subjects = this.getSubjects();
    const normalizedName = name.trim().toLowerCase();

    // Check if a subject with the same name (case-insensitive) already exists
    const existing = subjects.find((s) => s.name.toLowerCase() === normalizedName);
    if (existing) {
      console.log(`Subject "${name}" already exists with ID ${existing.id}. Returning existing ID.`);
      return existing.id; // Return the ID of the existing subject to prevent duplicates
    }

    // If no duplicate is found, create a new one
    const id = this.getNextId(subjects);
    const newSubject: Subject = {
      id,
      name: name.trim(), // Save with original casing
      created_at: new Date().toISOString(),
    };
    subjects.push(newSubject);
    this.writeCSV("subjects.csv", subjects);
    return id;
  }

  updateSubject(id: number, updates: Partial<Omit<Subject, "id">>): boolean {
    const subjects = this.getSubjects();
    const index = subjects.findIndex((subject) => subject.id === id);
    if (index === -1) return false;
    subjects[index] = { ...subjects[index], ...updates };
    this.writeCSV("subjects.csv", subjects);
    return true;
  }

  deleteSubject(id: number): boolean {
    const subjects = this.getSubjects();
    const filtered = subjects.filter((subject) => subject.id !== id);
    if (filtered.length === subjects.length) return false;
    this.writeCSV("subjects.csv", filtered);
    return true;
  }

  // Todos
  getTodos(): Todo[] {
    return this.readCSV<Todo>("todos.csv");
  }

  addTodo(todo: Omit<Todo, "id">): number {
    const todos = this.getTodos();
    const id = this.getNextId(todos);
    const newTodo: Todo = { ...todo, id } as Todo;
    todos.push(newTodo);
    this.writeCSV("todos.csv", todos);
    return id;
  }

  updateTodo(id: number, updates: Partial<Omit<Todo, "id">>): boolean {
    const todos = this.getTodos();
    const index = todos.findIndex((todo) => todo.id === id);
    if (index === -1) return false;
    todos[index] = { ...todos[index], ...updates };
    this.writeCSV("todos.csv", todos);
    return true;
  }

  deleteTodo(id: number): boolean {
    const todos = this.getTodos();
    const filtered = todos.filter((todo) => todo.id !== id);
    if (filtered.length === todos.length) return false;
    this.writeCSV("todos.csv", filtered);
    return true;
  }

  // Notes
  getNotes(): Note[] {
    return this.readCSV<Note>("notes.csv");
  }

  addNote(note: Omit<Note, "id">): number {
    const notes = this.getNotes();
    const id = this.getNextId(notes);
    const newNote: Note = { ...note, id } as Note;
    notes.push(newNote);
    this.writeCSV("notes.csv", notes);
    return id;
  }

  updateNote(id: number, updates: Partial<Omit<Note, "id">>): boolean {
    const notes = this.getNotes();
    const index = notes.findIndex((note) => note.id === id);
    if (index === -1) return false;
    notes[index] = { ...notes[index], ...updates };
    this.writeCSV("notes.csv", notes);
    return true;
  }

  deleteNote(id: number): boolean {
    const notes = this.getNotes();
    const filtered = notes.filter((note) => note.id !== id);
    if (filtered.length === notes.length) return false;
    this.writeCSV("notes.csv", filtered);
    return true;
  }

  // Settings
  getSettings(): Setting[] {
    return this.readCSV<Setting>("settings.csv");
  }

  setSetting(key: string, value: string): void {
    const settings = this.getSettings();
    const index = settings.findIndex((setting) => setting.key === key);
    if (index === -1) {
      settings.push({ key, value });
    } else {
      settings[index].value = value;
    }
    this.writeCSV("settings.csv", settings);
  }

  getSetting(key: string): string | null {
    const settings = this.getSettings();
    const setting = settings.find((s) => s.key === key);
    return setting?.value ?? null;
  }
}

export const csvDb = new CsvDatabase();
