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

export interface Motivation {
  id: string;
  userId: string;
  imagePath: string;
  order: number;
  createdAt: string;
}

// ============================================
// Game / Quest Types
// ============================================

export interface GameCharacter {
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  coins: number;
  avatar?: string;
}

export interface GameSkill {
  id: string;
  name: string;
  icon: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
}

export interface GameQuest {
  id: string;
  name: string;
  icon: string;
  skillId?: string;
  xpReward: number;
  completed: boolean;
  frequency: "daily" | "weekly" | "monthly";
  lastCompletedDate?: string;
}

export interface GameHabit {
  id: string;
  name: string;
  icon: string;
  type: "good" | "bad";
  skillId?: string; // Good habits give XP to a skill
  xpReward?: number; // Good habits
  hpDamage?: number; // Bad habits
  completed: boolean;
  frequency: "daily" | "weekly" | "monthly";
  lastCompletedDate?: string;
}

export interface GameData {
  character: GameCharacter;
  skills: GameSkill[];
  quests: GameQuest[];
  habits: GameHabit[];
  lastResetDate: string;
}

export interface AppData {
  users: User[];
  subjects: Subject[];
  sessions: TimerSession[];
  todos: Todo[];
  chapters: Chapter[];
  notes: Note[];
  motivations: Motivation[];
  gameData: Record<string, GameData>; // userId -> GameData
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
  lastActiveUserId?: string;
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
  motivations: [],
  gameData: {},
  backgrounds: {},
  settings: {},
};

let dataCache: AppData | null = null;
export function setLastActiveUser(userId: string): void {
  const data = loadData();
  data.lastActiveUserId = userId;
  saveData(data);
}

export function getLastActiveUser(): string | null {
  const data = loadData();
  return data.lastActiveUserId || null;
}

