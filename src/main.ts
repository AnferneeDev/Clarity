import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from "electron";
import * as path from "path";
import * as fs from "fs";
import {
  loadData,
  getAllSubjects,
  getSubjectTotals,
  getDailyAggregated,
  getSubjectDateAggregated,
  addTimerMinutes,
  addSubject,
  checkSubjectExists,
  hideSubject,
  unhideSubject,
  deleteSubject,
  getAllTodos,
  addTodo,
  updateTodo,
  deleteTodo,
  getAllNotes,
  addNote,
  updateNote,
  deleteNote,
  setBackground,
  getAllBackgrounds,
  getBackground,
  removeBackground,
  getAllChapters,
  addChapter,
  updateChapter,
  deleteChapter,
  updateChapterOrder,
  getAllMotivations,
  addMotivation,
  deleteMotivation,
  updateMotivationOrder,
  mergeSupabaseData,
  // Game functions
  getGameData,
  addSkill,
  updateSkill,
  deleteSkill,
  addQuest,
  deleteQuest,
  completeQuest,
  addHabit,
  deleteHabit,
  completeHabit,
  healCharacter,
  resetGame
} from "./storage";
import supabaseService from "./supabaseService";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let activeUserId: string | null = null;
let syncTimeout: NodeJS.Timeout | null = null;

// Helper to debounce sync operations
function triggerSync() {
  if (!activeUserId) return;
  
  if (syncTimeout) clearTimeout(syncTimeout);
  
  syncTimeout = setTimeout(async () => {
    console.log('[Main] Triggering auto-sync...');
    const appData = loadData();
    const userLocalData = appData[activeUserId!] || {}; // Assuming structure, or pass full appData if sync handles mapping
    // Actually, sync expects (userId, localData) where localData is the whole DB or user slice?
    // Let's check sync signature: sync(userId, localData, localTimestamp)
    
    // We need to load fresh data
    const freshData = loadData();
    
    // Construct the payload expected by pushToServer (which is called by sync)
    // pushToServer expects: { subjects, sessions, ... }
    // We should probably just call pushToServer directly for writes if we are sure? 
    // Or call sync for full bidirectional? Sync is safer.
    
    // For now, let's just use pushToServer logic mapped from freshData for this user
    try {
       await supabaseService.sync(activeUserId!, freshData, new Date().toISOString());
    } catch (err) {
       console.error('[Main] Auto-sync failed:', err);
    }
  }, 2000); // 2 second debounce
}

// Supabase Configuration
const SUPABASE_URL = 'https://qkqwyqdhwhscmlkmsiyg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrcXd5cWRod2hzY21sa21zaXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDA5NTQsImV4cCI6MjA4MzQ3Njk1NH0.9BvJZRa4bAr1amQ75dWEk6Q0dNjosPkfTAYDP5cXiMg';

const ASSETS_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "assets")
  : path.join(__dirname, "../../assets");

const getIconPath = (iconName: string) => path.join(ASSETS_PATH, iconName);

