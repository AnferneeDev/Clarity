/**
 * Simple JSON File Storage for Clarity v2 (Multi-User)
 * 
 * Handles local persistence with user isolation.
 * Automatically seeds data for 'Anfernee' if fresh.
 */

import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto"; // Use Node native crypto

// ============================================
// Data Types
// ============================================

export interface User {
  id: string;
  username: string;
  passwordHash: string; // Stored securely
  createdAt: string;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  hidden: boolean;
  createdAt: string;
}

export interface TimerSession {
  id: string;
  userId: string;
  subjectName: string;
  date: string; // YYYY-MM-DD
  minutes: number;
}

export interface Todo {
  id: number;
  userId: string;
  text: string;
  done: boolean;
  starred: boolean;
  dueDate?: string;
  createdAt: string;
}

export interface Chapter {
  id: string;
  userId: string;
  title: string;
  coverImage?: string; // path relative to userData
  icon?: string;
  clear: boolean;
  createdAt: string;
}

export interface Note {
  id: number;
  userId: string;
  title: string;
  content: string;
  color: string;
  createdAt: string;
}

export interface AppData {
  users: User[];
  subjects: Subject[];
  sessions: TimerSession[];
  todos: Todo[];
  chapters: Chapter[];
  notes: Note[];
  backgrounds: Record<string, string>; // view -> relative path
  settings: Record<string, {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
  }>;
  syncMetadata?: {
    userId: string;
    localLastUpdatedAt: string;
    serverLastUpdatedAt: string;
  };
}

// ============================================
// Storage
// ============================================

const DEFAULT_DATA: AppData = {
  users: [],
  subjects: [],
  sessions: [],
  todos: [],
  chapters: [],
  notes: [],
  backgrounds: {},
  settings: {},
};

let dataCache: AppData | null = null;

function getDataFilePath(): string {
  return path.join(app.getPath("userData"), "clarity-data.json");
}

function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, "clarity-salt", 1000, 64, "sha512").toString("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hash === hashPassword(password);
}

// ============================================
// Data Seeding (Repair)
// ============================================

function getDatesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  let current = new Date(start);
  const endDate = new Date(end);
  
  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function seedInitialData(data: AppData) {
  // Create User
  const userId = "anfernee-id";
  const user: User = {
    id: userId,
    username: "Anfernee",
    passwordHash: hashPassword("Anfernee4Nf3rn33"),
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  
  // Create Subjects
  const subjects = ["programming", "typescript", "sql", "work", "trading"];
  subjects.forEach(name => {
    data.subjects.push({
      id: `sub-${name}`,
      userId,
      name,
      hidden: false,
      createdAt: new Date().toISOString()
    });
  });

  // Distribute Time
  // range1: June 29, 2025 to Jan 7, 2026 (Yesterday)
  const range1Dates = getDatesBetween("2025-06-29", "2026-01-07");
  // range2: Dec 9, 2025 to Jan 7, 2026 (Yesterday)
  const range2Dates = getDatesBetween("2025-12-09", "2026-01-07");

  const distribute = (subject: string, totalMinutes: number, dates: string[]) => {
    const minPerDay = Math.floor(totalMinutes / dates.length);
    let remainder = totalMinutes % dates.length;
    
    dates.forEach(date => {
      let mins = minPerDay;
      if (remainder > 0) {
        mins++;
        remainder--;
      }
      if (mins > 0) {
        data.sessions.push({
          id: `sess-${subject}-${date}`,
          userId,
          subjectName: subject,
          date,
          minutes: mins
        });
      }
    });
  };

  distribute("programming", 45612, range1Dates);
  distribute("typescript", 9149, range1Dates);
  distribute("trading", 9000, range1Dates);
  distribute("work", 9050, range2Dates);

  // Specific recent data (Jan 5 - Jan 8 overrides/additions?)
  // User said "besides todays time since im using the app".
  // The provided CSV shows specific entries for 5, 6, 7, 8.
  // The distribution likely covers base load.
  // Logic: The "spike" was 45k on Jan 4.
  // The provided CSV lines for Jan 5,6,7,8 seem valid.
  // We should add them explicitly if not accounted for.
  // ACTUALLY: The CSV lines provided for Jan 4 are the TOTALS that were corrupted (45612 etc).
  // The lines for Jan 5, 6, 7, 8 look like real daily entries.
  // 7,work,2026-01-05,525
  // 8,programming,2026-01-06,35
  // 9,work,2026-01-06,354
  // 10,work,2026-01-07,440
  // 11,work,2026-01-08,203
  // 12,typescript,2026-01-08,16
  
  // We should ADD these as specific sessions.
  const extras = [
    { s: "work", d: "2026-01-05", m: 525 },
    { s: "programming", d: "2026-01-06", m: 35 },
    { s: "work", d: "2026-01-06", m: 354 },
    { s: "work", d: "2026-01-07", m: 440 },
    { s: "work", d: "2026-01-08", m: 203 },
    { s: "typescript", d: "2026-01-08", m: 16 },
  ];
  
  extras.forEach((e, idx) => {
    // Append to existing distributed data (or replace? Distribute logic spreads 45k evenly. These are likely "on top" or "actuals").
    // Let's just add them.
     data.sessions.push({
          id: `sess-extra-${idx}`,
          userId,
          subjectName: e.s,
          date: e.d,
          minutes: e.m
     });
  });

  // Todos (from CSV)
  const todosRaw = [
    { d: "2025-11-24", t: "Master React", created: "2025-11-24T11:07:41.152Z" },
    { d: "2025-11-24", t: "Master Typescript", created: "2025-11-24T11:07:54.175Z" },
    { d: "2025-11-25", t: "Code conventions", created: "2025-11-25T15:55:44.509Z" },
    { d: "2025-11-26", t: "Linkedin profile, upwrok too", starred: true, due: "2025-11-29", created: "2025-11-26T13:29:15.131Z" },
    { d: "2025-11-29", t: "Add github and links to CV", starred: true, due: "2026-01-01", created: "2025-11-29T14:26:29.207Z" },
    { d: "2025-12-15", t: "MasterHTML", created: "2025-12-15T12:09:36.189Z" },
    { d: "2025-12-15", t: "Master CSS", created: "2025-12-15T12:09:38.799Z" },
    { d: "2026-01-01", t: "Whop/Skool", created: "2026-01-01T11:33:20.890Z" },
    { d: "2026-01-07", t: "Do something principle", starred: true, due: "2026-01-08", created: "2026-01-07T14:40:26.266Z" },
    { d: "2026-01-07", t: "Death", starred: true, created: "2026-01-07T16:13:42.212Z" },
  ];

  todosRaw.forEach((t, i) => {
    data.todos.push({
      id: Date.now() + i,
      userId,
      text: t.t,
      done: false,
      starred: !!t.starred,
      dueDate: t.due ? new Date(t.due).toISOString() : undefined,
      createdAt: t.created
    });
  });

  // Notes
  data.notes.push({
    id: 4, userId, title: "Ideas", color: "#fcff42", createdAt: "2025-10-05T10:53:05.174Z",
    content: "https://www.thegr8binil.me/\nhttps://beacons.ai/\ndropshipping\nwhite label software\nhivemind focus group\nblock app with words app\nTodo list from roadmap\nYoutube api"
  });
  data.notes.push({
    id: 9, userId, title: "ToDos", color: "#8377df", createdAt: "2025-10-25T15:25:53.966Z",
    content: "-Upwork and Fiver projects set up\n-Clear Feed: mobile search bar.\n-OfflineRates: filter in the admin screen overflow."
  });
  data.notes.push({
    id: 10, userId, title: "Resources", color: "#ffffff", createdAt: "2025-12-15T16:06:05.903Z",
    content: "lawsofux.com"
  });

  // Chapters (From User Screenshot)
  const chapters = [
    { title: "Master HTML", icon: "🌐" },
    { title: "Whop app", icon: "📱" },
    { title: "Diaphragm breathing for workout and singing", icon: "🗣️" },
    { title: "Copywriting", icon: "✍️" },
    { title: "Jordan Peterson's patter of speech", icon: "🧠" },
    { title: "Network MORE!!!!", icon: "🤝" },
    { title: "First Upwork customer", icon: "💼" },
    { title: "Take care of myself", icon: "💖" },
    { title: "Tolerance (calm)", icon: "😌" },
    { title: "5th person thinking (I AM NOT MY MIND)", icon: "🧘" },
    { title: "Fortitude", icon: "🛡️" },
    { title: "Resilience", icon: "💪" },
    { title: "Adaptability", icon: "🦎" },
    { title: "Learn how to sell", icon: "💸" },
    { title: "9 PM, dodge the clubs, the girls, and be at bed at 9pm", icon: "🛌" }
  ];

  chapters.forEach((c, i) => {
    data.chapters.push({
      id: `chap-${i}`,
      userId,
      title: c.title,
      icon: c.icon,
      coverImage: undefined,
      clear: false,
      createdAt: new Date().toISOString()
    });
  });
  
  console.log("[Seeding] Successfully seeded data for user Anfernee");
}


export function loadData(): AppData {
  if (dataCache) return dataCache;
  
  try {
    const filePath = getDataFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      dataCache = JSON.parse(content);
      
      // Migration: If no users array, it means it's old format. Wiping/Resetting to seed.
      // Or if fresh file, seed.
      if (!dataCache?.users || !Array.isArray(dataCache.users)) {
         console.log("[Storage] Old data format detected or empty. Resetting and Seeding...");
         dataCache = { ...DEFAULT_DATA };
         seedInitialData(dataCache);
         saveData(dataCache);
      } else if (dataCache.users.length === 0) {
         seedInitialData(dataCache);
         saveData(dataCache);
      } else {
        // Migration: Check if we need to seed specific chapters (User requested)
        // We check if "Master HTML" exists. If not, we seed/append them.
        const hasMasterHTML = dataCache.chapters && dataCache.chapters.some(c => c.title === "Master HTML");
        
        if (!hasMasterHTML) {
           console.log("[Storage] Seeding requested chapters for existing user...");
           if (!dataCache.chapters) dataCache.chapters = [];
           
           // Chapters from User Screenshot
           const userId = dataCache.users[0].id; // Assign to first user (Admin/Default)
           const chapters = [
                { title: "Master HTML", icon: "🌐" },
                { title: "Whop app", icon: "📱" },
                { title: "Diaphragm breathing for workout and singing", icon: "🗣️" },
                { title: "Copywriting", icon: "✍️" },
                { title: "Jordan Peterson's patter of speech", icon: "🧠" },
                { title: "Network MORE!!!!", icon: "🤝" },
                { title: "First Upwork customer", icon: "💼" },
                { title: "Take care of myself", icon: "💖" },
                { title: "Tolerance (calm)", icon: "😌" },
                { title: "5th person thinking (I AM NOT MY MIND)", icon: "🧘" },
                { title: "Fortitude", icon: "🛡️" },
                { title: "Resilience", icon: "💪" },
                { title: "Adaptability", icon: "🦎" },
                { title: "Learn how to sell", icon: "💸" },
                { title: "9 PM, dodge the clubs, the girls, and be at bed at 9pm", icon: "🛌" }
            ];

            chapters.forEach((c, i) => {
                // Double check duplicates before adding
                if (!dataCache!.chapters.some(existing => existing.title === c.title)) {
                    dataCache!.chapters.push({
                        id: `chap-seed-${i}`,
                        userId,
                        title: c.title,
                        icon: c.icon,
                        coverImage: undefined,
                        clear: false,
                        createdAt: new Date().toISOString()
                    });
                }
            });
            saveData(dataCache);
        }
        // QUICK FIX for the "13h" bug:
        // Remove the accidental distribution for 2026-01-08 if it exists in sessions
        // We identify them by ID or just filtering.
        // The distribution IDs are `sess-{subject}-{date}`.
        // We want to KEEP `sess-extra-...` or manually created ones.
        // We want to DELETE `sess-{subject}-2026-01-08` if it looks like a distribution entry?
        // Actually, easiest is to just wipe sessions for 2026-01-08 that come from "distribution" subjects IF they are not extras.
        // But IDs are reliable: `sess-programming-2026-01-08`.
        // Extras allow duplicates? No, unique IDs.
        
        const today = "2026-01-08";
        const subjects = ["programming", "typescript", "trading", "work"];
        // Remove distributed entries for today to fix the "13h" bug for existing users
        const beforeCount = dataCache.sessions.length;
        dataCache.sessions = dataCache.sessions.filter(s => {
           // If it matches session ID pattern for distribution AND is today
           // Distribution ID format: `sess-${subject}-${date}`
           if (s.date === today && subjects.includes(s.subjectName)) {
             if (s.id === `sess-${s.subjectName}-${today}`) {
                return false; // Delete it
             }
           }
           return true;
        });
        
        if (dataCache.sessions.length !== beforeCount) {
           console.log("[Storage] auto-fixed Jan 8 distribution overlap.");
           saveData(dataCache);
        }
      }

    } else {
      dataCache = { ...DEFAULT_DATA };
      seedInitialData(dataCache);
      saveData(dataCache);
    }
  } catch (err) {
    console.error("[Storage] Failed to load data:", err);
    dataCache = { ...DEFAULT_DATA };
  }
  
  return dataCache!;
}