// Duplicate dataCache declaration removed

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
  // The provided CSV lines for Jan 5, 6, 7, 8 look like real daily entries.
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
      console.log("[Storage] Reading local data file from:", filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      dataCache = JSON.parse(content);
      console.log("[Storage] Data parsed successfully.");

      // Ensure gameData object exists
      if (!dataCache.gameData) {
         console.log("[Storage] Repairing: Initializing gameData object");
         dataCache.gameData = {};
      }
      
      // Migration: Disabled auto-seeding - using Supabase Auth now
      // Users must login via Supabase, data will be pulled from there
      if (!dataCache?.users || !Array.isArray(dataCache.users)) {
         console.log("[Storage] Initializing empty data structure (Supabase Auth enabled)");
         dataCache = { ...DEFAULT_DATA };
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

/**
 * Merge data pulled from Supabase into local storage
 * This replaces all data for the specified userId with data from Supabase
 */
export function mergeSupabaseData(userId: string, supabaseData: {
  subjects?: Array<{ name: string; hidden?: boolean; createdAt?: string }>;
  sessions?: Array<{ id?: string; subjectName: string; date: string; minutes: number; createdAt?: string }>;
  todos?: Array<{ id?: string | number; text: string; done: boolean; starred: boolean; dueDate?: string; createdAt?: string }>;
  notes?: Array<{ id?: string | number; title: string; content: string; color: string; createdAt?: string }>;
  chapters?: Array<{ id?: string; title: string; coverImage?: string; icon?: string; clear: boolean; createdAt?: string }>;
  motivations?: Array<{ id?: string; imagePath: string; order: number; createdAt?: string }>;
  gameData?: GameData;
}): void {
  const data = loadData();
  console.log('[Storage] Merging Supabase data for user:', userId);

  // Ensure user exists in local storage so fallback works
  if (!data.users.find(u => u.id === userId)) {
    data.users.push({
      id: userId,
      username: "User", // Will be updated if we had profile info, but ID is critical
      passwordHash: "",
      createdAt: new Date().toISOString()
    });
    console.log('[Storage] Added Supabase user to local persistence for offline fallback');
  } else {
    // Ideally ensure it's at the end or prioritized? 
    // For now just existing is enough for search
  }
  
  // Remove existing data for this user
  data.subjects = data.subjects.filter(s => s.userId !== userId);
  data.sessions = data.sessions.filter(s => s.userId !== userId);
  data.todos = data.todos.filter(t => t.userId !== userId);
  data.notes = data.notes.filter(n => n.userId !== userId);
  data.chapters = (data.chapters || []).filter(c => c.userId !== userId);
  
  // Add subjects from Supabase
  if (supabaseData.subjects) {
    supabaseData.subjects.forEach((s, i) => {
      data.subjects.push({
        id: `supa-sub-${userId}-${i}`,
        userId,
        name: s.name,
        hidden: s.hidden || false,
        createdAt: s.createdAt || new Date().toISOString()
      });
    });
    console.log(`[Storage] Added ${supabaseData.subjects.length} subjects`);
  }
  
  // Add sessions from Supabase
  if (supabaseData.sessions) {
    supabaseData.sessions.forEach((s, i) => {
      data.sessions.push({
        id: s.id || `supa-sess-${userId}-${i}`,
        userId,
        subjectName: s.subjectName,
        date: s.date,
        minutes: s.minutes
      });
    });
    console.log(`[Storage] Added ${supabaseData.sessions.length} sessions`);
  }
  
  // Add todos from Supabase
  if (supabaseData.todos) {
    supabaseData.todos.forEach((t, i) => {
      data.todos.push({
        id: typeof t.id === 'number' ? t.id : Date.now() + i,
        userId,
        text: t.text,
        done: t.done,
        starred: t.starred,
        dueDate: t.dueDate,
        createdAt: t.createdAt || new Date().toISOString()
      });
    });
    console.log(`[Storage] Added ${supabaseData.todos.length} todos`);
  }
  
  // Add notes from Supabase
  if (supabaseData.notes) {
    supabaseData.notes.forEach((n, i) => {
      data.notes.push({
        id: typeof n.id === 'number' ? n.id : Date.now() + i,
        userId,
        title: n.title,
        content: n.content,
        color: n.color,
        createdAt: n.createdAt || new Date().toISOString()
      });
    });
    console.log(`[Storage] Added ${supabaseData.notes.length} notes`);
  }
  
  // Add chapters from Supabase
  if (supabaseData.chapters) {
    supabaseData.chapters.forEach((c, i) => {
      data.chapters.push({
        id: c.id || `supa-chap-${userId}-${i}`,
        userId,
        title: c.title,
        coverImage: c.coverImage,
        icon: c.icon,
        clear: c.clear,
        createdAt: c.createdAt || new Date().toISOString()
      });
    });
    console.log(`[Storage] Added ${supabaseData.chapters.length} chapters`);
  }

  // Add Motivations from Supabase
  if (supabaseData.motivations) {
    if (!data.motivations) data.motivations = [];
    // Remove existing for this user first
    data.motivations = data.motivations.filter(m => m.userId !== userId);
    
    supabaseData.motivations.forEach((m: any) => {
      data.motivations.push({
        id: m.id || crypto.randomUUID(),
        userId,
        imagePath: m.imagePath,
        order: m.order,
        createdAt: m.createdAt || new Date().toISOString()
      });
    });
    console.log(`[Storage] Added ${supabaseData.motivations.length} motivations`);
  }

  // Add Game Data from Supabase
  if (supabaseData.gameData) {
    console.log('[Storage] Merging game data...');
    // Simply overwrite the game data for this user
    if (!data.gameData) data.gameData = {};
    
    // Ensure dates are strings
    const gd = supabaseData.gameData;
    data.gameData[userId] = {
      character: gd.character,
      skills: gd.skills || [],
      quests: gd.quests || [],
      habits: gd.habits || [],
      lastResetDate: gd.lastResetDate || new Date().toISOString().split('T')[0]
    };
    console.log(`[Storage] Merged game data. Skills: ${gd.skills?.length}, Quests: ${gd.quests?.length}`);
  }

  
  saveData(data);
  console.log('[Storage] Merge complete!');
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

// Update chapter order
export function updateChapterOrder(userId: string, orderedIds: string[]): boolean {
  const data = loadData();
  if (!data.chapters) return false;
  
  // Reorder chapters based on provided IDs
  const userChapters = data.chapters.filter(c => c.userId === userId);
  const otherChapters = data.chapters.filter(c => c.userId !== userId);
  
  const reordered = orderedIds.map(id => userChapters.find(c => c.id === id)).filter(Boolean) as Chapter[];
  data.chapters = [...reordered, ...otherChapters];
  
  saveData(data);
  return true;
}

// ============================================
// Motivation Operations
// ============================================

export function getAllMotivations(userId: string): Motivation[] {
  const data = loadData();
  if (!data.motivations) data.motivations = [];
  return data.motivations.filter(m => m.userId === userId).sort((a, b) => a.order - b.order);
}

export function addMotivation(userId: string, imagePath: string): Motivation {
  const data = loadData();
  if (!data.motivations) data.motivations = [];
  
  const userMotivations = data.motivations.filter(m => m.userId === userId);
  const maxOrder = userMotivations.length > 0 ? Math.max(...userMotivations.map(m => m.order)) : -1;
  
  const newMotivation: Motivation = {
    id: crypto.randomUUID(),
    userId,
    imagePath,
    order: maxOrder + 1,
    createdAt: new Date().toISOString()
  };
  
  data.motivations.push(newMotivation);
  saveData(data);
  return newMotivation;
}

export function deleteMotivation(userId: string, id: string): boolean {
  const data = loadData();
  if (!data.motivations) return false;
  
  const initialLength = data.motivations.length;
  data.motivations = data.motivations.filter(m => !(m.id === id && m.userId === userId));
  
  if (data.motivations.length !== initialLength) {
    saveData(data);
    return true;
  }
  return false;
}

export function updateMotivationOrder(userId: string, orderedIds: string[]): boolean {
  const data = loadData();
  if (!data.motivations) return false;
  
  // Update order based on position in array
  orderedIds.forEach((id, index) => {
    const motivation = data.motivations.find(m => m.id === id && m.userId === userId);
    if (motivation) motivation.order = index;
  });
  
  saveData(data);
  return true;
}

// ============================================
// Game Operations
// ============================================

const DEFAULT_CHARACTER: GameCharacter = {
  hp: 100,
  maxHp: 100,
  xp: 0,
  level: 1,
  coins: 0
};

function createDefaultGameData(): GameData {
  return {
    character: { ...DEFAULT_CHARACTER },
    skills: [],
    quests: [],
    habits: [],
    lastResetDate: new Date().toISOString().split('T')[0]
  };
}

export function getGameData(userId: string): GameData {
  const data = loadData();
  if (!data.gameData) data.gameData = {};
  
  if (!data.gameData[userId]) {
    data.gameData[userId] = createDefaultGameData();
    saveData(data);
  }
    // Check for daily reset
    const today = new Date().toISOString().split('T')[0];
    const gameData = data.gameData[userId];
    
    // Ensure arrays exist (migration safety)
    if (!gameData.quests) gameData.quests = [];
    if (!gameData.habits) gameData.habits = [];
    if (!gameData.skills) gameData.skills = [];

    const lastReset = gameData.lastResetDate;

    if (lastReset !== today) {
      // Logic for frequency reset
      // Only proceed if lastReset is valid, otherwise treating as first run (just set today)
      let isNewWeek = false;
      let isNewMonth = false;

      if (lastReset) {
        const lastDate = new Date(lastReset);
        const currentDate = new Date(today);
        
        if (!isNaN(lastDate.getTime())) {
          // Check for week change
          isNewWeek = currentDate.getDay() === 0 && lastDate.getDay() !== 0 || (currentDate.getTime() - lastDate.getTime() > 7 * 24 * 60 * 60 * 1000);
          // Check for month change
          isNewMonth = currentDate.getMonth() !== lastDate.getMonth();
        }
      }

      // Reset Quests
      gameData.quests.forEach(q => {
        if (!q.frequency || q.frequency === 'daily') q.completed = false;
        if (q.frequency === 'weekly' && isNewWeek) q.completed = false;
        if (q.frequency === 'monthly' && isNewMonth) q.completed = false;
      });

      // Reset Habits
      gameData.habits.forEach(h => {
        if (!h.frequency || h.frequency === 'daily') h.completed = false;
        if (h.frequency === 'weekly' && isNewWeek) h.completed = false;
        if (h.frequency === 'monthly' && isNewMonth) h.completed = false;
      });

      gameData.lastResetDate = today;
      saveData(data);
    }
  
  return gameData;
}

export function saveGameData(userId: string, gameData: GameData): void {
  const data = loadData();
  if (!data.gameData) data.gameData = {};
  data.gameData[userId] = gameData;
  saveData(data);
}

export function addSkill(userId: string, skill: Omit<GameSkill, 'id'>): GameSkill {
  const data = loadData();
  const gameData = data.gameData[userId] || createDefaultGameData();
  
  const newSkill: GameSkill = {
    ...skill,
    id: crypto.randomUUID()
  };
  
  gameData.skills.push(newSkill);
  data.gameData[userId] = gameData;
  saveData(data);
  return newSkill;
}

export function updateSkill(userId: string, skillId: string, updates: Partial<GameSkill>): boolean {
  const data = loadData();
  const gameData = data.gameData[userId];
  if (!gameData) return false;
  
  const skill = gameData.skills.find(s => s.id === skillId);
  if (!skill) return false;
  
  Object.assign(skill, updates);
  saveData(data);
  return true;
}

export function deleteSkill(userId: string, skillId: string): boolean {
  const data = loadData();
  const gameData = data.gameData[userId];
  if (!gameData) return false;
  
  const index = gameData.skills.findIndex(s => s.id === skillId);
  if (index === -1) return false;
  
  gameData.skills.splice(index, 1);
  saveData(data);
  return true;
}

export function addQuest(userId: string, quest: Omit<GameQuest, 'id' | 'completed'>): GameQuest {
  const data = loadData();
  const gameData = data.gameData[userId] || createDefaultGameData();
  
  const newQuest: GameQuest = {
    ...quest,
    id: crypto.randomUUID(),
    completed: false
  };
  
  gameData.quests.push(newQuest);
  data.gameData[userId] = gameData;
  saveData(data);
  return newQuest;
}

export function deleteQuest(userId: string, questId: string): boolean {
  const data = loadData();
  const gameData = data.gameData[userId];
  if (!gameData) return false;
  
  const index = gameData.quests.findIndex(q => q.id === questId);
  if (index === -1) return false;
  
  gameData.quests.splice(index, 1);
  saveData(data);
  return true;
}

export function completeQuest(userId: string, questId: string): { success: boolean; skillLevelUp?: boolean } {
  const data = loadData();
  const gameData = data.gameData[userId];
  if (!gameData) return { success: false };
  
  const quest = gameData.quests.find(q => q.id === questId);
  if (!quest || quest.completed) return { success: false };
  
  quest.completed = true;
  quest.lastCompletedDate = new Date().toISOString();
  
  // Add XP to the skill
  const skill = gameData.skills.find(s => s.id === quest.skillId);
  let skillLevelUp = false;
    if (skill) {
      skill.xp += quest.xpReward || 5; // Default 5
      // Check level up (Every 100 XP)
      while (skill.xp >= 100) {
        skill.xp -= 100;
        skill.level++;
        // skill.xpToNextLevel is fixed at 100 now? 
        // User said: "so code being 790 means 790 total points" and "evey 100 points it levels up automatically 1 levlee"
        // This implies XP resets to 0? Or keeps accumulating? 
        // Image shows "Code Level 7, 90 XP". This means 0-100 per level.
        skill.xpToNextLevel = 100; 
        skillLevelUp = true;
      }
    }
  
  // Add coins
  gameData.character.coins += Math.floor(quest.xpReward / 2);
  
  // Add character XP
  gameData.character.xp += quest.xpReward;
  const xpToLevel = gameData.character.level * 100;
  while (gameData.character.xp >= xpToLevel) {
    gameData.character.xp -= xpToLevel;
    gameData.character.level++;
    gameData.character.maxHp += 10;
    gameData.character.hp = Math.min(gameData.character.hp + 10, gameData.character.maxHp);
  }
  
  saveData(data);
  return { success: true, skillLevelUp };
}

export function addHabit(userId: string, habit: Omit<GameHabit, 'id' | 'completed'>): GameHabit {
  const data = loadData();
  const gameData = data.gameData[userId] || createDefaultGameData();
  
  const newHabit: GameHabit = {
    ...habit,
    id: crypto.randomUUID(),
    completed: false
  };
  
  gameData.habits.push(newHabit);
  data.gameData[userId] = gameData;
  saveData(data);
  return newHabit;
}

export function deleteHabit(userId: string, habitId: string): boolean {
  const data = loadData();
  const gameData = data.gameData[userId];
  if (!gameData) return false;
  
  const index = gameData.habits.findIndex(h => h.id === habitId);
  if (index === -1) return false;
  
  gameData.habits.splice(index, 1);
  saveData(data);
  return true;
}

export function completeHabit(userId: string, habitId: string): { success: boolean; gameOver?: boolean; skillLevelUp?: boolean } {
  const data = loadData();
  const gameData = data.gameData[userId];
  if (!gameData) return { success: false };
  
  const habit = gameData.habits.find(h => h.id === habitId);
  if (!habit || habit.completed) return { success: false };
  
  habit.completed = true;
  habit.lastCompletedDate = new Date().toISOString();
  
  let skillLevelUp = false;
  
  if (habit.type === "good") {
    // Good habit: +3 XP to skill, +1 HP
    if (habit.skillId) {
      const skill = gameData.skills.find(s => s.id === habit.skillId);
      if (skill) {
        skill.xp += 3; // Fixed 3 points per user request
        while (skill.xp >= 100) {
          skill.xp -= 100;
          skill.level++;
          skill.xpToNextLevel = 100;
          skillLevelUp = true;
        }
      }
    }
    
    // +1 HP
    gameData.character.hp = Math.min(gameData.character.hp + 1, gameData.character.maxHp);
    
    // Add coins
    gameData.character.coins += habit.xpReward || 5;
  } else {
    // Bad habit: reduce HP by 5
    const damage = 5; // Fixed 5 damage per user request
    gameData.character.hp -= damage;
    
    if (gameData.character.hp <= 0) {
      // Game over - reset everything
      data.gameData[userId] = createDefaultGameData();
      saveData(data);
      return { success: true, gameOver: true };
    }
  }
  
  saveData(data);
  return { success: true, skillLevelUp };
}

export function healCharacter(userId: string, amount: number): boolean {
  const data = loadData();
  const gameData = data.gameData[userId];
  if (!gameData) return false;
  
  gameData.character.hp = Math.min(gameData.character.hp + amount, gameData.character.maxHp);
  saveData(data);
  return true;
}

export function resetGame(userId: string): void {
  const data = loadData();
  data.gameData[userId] = createDefaultGameData();
  saveData(data);
}

export function updateCharacter(userId: string, updates: Partial<{ avatar: string }>): boolean {
  const data = loadData();
  const gameData = data.gameData[userId];
  if (!gameData) return false;
  
  if (updates.avatar !== undefined) {
    gameData.character.avatar = updates.avatar;
  }
  
  saveData(data);
  return true;
}