function createWindow() {
  console.log("[Main] createWindow called");
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minHeight: 600,
    minWidth: 800,
    center: true,
    // frame: false, // User wants standard frame ("white label")
    // titleBarStyle: "hidden",
    trafficLightPosition: { x: 10, y: 10 },
    icon: getIconPath("icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    backgroundColor: "#000000",
    resizable: true,
    fullscreen: false,
    fullscreenable: true,
  });
  
  // Remove default menu (File, Edit, etc.) but keep the frame
  mainWindow.setMenu(null); 
  console.log("[Main] MainWindow created");

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log("[Main] Loading development URL:", MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    console.log("[Main] Loading production file");
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // initialize data (trigger seed if needed)
  console.log("[Main] Loading local data...");
  const appData = loadData();
  console.log("[Main] Local data loaded. Users:", appData.users?.length);

  // Initialize Supabase and perform initial sync
  console.log('[App] Initializing Supabase...');
  supabaseService.initialize(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // Restore session or default to first user
  // This is critical for offline-first / single-user-ish apps so data loads immediately
  if (!activeUserId) {
     console.log('[Main] Attempting to restore session...');
     
     // 1. Try Supabase Session
     supabaseService.getSession().then(async (session) => {
        if (session?.user) {
           activeUserId = session.user.id;
           console.log('[Main] Session restored from Supabase. Active User:', activeUserId);
           
           // Pull latest data (including seeded game data)
           console.log('[Main] Pulling initial data from Supabase...');
           const serverData = await supabaseService.pullFromServer(activeUserId);
           if (serverData) {
              mergeSupabaseData(activeUserId, serverData);
              console.log('[Main] Initial sync complete. Loaded items:', {
                 skills: serverData.gameData?.[activeUserId]?.skills?.length,
                 quests: serverData.gameData?.[activeUserId]?.quests?.length
              });
           }
        } else {
           // 2. Fallback to first local user if no session (Offline / Legacy)
           if (appData.users && appData.users.length > 0) {
              activeUserId = appData.users[0].id;
              console.log('[Main] No online session, falling back to local user:', activeUserId);
           } else {
              console.log('[Main] No users found. Waiting for login.');
           }
        }
     }).catch(err => {
         console.error('[Main] Session check failed:', err);
         // Fallback on error
         if (appData.users && appData.users.length > 0) {
            activeUserId = appData.users[0].id;
            console.log('[Main] Session error, falling back to local user:', activeUserId);
         }
     });
  }

  console.log("[Main] Setting up IPC handlers...");
  setupIpcHandlers();
  console.log("[Main] Initialization complete");
}

function createTray() {
  const icon = nativeImage.createFromPath(getIconPath("icon.ico"));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Clarity");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show App", click: () => mainWindow?.show() },
      { label: "Quit", click: () => app.quit() },
    ])
  );
}

// Validation helper
function validate(e: Electron.IpcMainInvokeEvent): boolean {
  return e.sender === mainWindow?.webContents;
}



