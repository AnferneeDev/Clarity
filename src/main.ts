import { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell, powerSaveBlocker, IpcMainInvokeEvent, WebContents, Event, Input } from "electron";
import path from "node:path";
import fs from "fs";
import started from "electron-squirrel-startup";
import player from "node-wav-player";
import { initNotificationsAndReminders, shutdownNotificationsAndReminders } from "./notifications";
import {
  runDataMigrations,
  initDb,
  getPomodoroDashboardData,
  timerDb,
  startSession,
  completeSession,
  setViewBackground,
  getViewBackground,
  getAllBackgrounds,
  query,
  insert,
  getAllTodos,
  update,
  remove,
  getTodosByDate,
  addTodo,
  updateTodo,
  deleteTodo,
  getStarredTodos,
  getSubjectTimeStats,
  removeViewBackground,
  getSessionsForMonth,
  getAllSessions,
  getSettings,
  setSettings,
  getDailyStats,
  getDailyStatsByDate,
  addDailyStat,
  getSubjectTotals,
  incrementSubjectTotal,
  removeSubjectFromStore,
  startSessionInStore,
  completeSessionInStore,
  getSessionsForDate,
  getAllSessionsFromStore,
  updateSessionProgress,
  updateDailyStat,
} from "./db";
import { localDateString } from "./timeUtils";

if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let tray: Tray | null = null;

function getIconPath(isGrayscale = false): string {
  const iconName = isGrayscale ? "icon-bw.ico" : "icon.ico";
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", iconName);
  } else {
    return path.join(process.cwd(), "assets", iconName);
  }
}

function getSoundPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", "Click.wav");
  } else {
    return path.join(__dirname, "../../assets/Click.wav");
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".wav": "audio/wav",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

function createAppTray(mainWin?: BrowserWindow | null) {
  if (tray) return tray;
  const iconPath = getIconPath(true);
  let iconImage;

  try {
    if (fs.existsSync(iconPath)) {
      iconImage = nativeImage.createFromPath(iconPath);
      if (process.platform === "win32") {
        iconImage = iconImage.resize({ width: 16, height: 16 });
      }
    } else {
      console.warn("Icon file not found at:", iconPath);
      iconImage = nativeImage.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
    }
  } catch (err) {
    console.warn("Failed to create nativeImage for tray:", err);
    iconImage = nativeImage.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
  }

  try {
    tray = new Tray(iconImage);
    tray.setToolTip("Clarity");
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show App",
        click: () => {
          if (mainWin) {
            if (mainWin.isMinimized()) mainWin.restore();
            mainWin.show();
            mainWin.focus();
          }
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on("click", () => {
      if (mainWin) {
        if (mainWin.isMinimized()) mainWin.restore();
        mainWin.show();
        mainWin.focus();
      }
    });
  } catch (err) {
    console.warn("Failed to create tray:", err);
    tray = null;
  }
  return tray;
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, _commandLine, _workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event, _webPreferences, _params) => {
      event.preventDefault();
    });
    contents.on("will-navigate", (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.origin !== "file://" && !navigationUrl.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    });

    contents.executeJavaScript(`
      window.eval = global.eval = function() { throw new Error('Sorry, this app does not support window.eval().'); };
    `);
  });

  app.on("web-contents-created", (_event, contents) => {
    contents.session.setPermissionRequestHandler((_webContents: WebContents, _permission: string, callback: (permissionGranted: boolean) => void) => {
      callback(false);
    });
  });

  const csp = `
    default-src 'self' 'unsafe-inline' ${MAIN_WINDOW_VITE_DEV_SERVER_URL || ""};
    script-src 'self' 'unsafe-inline' ${MAIN_WINDOW_VITE_DEV_SERVER_URL || ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: file:;
    font-src 'self';
    media-src 'self' file:;
    connect-src 'self' ${MAIN_WINDOW_VITE_DEV_SERVER_URL || ""};
    base-uri 'self';
    form-action 'none';
    frame-ancestors 'none';
    object-src 'none';
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  if (process.platform === "win32") {
    try {
      app.setAppUserModelId("Clarity");
    } catch (err) {
      console.warn("setAppUserModelId failed:", err);
    }
  }

  const createWindow = () => {
    const iconPath = getIconPath();

    mainWindow = new BrowserWindow({
      width: 900,
      height: 680,
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        enableWebSQL: false,
        webSecurity: true,
        safeDialogs: true,
        safeDialogsMessage: "Don't show this message again",
      },
    });

    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [csp],
          "X-Content-Type-Options": ["nosniff"],
          "X-Frame-Options": ["DENY"],
          "X-XSS-Protection": ["1; mode=block"],
        },
      });
    });

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }

    mainWindow.setMenu(null);
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

    mainWindow.on("close", (e) => {
      if (!isQuitting) {
        e.preventDefault();
        mainWindow?.hide();
      }
    });

    mainWindow.webContents.on("before-input-event", (_event: Event, input: Input) => {
      if (input.control && input.shift && input.alt && input.key.toLowerCase() === "d") {
        mainWindow.webContents.toggleDevTools();
      }
    });
  };

  app.on("before-quit", () => {
    isQuitting = true;
    shutdownNotificationsAndReminders();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });

  const validateIPCSender = (event: IpcMainInvokeEvent) => {
    if (!event.senderFrame || event.senderFrame.url.startsWith("file://") || (MAIN_WINDOW_VITE_DEV_SERVER_URL && event.senderFrame.url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL))) {
      return true;
    }
    console.warn("Blocked IPC call from untrusted source:", event.senderFrame.url);
    return false;
  };

  ipcMain.handle("notify", async (event, { title, body }) => {
    if (!validateIPCSender(event)) return "unauthorized";
    new Notification({ title, body }).show();
    return "ok";
  });
  ipcMain.handle("play-sound", async (event, soundName: string) => {
    if (!validateIPCSender(event)) return { success: false, error: "unauthorized" };
    try {
      if (soundName === "click") {
        const soundPath = getSoundPath();
        if (fs.existsSync(soundPath)) {
          await player.play({ path: soundPath });
          return { success: true };
        } else {
          return { success: false, error: "Sound file not found" };
        }
      }
      return { success: false, error: "Unknown sound" };
    } catch (error) {
      console.error("Error playing sound:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("dashboard:getData", (event, date?: string) => {
    if (!validateIPCSender(event)) return { sessions: [], dailyLog: {}, subjects: [], todos: [] };
    try {
      return getPomodoroDashboardData(date);
    } catch (error) {
      console.error("Error getting dashboard data:", error);
      return { sessions: [], dailyLog: {}, subjects: [], todos: [] };
    }
  });
  ipcMain.handle("sessions:start", (event, subjectId: number) => {
    if (!validateIPCSender(event)) throw new Error("unauthorized");
    try {
      return startSession(subjectId);
    } catch (error) {
      console.error("Error starting session:", error);
      throw error;
    }
  });
  ipcMain.handle("sessions:complete", (event, { sessionId, durationMinutes, pausedSeconds }) => {
    if (!validateIPCSender(event)) return false;
    try {
      completeSession(sessionId, durationMinutes, pausedSeconds);
      return true;
    } catch (error) {
      console.error("Error completing session:", error);
      return false;
    }
  });
  ipcMain.handle("sessions:updateProgress", async (event, { sessionId, activeSeconds, pausedSeconds }) => {
    if (!validateIPCSender(event)) return { ok: false, error: "unauthorized" };
    try {
      updateSessionProgress(String(sessionId), Number(activeSeconds), Number(pausedSeconds));
      return { ok: true };
    } catch (error) {
      console.error("Error updating session progress:", error);
      return { ok: false, error: String(error) };
    }
  });
  ipcMain.handle("sessions:getAll", (event) => {
    if (!validateIPCSender(event)) return [];
    try {
      return getAllSessions();
    } catch (error) {
      console.error("Error getting all sessions:", error);
      return [];
    }
  });
  ipcMain.handle("sessions:saveProgress", async (event, payload: any) => {
    if (!validateIPCSender(event)) return { ok: false, error: "unauthorized" };
    try {
      const { sessionId, activeSeconds = 0, pausedSeconds = 0, _phase, _subjectName, breakSeconds = 0, persistPause = false } = payload || {};
      if (sessionId) {
        try {
          updateSessionProgress(String(sessionId), Number(activeSeconds || 0), Number(pausedSeconds || 0));
        } catch (err) {
          console.warn("updateSessionProgress failed:", err);
        }
      }
      const date = localDateString();
      if (breakSeconds > 0) {
        try {
          updateDailyStat(date, "break", { breakMinutes: Math.ceil(breakSeconds / 60) });
        } catch (err) {
          console.warn("updateDailyStat (break) failed:", err);
        }
      }
      if (persistPause && pausedSeconds > 0) {
        try {
          updateDailyStat(date, "pause", { pauseMinutes: Math.ceil(pausedSeconds / 60) });
        } catch (err) {
          console.warn("updateDailyStat (pause) failed:", err);
        }
      }
      return { ok: true };
    } catch (error) {
      console.error("Error saving session progress:", error);
      return { ok: false, error: String(error) };
    }
  });
  ipcMain.handle("db:query", (event, { table, where, options }) => {
    if (!validateIPCSender(event)) return [];
    try {
      return query(table, where, options);
    } catch (error) {
      console.error("Error querying:", error);
      return [];
    }
  });
  ipcMain.handle("db:insert", (event, { table, data }) => {
    if (!validateIPCSender(event)) throw new Error("unauthorized");
    try {
      return insert(table, data);
    } catch (error) {
      console.error("Error inserting:", error);
      throw error;
    }
  });
  ipcMain.handle("db:update", (event, { table, id, data }) => {
    if (!validateIPCSender(event)) return false;
    try {
      return update(table, id, data);
    } catch (error) {
      console.error("Error updating:", error);
      return false;
    }
  });
  ipcMain.handle("db:remove", (event, { table, id }) => {
    if (!validateIPCSender(event)) return false;
    try {
      return remove(table, id);
    } catch (error) {
      console.error("Error removing:", error);
      return false;
    }
  });
  ipcMain.handle("todos:getByDate", (event, date: string) => {
    if (!validateIPCSender(event)) return [];
    try {
      return getTodosByDate(date);
    } catch (error) {
      console.error("Error getting todos:", error);
      return [];
    }
  });
  ipcMain.handle("todos:add", (event, todo) => {
    if (!validateIPCSender(event)) return { success: false, error: "unauthorized" };
    try {
      return addTodo(todo as any);
    } catch (error) {
      console.error("Error adding todo:", error);
      return { success: false, error: "Failed to add todo" };
    }
  });
  ipcMain.handle("todos:update", (event, { id, updates }) => {
    if (!validateIPCSender(event)) return false;
    try {
      return updateTodo(id, updates);
    } catch (error) {
      console.error("Error updating todo:", error);
      return false;
    }
  });
  ipcMain.handle("todos:delete", (event, id: number) => {
    if (!validateIPCSender(event)) return false;
    try {
      return deleteTodo(id);
    } catch (error) {
      console.error("Error deleting todo:", error);
      return false;
    }
  });
  ipcMain.handle("store:getSettings", async (event) => {
    if (!validateIPCSender(event)) return null;
    try {
      return getSettings();
    } catch (err) {
      console.error("store:getSettings failed", err);
      return null;
    }
  });
  ipcMain.handle("store:setSettings", async (event, patch) => {
    if (!validateIPCSender(event)) throw new Error("unauthorized");
    try {
      return setSettings(patch);
    } catch (err) {
      console.error("store:setSettings failed", err);
      throw err;
    }
  });
  ipcMain.handle("store:getDailyStats", async (event) => {
    if (!validateIPCSender(event)) return [];
    try {
      return getDailyStats();
    } catch (err) {
      console.error("store:getDailyStats failed", err);
      return [];
    }
  });
  ipcMain.handle("store:getDailyStatsByDate", async (event, date: string) => {
    if (!validateIPCSender(event)) return [];
    try {
      return getDailyStatsByDate(date);
    } catch (err) {
      console.error("store:getDailyStatsByDate failed", err);
      return [];
    }
  });
  ipcMain.handle("store:addDailyStat", async (event, stat) => {
    if (!validateIPCSender(event)) throw new Error("unauthorized");
    try {
      return addDailyStat(stat);
    } catch (err) {
      console.error("store:addDailyStat failed", err);
      throw err;
    }
  });
  ipcMain.handle("store:getSubjectTotals", async (event) => {
    if (!validateIPCSender(event)) return {};
    try {
      return getSubjectTotals();
    } catch (err) {
      console.error("store:getSubjectTotals failed", err);
      return {};
    }
  });
  ipcMain.handle("store:incrementSubjectTotal", async (event, subjectName, minutes) => {
    if (!validateIPCSender(event)) throw new Error("unauthorized");
    try {
      return incrementSubjectTotal(subjectName, minutes);
    } catch (err) {
      console.error("store:incrementSubjectTotal failed", err);
      throw err;
    }
  });

  // Add this to your main process (main.ts) after the other IPC handlers

  // Timer Database IPC Handlers
  ipcMain.handle("timerDb:checkIfSubjectExists", async (event, subject: string) => {
    if (!validateIPCSender(event)) return false;
    try {
      return timerDb.checkIfSubjectExists(subject);
    } catch (error) {
      console.error("[TimerDB] Error checking subject existence:", error);
      return false;
    }
  });

  ipcMain.handle("timerDb:addOrUpdateTimerData", async (event, subject: string, date: string, minutesToAdd: number) => {
    if (!validateIPCSender(event)) throw new Error("unauthorized");
    try {
      return timerDb.addOrUpdateTimerData(subject, date, minutesToAdd);
    } catch (error) {
      console.error("[TimerDB] Error adding/updating timer data:", error);
      throw error;
    }
  });

  ipcMain.handle("timerDb:getAllSubjects", async (event) => {
    if (!validateIPCSender(event)) return [];
    try {
      return timerDb.getAllSubjects();
    } catch (error) {
      console.error("[TimerDB] Error getting all subjects:", error);
      return [];
    }
  });

  ipcMain.handle("timerDb:hideSubject", async (event, subject: string) => {
    if (!validateIPCSender(event)) return false;
    try {
      return timerDb.hideSubject(subject);
    } catch (error) {
      console.error("[TimerDB] Error hiding subject:", error);
      return false;
    }
  });

  ipcMain.handle("timerDb:unhideSubject", async (event, subject: string) => {
    if (!validateIPCSender(event)) return false;
    try {
      return timerDb.unhideSubject(subject);
    } catch (error) {
      console.error("[TimerDB] Error unhiding subject:", error);
      return false;
    }
  });

  ipcMain.handle("timerDb:deleteSubjectCompletely", async (event, subject: string) => {
    if (!validateIPCSender(event)) return false;
    try {
      return timerDb.deleteSubjectCompletely(subject);
    } catch (error) {
      console.error("[TimerDB] Error deleting subject:", error);
      return false;
    }
  });

  ipcMain.handle("timerDb:getSubjectTotalsByDateRange", async (event, startDate?: string, endDate?: string) => {
    if (!validateIPCSender(event)) return [];
    try {
      return timerDb.getSubjectTotalsByDateRange(startDate, endDate);
    } catch (error) {
      console.error("[TimerDB] Error getting subject totals:", error);
      return [];
    }
  });

  ipcMain.handle("timerDb:getDailyAggregatedData", async (event, startDate?: string, endDate?: string) => {
    if (!validateIPCSender(event)) return [];
    try {
      return timerDb.getDailyAggregatedData(startDate, endDate);
    } catch (error) {
      console.error("[TimerDB] Error getting daily aggregated data:", error);
      return [];
    }
  });

  ipcMain.handle("timerDb:getSubjectDateAggregatedData", async (event, startDate?: string, endDate?: string) => {
    if (!validateIPCSender(event)) return [];
    try {
      return timerDb.getSubjectDateAggregatedData(startDate, endDate);
    } catch (error) {
      console.error("[TimerDB] Error getting subject-date aggregated data:", error);
      return [];
    }
  });
  ipcMain.handle("store:removeSubjectTotal", async (event, subjectName) => {
    if (!validateIPCSender(event)) throw new Error("unauthorized");
    try {
      return removeSubjectFromStore(subjectName);
    } catch (err) {
      console.error("store:removeSubjectTotal failed", err);
      throw err;
    }
  });
  ipcMain.handle("store:startSession", async (event, subjectName, subjectId) => {
    if (!validateIPCSender(event)) throw new Error("unauthorized");
    try {
      return startSessionInStore(subjectName, subjectId);
    } catch (err) {
      console.error("store:startSession failed", err);
      throw err;
    }
  });
  // ✨ 2. ADD THIS NEW IPC HANDLER ✨
  ipcMain.handle("todos:getAll", (event) => {
    if (!validateIPCSender(event)) return [];
    try {
      return getAllTodos();
    } catch (error) {
      console.error("Error getting all todos:", error);
      return [];
    }
  });
  ipcMain.handle("store:completeSession", async (event, sessionId, durationMinutes, pausedSeconds) => {
    if (!validateIPCSender(event)) throw new Error("unauthorized");
    try {
      return completeSessionInStore(sessionId, durationMinutes, pausedSeconds);
    } catch (err) {
      console.error("store:completeSession failed", err);
      throw err;
    }
  });
  ipcMain.handle("store:getSessionsForDate", async (event, date: string) => {
    if (!validateIPCSender(event)) return [];
    try {
      return getSessionsForDate(date);
    } catch (err) {
      console.error("store:getSessionsForDate failed", err);
      return [];
    }
  });
  ipcMain.handle("store:getAllSessions", async (event) => {
    if (!validateIPCSender(event)) return [];
    try {
      return getAllSessionsFromStore();
    } catch (err) {
      console.error("store:getAllSessions failed", err);
      return [];
    }
  });
  ipcMain.handle("todos:getStarred", (event) => {
    if (!validateIPCSender(event)) return [];
    try {
      return getStarredTodos();
    } catch (error) {
      console.error("Error getting starred todos:", error);
      return [];
    }
  });
  ipcMain.handle("stats:getSubjectTimeStats", (event, { startDate, endDate }) => {
    if (!validateIPCSender(event)) return [];
    try {
      return getSubjectTimeStats(startDate, endDate);
    } catch (error) {
      console.error("Error getting subject time stats:", error);
      return [];
    }
  });
  ipcMain.handle("sessions:getForMonth", (event, { year, month }) => {
    if (!validateIPCSender(event)) return [];
    try {
      return getSessionsForMonth(year, month);
    } catch (error) {
      console.error("Error getting sessions for month:", error);
      return [];
    }
  });
  ipcMain.handle("settings:setViewBackground", async (event, { view, file }) => {
    if (!validateIPCSender(event)) throw new Error("unauthorized");
    try {
      const userData = app.getPath("userData");
      const backgroundsDir = path.join(userData, "backgrounds");
      if (!fs.existsSync(backgroundsDir)) {
        fs.mkdirSync(backgroundsDir, { recursive: true });
      }
      const safeName = `${view}_${file.name}`.replace(/[^a-zA-Z0-9.-]/g, "_");
      const destPath = path.join(backgroundsDir, safeName);
      fs.writeFileSync(destPath, Buffer.from(file.data));
      const relativePath = path.relative(userData, destPath);
      await setViewBackground(view, relativePath);
      return relativePath;
    } catch (error) {
      console.error("Error saving background for view:", view, error);
      throw error;
    }
  });

  ipcMain.handle("timerDb:getHiddenSubjects", async (event) => {
    if (!validateIPCSender(event)) return [];
    try {
      return timerDb.getHiddenSubjects();
    } catch (error) {
      console.error("[TimerDB] Error getting hidden subjects:", error);
      return [];
    }
  });
  ipcMain.handle("settings:getViewBackground", async (event, view: string) => {
    if (!validateIPCSender(event)) return null;
    try {
      const userData = app.getPath("userData");
      const relativePath = await getViewBackground(view);
      if (!relativePath) return null;
      return path.join(userData, relativePath);
    } catch (error) {
      console.error("Error loading background for view:", view, error);
      return null;
    }
  });
  ipcMain.handle("settings:getViewBackgroundData", async (event, view: string) => {
    if (!validateIPCSender(event)) return null;
    try {
      const userData = app.getPath("userData");
      const relativePath = await getViewBackground(view);
      if (!relativePath) return null;
      const fullPath = path.join(userData, relativePath);
      if (!fs.existsSync(fullPath)) return null;
      const imageBuffer = fs.readFileSync(fullPath);
      const base64Image = imageBuffer.toString("base64");
      const mimeType = getMimeType(fullPath);
      return `data:${mimeType};base64,${base64Image}`;
    } catch (error) {
      console.error("Error reading background data for view:", view, error);
      return null;
    }
  });
  ipcMain.handle("settings:removeViewBackground", async (event, view: string) => {
    if (!validateIPCSender(event)) return false;
    try {
      const userData = app.getPath("userData");
      const relativePath = await getViewBackground(view);
      if (relativePath) {
        const fullPath = path.join(userData, relativePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      await removeViewBackground(view);
      return true;
    } catch (error) {
      console.error("Error removing background for view:", view, error);
      return false;
    }
  });
  ipcMain.handle("settings:getAllBackgrounds", async (event) => {
    if (!validateIPCSender(event)) return {};
    try {
      return await getAllBackgrounds();
    } catch (error) {
      console.error("Error getting all backgrounds:", error);
      return {};
    }
  });
  ipcMain.handle("tray:set-state", (event, state: "active" | "idle") => {
    if (!validateIPCSender(event)) return;
    if (!tray) return;
    try {
      const isIdle = state === "idle";
      const iconPath = getIconPath(isIdle);
      const iconImage = nativeImage.createFromPath(iconPath);
      if (process.platform === "win32") {
        tray.setImage(iconImage.resize({ width: 16, height: 16 }));
      } else {
        tray.setImage(iconImage);
      }
    } catch (error) {
      console.error("Failed to update tray icon:", error);
    }
  });

  app.whenReady().then(() => {
    powerSaveBlocker.start("prevent-app-suspension");
    runDataMigrations();
    initDb();
    createWindow();
    createAppTray(mainWindow ?? undefined);
    initNotificationsAndReminders(mainWindow ?? undefined);
  });
}