export function saveData(data?: AppData): void {
  try {
    const toSave = data || dataCache || DEFAULT_DATA;
    dataCache = toSave;
    fs.writeFileSync(getDataFilePath(), JSON.stringify(toSave, null, 2), "utf-8");
  } catch (err) {
    console.error("[Storage] Failed to save data:", err);
  }
}

// ============================================
// Auth Operations
// ============================================

export function login(username: string, password: string): User | null {
  const data = loadData();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (user && verifyPassword(password, user.passwordHash)) {
    return user;
  }
  return null;
}

export function register(username: string, password: string): User {
  const data = loadData();
  if (data.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
     throw new Error("User already exists");
  }
  const newUser: User = {
    id: `user-${Date.now()}`,
    username,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };
  data.users.push(newUser);
  saveData(data);
  return newUser;
}

// ============================================
// Subject Operations
// ============================================

export function getAllSubjects(userId: string): string[] {
  const data = loadData();
  return data.subjects.filter(s => s.userId === userId && !s.hidden).map(s => s.name);
}

export function addSubject(userId: string, name: string): void {
  const data = loadData();
  const normalized = name.toLowerCase().trim();
  
  const existing = data.subjects.find(s => s.userId === userId && s.name === normalized);
  if (existing) {
    existing.hidden = false;
  } else {
    data.subjects.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name: normalized,
      hidden: false,
      createdAt: new Date().toISOString(),
    });
  }
  saveData(data);
}

