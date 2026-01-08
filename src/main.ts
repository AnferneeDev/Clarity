import { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, shell } from "electron";
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
  login,
  register
} from "./storage";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let activeUserId: string | null = null;

const ASSETS_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "assets")
  : path.join(__dirname, "../../assets");

const getIconPath = (iconName: string) => path.join(ASSETS_PATH, iconName);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 940,
    minHeight: 600,
    minWidth: 800,
    frame: false,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 10, y: 10 },
    icon: getIconPath("icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // For local image checks slightly easier
    },
    backgroundColor: "#000000",
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // initialize data (trigger seed if needed)
  loadData();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  setupIpcHandlers();
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

  // Auth Handlers
  ipcMain.handle("auth:login", (e, { username, password }) => {
    const user = login(username, password);
    if (user) {
      activeUserId = user.id;
      return { id: user.id, username: user.username };
    }
    return null;
  });

  ipcMain.handle("auth:register", (e, { username, password }) => {
    try {
      const user = register(username, password);
      activeUserId = user.id;
      return { id: user.id, username: user.username };
    } catch (err: any) {
      console.error(err);
      return { error: err.message };
    }
  });

  ipcMain.handle("auth:verify", (e, userId: string) => {
    // Simple check if user exists (mocked by checking if we have any data, essentially)
    // In strict mode, we'd fetch user by ID. storage.ts needs getUserById?
    // Let's implement basic "if userId matches current active" or just trust it for local app session resume.
    // Better: check if userId exists in storage.
    const data = loadData();
    const user = data.users.find(u => u.id === userId);
    if (user) {
      activeUserId = user.id;
      return user;
    }
    return null;
  });
  
  ipcMain.handle("auth:logout", () => {
    activeUserId = null;
    return true;
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