function setupIpcHandlers() {
  ipcMain.handle("app:minimize", () => mainWindow?.minimize());
  ipcMain.handle("app:maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle("app:close", () => mainWindow?.close());

  ipcMain.handle("notify", () => {
    // Notifications implemented via renderer HTML5 API mostly, but main process can hook too if needed.
    // For now, doing nothing or console log.
  });

  // Sound handled in renderer (window.Audio), but helper if needed:
  ipcMain.handle("playSound", () => { /* no-op */ });

  // Tray
  ipcMain.handle("setTrayState", (e, state: "active" | "idle") => {
    if (!tray) return;
    const iconName = state === "active" ? "icon-active.ico" : "icon.ico";
    const icon = nativeImage.createFromPath(getIconPath(iconName));
    tray.setImage(icon.resize({ width: 16, height: 16 }));
  });

  // Auth Handlers (Username-only, queries profiles table)
  ipcMain.handle("auth:login", async (e, { username }) => {
    console.log('[Main] auth:login called with username:', username);
    
    try {
      // Query profiles table by username (case-insensitive)
      const profile = await supabaseService.getProfileByUsername(username);
      
      if (profile) {
        activeUserId = profile.id;
        console.log('[Main] User logged in:', profile.username, '(ID:', profile.id, ')');
        
        // Pull user data from Supabase and merge into local storage
        console.log('[Main] Pulling data from Supabase...');
        const serverData = await supabaseService.pullFromServer(profile.id);
        
        if (serverData) {
          console.log('[Main] Server data received:', {
            subjects: serverData.subjects?.length || 0,
            sessions: serverData.sessions?.length || 0,
            todos: serverData.todos?.length || 0,
            notes: serverData.notes?.length || 0,
            chapters: serverData.chapters?.length || 0
          });
          
          // Merge Supabase data into local storage
          mergeSupabaseData(profile.id, serverData);
          console.log('[Main] Data merged into local storage');
        } else {
          console.log('[Main] No data from server or offline');
        }
        
        return {
          id: profile.id,
          username: profile.username || username
        };
      }
      
      console.error('[Main] User not found in profiles:', username);
      return null;
    } catch (err) {
      console.error('[Main] Login error:', err);
      return null;
    }
  });

  ipcMain.handle("auth:logout", async () => {
    const success = await supabaseService.signOut();
    if (success) {
      activeUserId = null;
      console.log('[Main] User logged out');
    }
    return success;
  });

  ipcMain.handle("auth:getSession", async () => {
    const session = await supabaseService.getSession();
    if (session?.user) {
      activeUserId = session.user.id;
      return {
        id: session.user.id,
        username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'User'
      };
    }
    return null;
  });

  // Timer Handlers (Scoped to User)
  ipcMain.handle("timerDb:getAllSubjects", (e) => {
    if (!validate(e) || !activeUserId) return ["General"];
    const subs = getAllSubjects(activeUserId);
    return subs.length > 0 ? subs : ["General"];
  });

  ipcMain.handle("timerDb:checkIfSubjectExists", (e, name: string) => {
    return validate(e) && activeUserId ? checkSubjectExists(activeUserId, name) : false;
  });

  ipcMain.handle("timerDb:addOrUpdateTimerData", (e, subject: string, date: string, minutes: number) => {
    if (validate(e) && activeUserId) addTimerMinutes(activeUserId, subject, date, minutes);
  });

  ipcMain.handle("timerDb:addSubject", (e, name: string) => {
    if (validate(e) && activeUserId) addSubject(activeUserId, name);
  });

  ipcMain.handle("timerDb:hideSubject", (e, name: string) => {
    if (validate(e) && activeUserId) hideSubject(activeUserId, name);
  });

  ipcMain.handle("timerDb:unhideSubject", (e, name: string) => {
    if (validate(e) && activeUserId) unhideSubject(activeUserId, name);
  });

  ipcMain.handle("timerDb:deleteSubjectCompletely", (e, name: string) => {
    if (validate(e) && activeUserId) deleteSubject(activeUserId, name);
  });

  // Aggregation
  ipcMain.handle("timerDb:getSubjectTotalsByDateRange", (e, start?: string, end?: string) => 
    validate(e) && activeUserId ? getSubjectTotals(activeUserId, start, end) : []
  );

  ipcMain.handle("timerDb:getDailyAggregatedData", (e, start?: string, end?: string) => 
    validate(e) && activeUserId ? getDailyAggregated(activeUserId, start, end) : []
  );

  ipcMain.handle("timerDb:getSubjectDateAggregatedData", (e, start?: string, end?: string) => 
    validate(e) && activeUserId ? getSubjectDateAggregated(activeUserId, start, end) : []
  );

  // Todo Handlers
  ipcMain.handle("todos:getAll", (e) => validate(e) && activeUserId ? getAllTodos(activeUserId) : []);
  ipcMain.handle("todos:add", (e, todo: any) => validate(e) && activeUserId ? addTodo(activeUserId, todo) : null);
  ipcMain.handle("todos:update", (e, { id, updates }: any) => validate(e) && activeUserId ? updateTodo(activeUserId, id, updates) : false);
  ipcMain.handle("todos:delete", (e, id: number) => validate(e) && activeUserId ? deleteTodo(activeUserId, id) : false);

  // Note Handlers
  ipcMain.handle("db:query", (e, { table }: any) => {
    if (!validate(e) || !activeUserId) return [];
    if (table === "notes") return getAllNotes(activeUserId);
    return [];
  });

  ipcMain.handle("db:insert", (e, { table, data }: any) => {
    if (!validate(e) || !activeUserId) return null;
    if (table === "notes") return addNote(activeUserId, data);
    return null;
  });

  ipcMain.handle("db:update", (e, { table, id, data }: any) => {
    if (!validate(e) || !activeUserId) return null;
    if (table === "notes") return updateNote(activeUserId, id, data);
    return null;
  });

  ipcMain.handle("db:remove", (e, { table, id }: any) => {
    if (!validate(e) || !activeUserId) return null;
    if (table === "notes") return deleteNote(activeUserId, id);
    return null;
  });

  // Backgrounds (Global/Shared in storage, but we need to implement ViewBackgroundData for renderer)
  ipcMain.handle("setViewBackground", (e, view: string, { name, data }: any) => {
    if (!validate(e)) return;
    // Save file to disk
    try {
      const bgDir = path.join(app.getPath("userData"), "backgrounds");
      if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir);
      
      const fileName = `${view}_${Date.now()}_${name}`; // unique
      const filePath = path.join(bgDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(data));
      
      const relative = path.join("backgrounds", fileName);
      setBackground(view, relative);
      return relative;
    } catch (err) {
      console.error(err);
      return null;
    }
  });

  ipcMain.handle("getViewBackground", (e, view: string) => {
    return getBackground(view); // returns relative path
  });

  ipcMain.handle("getViewBackgroundData", async (e, view: string) => {
    const relPath = getBackground(view);
    if (!relPath) return null;
    try {
      const fullPath = path.join(app.getPath("userData"), relPath);
      if (fs.existsSync(fullPath)) {
        const data = fs.readFileSync(fullPath);
        const b64 = data.toString("base64");
        // Determine mime? simple assumption
        const ext = path.extname(fullPath).toLowerCase();
        let mime = "image/jpeg";
        if (ext === ".png") mime = "image/png";
        if (ext === ".gif") mime = "image/gif";
        if (ext === ".webp") mime = "image/webp";
        return `data:${mime};base64,${b64}`;
      }
    } catch {
      // ignore
    }
    return null;
  });

  ipcMain.handle("getAllBackgrounds", () => getAllBackgrounds());
  ipcMain.handle("removeViewBackground", (e, view: string) => removeBackground(view));

  // Chapters
  ipcMain.handle("chapters:getAll", (e) => {
    if (!validate(e)) return [];
    if (!activeUserId) return [];
    const chapters = getAllChapters(activeUserId);
    console.log(`[IPC] chapters:getAll returning ${chapters.length} items for user ${activeUserId}`);
    return chapters;
  });
  ipcMain.handle("chapters:add", (e, chapter: any) => {
    if (validate(e) && activeUserId) {
       const res = addChapter(activeUserId, chapter);
       if (res) triggerSync();
       return res;
    }
    return null;
  });
  ipcMain.handle("chapters:update", (e, { id, updates }: any) => {
    if (validate(e) && activeUserId) {
       const res = updateChapter(activeUserId, id, updates);
       if (res) triggerSync();
       return res;
    }
    return false;
  });
  ipcMain.handle("chapters:delete", (e, id: string) => {
    if (validate(e) && activeUserId) {
       const res = deleteChapter(activeUserId, id);
       if (res) triggerSync();
       return res;
    }
    return false;
  });

  ipcMain.handle("chapters:uploadImage", (e, { name, data }: any) => {
    if (!validate(e) || !activeUserId) return null;
    try {
      const chaptersDir = path.join(app.getPath("userData"), "chapters");
      if (!fs.existsSync(chaptersDir)) fs.mkdirSync(chaptersDir);
      
      const fileName = `chapter_${Date.now()}_${name}`;
      const filePath = path.join(chaptersDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(data));
      
      return path.join("chapters", fileName);
    } catch (err) {
      console.error(err);
      return null;
    }
  });

  ipcMain.handle("chapters:getImage", (e, relativePath: string) => {
    if (!relativePath) return null;
    try {
      const fullPath = path.join(app.getPath("userData"), relativePath);
      if (fs.existsSync(fullPath)) {
        const data = fs.readFileSync(fullPath);
        const b64 = data.toString("base64");
        // Simple mime check
        const ext = path.extname(fullPath).toLowerCase();
        let mime = "image/jpeg";
        if (ext === ".png") mime = "image/png";
        if (ext === ".gif") mime = "image/gif";
        if (ext === ".webp") mime = "image/webp";
        return `data:${mime};base64,${b64}`;
      }
    } catch { }
    return null; 
  });

  // Chapter reordering
  ipcMain.handle("chapters:reorder", (e, orderedIds: string[]) => {
    if (!validate(e) || !activeUserId) return false;
    const res = updateChapterOrder(activeUserId, orderedIds);
    if(res) triggerSync();
    return res;
  });

  // Motivation Handlers
  ipcMain.handle("motivation:getAll", (e) => {
    if (!validate(e)) return [];
    if (!activeUserId) return [];
    const motivs = getAllMotivations(activeUserId);
    console.log(`[IPC] motivation:getAll returning ${motivs.length} items`);
    return motivs;
  });
  
  ipcMain.handle("motivation:add", async (e, { name, data }: any) => {
    if (!validate(e) || !activeUserId) return null;
    try {
      const motivationDir = path.join(app.getPath("userData"), "motivations");
      if (!fs.existsSync(motivationDir)) fs.mkdirSync(motivationDir);
      
      const fileName = `motivation_${Date.now()}_${name}`;
      const filePath = path.join(motivationDir, fileName);
      fs.writeFileSync(filePath, Buffer.from(data));
      
      const relativePath = path.join("motivations", fileName);
      const res = addMotivation(activeUserId, relativePath);
      if (res) triggerSync();
      return res;
    } catch (err) {
      console.error(err);
      return null;
    }
  });

  ipcMain.handle("motivation:delete", (e, id: string) => {
      if (validate(e) && activeUserId) {
        const res = deleteMotivation(activeUserId, id);
        if (res) triggerSync();
        return res;
      }
      return false;
  });
  
  ipcMain.handle("motivation:reorder", (e, orderedIds: string[]) => {
    if (!validate(e) || !activeUserId) return false;
    const res = updateMotivationOrder(activeUserId, orderedIds);
    if(res) triggerSync();
    return res;
  });

  ipcMain.handle("motivation:getImage", (e, relativePath: string) => {
    if (!relativePath) return null;
    try {
      const fullPath = path.join(app.getPath("userData"), relativePath);
      if (fs.existsSync(fullPath)) {
        const data = fs.readFileSync(fullPath);
        const b64 = data.toString("base64");
        const ext = path.extname(fullPath).toLowerCase();
        let mime = "image/jpeg";
        if (ext === ".png") mime = "image/png";
        if (ext === ".gif") mime = "image/gif";
        if (ext === ".webp") mime = "image/webp";
        return `data:${mime};base64,${b64}`;
      }
    } catch { /* ignore */ }
    return null;
  });

  // ============================================
  // Game / Quest Handlers
  // ============================================
  
  ipcMain.handle("game:getData", (e) => {
    if (!validate(e)) {
      console.log("[IPC] game:getData invalid event");
      return null;
    }
    if (!activeUserId) {
      console.log("[IPC] game:getData no active user");
      return null;
    } 
    const data = getGameData(activeUserId);
    console.log("[IPC] game:getData returning items:", { 
      quests: data.quests?.length, 
      habits: data.habits?.length,
      skills: data.skills?.length 
    });
    return data;
  });
  
  // Skills
  ipcMain.handle("game:addSkill", (e, skill: any) => {
    if (validate(e) && activeUserId) {
      const res = addSkill(activeUserId, skill);
      if (res) triggerSync();
      return res;
    }
    return null;
  });
  ipcMain.handle("game:updateSkill", (e, { skillId, updates }: any) => {
      if (validate(e) && activeUserId) {
        const res = updateSkill(activeUserId, skillId, updates);
        if(res) triggerSync();
        return res;
      }
      return false;
  });
  ipcMain.handle("game:deleteSkill", (e, skillId: string) => {
      if (validate(e) && activeUserId) {
        const res = deleteSkill(activeUserId, skillId);
        if(res) triggerSync();
        return res;
      }
      return false;
  });
  
  // Quests
  ipcMain.handle("game:addQuest", (e, quest: any) => {
      if (validate(e) && activeUserId) {
        const res = addQuest(activeUserId, quest);
        if (res) triggerSync();
        return res;
      }
      return null;
  });
  ipcMain.handle("game:deleteQuest", (e, questId: string) => {
      if (validate(e) && activeUserId) {
        const res = deleteQuest(activeUserId, questId);
        if(res) triggerSync();
        return res;
      }
      return false;
  });
  ipcMain.handle("game:completeQuest", (e, questId: string) => {
      if(validate(e) && activeUserId) {
         const res = completeQuest(activeUserId, questId);
         triggerSync();
         return res;
      }
      return { success: false };
  });
  
  // Habits
  ipcMain.handle("game:addHabit", (e, habit: any) => {
      if (validate(e) && activeUserId) {
        const res = addHabit(activeUserId, habit);
        if (res) triggerSync();
        return res;
      }
      return null;
  });
  ipcMain.handle("game:deleteHabit", (e, habitId: string) => {
      if (validate(e) && activeUserId) {
        const res = deleteHabit(activeUserId, habitId);
        if(res) triggerSync();
        return res;
      }
      return false;
  });
  ipcMain.handle("game:completeHabit", (e, habitId: string) => {
    if(validate(e) && activeUserId) {
       const res = completeHabit(activeUserId, habitId);
       triggerSync();
       return res;
    }
    return { success: false };
  });
  
  // Character
  ipcMain.handle("game:heal", (e, amount: number) => {
      if (validate(e) && activeUserId) {
        const res = healCharacter(activeUserId, amount);
        if(res) triggerSync();
        return res;
      }
      return false;
  });
  ipcMain.handle("game:reset", (e) => { 
      if (validate(e) && activeUserId) {
        resetGame(activeUserId); 
        triggerSync();
        return true; 
      }
      return false;
  });
}

app.whenReady().then(() => {
  createTray();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