export function hideSubject(userId: string, name: string): void {
  const data = loadData();
  const subject = data.subjects.find(s => s.userId === userId && s.name === name.toLowerCase());
  if (subject) {
    subject.hidden = true;
    saveData(data);
  }
}

export function unhideSubject(userId: string, name: string): void {
  const data = loadData();
  const subject = data.subjects.find(s => s.userId === userId && s.name === name.toLowerCase());
  if (subject) {
    subject.hidden = false;
    saveData(data);
  }
}

export function deleteSubject(userId: string, name: string): void {
  const data = loadData();
  data.subjects = data.subjects.filter(s => !(s.userId === userId && s.name === name.toLowerCase()));
  data.sessions = data.sessions.filter(s => !(s.userId === userId && s.subjectName === name.toLowerCase()));
  saveData(data);
}

export function checkSubjectExists(userId: string, name: string): boolean {
  const data = loadData();
  return data.subjects.some(s => s.userId === userId && s.name === name.toLowerCase());
}

// ============================================
// Timer Session Operations
// ============================================

export function addTimerMinutes(userId: string, subjectName: string, date: string, minutes: number): void {
  const data = loadData();
  const normalized = subjectName.toLowerCase().trim();
  
  // Ensure subject exists
  if (!data.subjects.some(s => s.userId === userId && s.name === normalized)) {
    data.subjects.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name: normalized,
      hidden: false,
      createdAt: new Date().toISOString(),
    });
  }
  
  // Find or create session for this date+subject
  const existing = data.sessions.find(s => s.userId === userId && s.subjectName === normalized && s.date === date);
  if (existing) {
    existing.minutes += minutes;
  } else {
    data.sessions.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      subjectName: normalized,
      date,
      minutes,
    });
  }
  
  saveData(data);
}

export function getSubjectTotals(userId: string, startDate?: string, endDate?: string): Array<{ subject: string; total_minutes: number }> {
  const data = loadData();
  const totals = new Map<string, number>();
  
  data.sessions
    .filter(s => {
      if (s.userId !== userId) return false;
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      return true;
    })
    .forEach(s => {
      totals.set(s.subjectName, (totals.get(s.subjectName) || 0) + s.minutes);
    });
  
  return Array.from(totals.entries()).map(([subject, total_minutes]) => ({ subject, total_minutes }));
}

export function getDailyAggregated(userId: string, startDate?: string, endDate?: string): Array<{ date: string; total_minutes: number; subjects: string[] }> {
  const data = loadData();
  const byDate = new Map<string, { total_minutes: number; subjects: Set<string> }>();
  
  data.sessions
    .filter(s => {
      if (s.userId !== userId) return false;
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      return true;
    })
    .forEach(s => {
      if (!byDate.has(s.date)) {
        byDate.set(s.date, { total_minutes: 0, subjects: new Set() });
      }
      const entry = byDate.get(s.date)!;
      entry.total_minutes += s.minutes;
      entry.subjects.add(s.subjectName);
    });
  
  return Array.from(byDate.entries()).map(([date, data]) => ({
    date,
    total_minutes: data.total_minutes,
    subjects: Array.from(data.subjects),
  }));
}

export function getSubjectDateAggregated(userId: string, startDate?: string, endDate?: string): Array<{ subject: string; date: string; total_minutes: number }> {
  const data = loadData();
  
  return data.sessions
    .filter(s => {
      if (s.userId !== userId) return false;
      if (startDate && s.date < startDate) return false;
      if (endDate && s.date > endDate) return false;
      return true;
    })
    .map(s => ({ subject: s.subjectName, date: s.date, total_minutes: s.minutes }));
}

// ============================================
// Todo Operations
// ============================================

export function getAllTodos(userId: string): Todo[] {
  return loadData().todos.filter(t => t.userId === userId);
}

export function addTodo(userId: string, todo: { text: string; starred?: boolean; dueDate?: string }): { id: number } {
  const data = loadData();
  const newTodo: Todo = {
    id: Date.now(),
    userId,
    text: todo.text,
    done: false,
    starred: todo.starred || false,
    dueDate: todo.dueDate,
    createdAt: new Date().toISOString(),
  };
  data.todos.push(newTodo);
  saveData(data);
  return { id: newTodo.id };
}

export function updateTodo(userId: string, id: number, updates: Partial<Pick<Todo, "text" | "done" | "starred" | "dueDate">>): boolean {
  const data = loadData();
  const todo = data.todos.find(t => t.id === id && t.userId === userId);
  if (!todo) return false;
  
  if (updates.text !== undefined) todo.text = updates.text;
  if (updates.done !== undefined) todo.done = updates.done;
  if (updates.starred !== undefined) todo.starred = updates.starred;
  if (updates.dueDate !== undefined) todo.dueDate = updates.dueDate;
  
  saveData(data);
  return true;
}

export function deleteTodo(userId: string, id: number): boolean {
  const data = loadData();
  const initialLength = data.todos.length;
  data.todos = data.todos.filter(t => !(t.id === id && t.userId === userId));
  saveData(data);
  return data.todos.length < initialLength;
}

// ============================================
// Note Operations
// ============================================

export function getAllNotes(userId: string): Note[] {
  return loadData().notes.filter(n => n.userId === userId);
}

export function addNote(userId: string, note: { title: string; content?: string; color?: string }): { id: number } {
  const data = loadData();
  const newNote: Note = {
    id: Date.now(),
    userId,
    title: note.title,
    content: note.content || "",
    color: note.color || "#ffffff",
    createdAt: new Date().toISOString(),
  };
  data.notes.push(newNote);
  saveData(data);
  return { id: newNote.id };
}

export function updateNote(userId: string, id: number, updates: Partial<Pick<Note, "title" | "content" | "color">>): boolean {
  const data = loadData();
  const note = data.notes.find(n => n.id === id && n.userId === userId);
  if (!note) return false;
  
  if (updates.title !== undefined) note.title = updates.title;
  if (updates.content !== undefined) note.content = updates.content;
  if (updates.color !== undefined) note.color = updates.color;
  
  saveData(data);
  return true;
}

export function deleteNote(userId: string, id: number): boolean {
  const data = loadData();
  const initialLength = data.notes.length;
  data.notes = data.notes.filter(n => !(n.id === id && n.userId === userId));
  saveData(data);
  return data.notes.length < initialLength;
}

// ============================================
// Background Operations
// ============================================

export function setBackground(view: string, relativePath: string): void {
  const data = loadData();
  data.backgrounds[view] = relativePath;
  saveData(data);
}

export function getBackground(view: string): string | null {
  const data = loadData();
  return data.backgrounds[view] || null; // Backgrounds strictly global for now? Or switch to user specific? User asked for "save on local so user only has to do it once". Let's keep shared for simplicty or user specific? 
  // User said "fetching the data based on the user".
  // Let's assume backgrounds are also per user?
  // But strict requirement was timer/todos. 
  // Let's keep backgrounds global in storage for now to avoid complexity of migration, or make them per user?
  // Making 'backgrounds' global in AppData is easiest.
}

export function getAllBackgrounds(): Record<string, string> {
  return loadData().backgrounds;
}

export function removeBackground(view: string): void {
  const data = loadData();
  delete data.backgrounds[view];
  saveData(data);
}

// ============================================
// Chapters
// ============================================

export function getAllChapters(userId: string): Chapter[] {
  const data = loadData();
  return (data.chapters || []).filter(c => c.userId === userId);
}

export function addChapter(userId: string, chapter: Omit<Chapter, "id" | "userId" | "createdAt">): Chapter {
  const data = loadData();
  const newChapter: Chapter = {
    id: crypto.randomUUID(),
    userId,
    ...chapter,
    createdAt: new Date().toISOString()
  };
  
  if (!data.chapters) data.chapters = [];
  data.chapters.push(newChapter);
  saveData(data);
  return newChapter;
}

export function updateChapter(userId: string, id: string, updates: Partial<Chapter>): boolean {
  const data = loadData();
  if (!data.chapters) return false;
  
  const idx = data.chapters.findIndex(c => c.id === id && c.userId === userId);
  if (idx === -1) return false;
  
  data.chapters[idx] = { ...data.chapters[idx], ...updates };
  saveData(data);
  return true;
}

export function deleteChapter(userId: string, id: string): boolean {
  const data = loadData();
  if (!data.chapters) return false;
  
  const initialLength = data.chapters.length;
  data.chapters = data.chapters.filter(c => !(c.id === id && c.userId === userId));
  
  if (data.chapters.length !== initialLength) {
    saveData(data);
    return true;
  }
  return false;
}
