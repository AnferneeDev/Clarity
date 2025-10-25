import { contextBridge, ipcRenderer } from "electron";
import { getAllTodos } from "./database";

/**
 * Expose a single electronAPI object to the renderer.
 * Keep handler shapes permissive (numbers or strings for IDs) to avoid mismatch issues.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  // Notifications
  notify: (title: string, body: string) => ipcRenderer.invoke("notify", { title, body }),

  // Sound playback
  playSound: (soundName: string) => ipcRenderer.invoke("play-sound", soundName),

  // Reminders - timestamp is epoch ms (number)
  addReminder: (reminder: { id: string; title: string; body?: string; timestamp: number }) => ipcRenderer.invoke("reminder:add", reminder),
  listReminders: () => ipcRenderer.invoke("reminder:list"),
  removeReminder: (id: string) => ipcRenderer.invoke("reminder:remove", id),

  // Dashboard
  getDashboardData: (date?: string) => ipcRenderer.invoke("dashboard:getData", date),

  // Sessions (start may return numeric id or string id depending on implementation)
  startSession: (subjectId: number | string) => ipcRenderer.invoke("sessions:start", subjectId),
  completeSession: (sessionId: number | string, durationMinutes: number, pausedSeconds: number) => ipcRenderer.invoke("sessions:complete", { sessionId, durationMinutes, pausedSeconds }),
  getAllSessions: () => ipcRenderer.invoke("sessions:getAll"),

  // Generic CRUD (keeps existing SQL-backed endpoints for todos/backgrounds)
  query: (table: string, where?: any, options?: any) => ipcRenderer.invoke("db:query", { table, where, options }),
  insert: (table: string, data: any) => ipcRenderer.invoke("db:insert", { table, data }),
  update: (table: string, id: number | string, data: any) => ipcRenderer.invoke("db:update", { table, id, data }),
  remove: (table: string, id: number | string) => ipcRenderer.invoke("db:remove", { table, id }),

  // Todo APIs (unchanged)
  getTodosByDate: (date: string) => ipcRenderer.invoke("todos:getByDate", date),
  addTodo: (todo: { date: string; text: string; subjectId?: number; starred?: boolean; dueDate?: string }) => ipcRenderer.invoke("todos:add", todo),
  updateTodo: (id: number | string, updates: { done?: boolean; starred?: boolean; text?: string; dueDate?: string }) => ipcRenderer.invoke("todos:update", { id, updates }),
  deleteTodo: (id: number | string) => ipcRenderer.invoke("todos:delete", id),
  getStarredTodos: () => ipcRenderer.invoke("todos:getStarred"),
  // ✨ THIS IS THE CORRECTED LINE, ADDED HERE ✨
  getAllTodos: () => ipcRenderer.invoke("todos:getAll"),

  // store helper (remove subject totals / daily stats for a subject)
  removeSubjectTotal: (subjectName: string) => ipcRenderer.invoke("store:removeSubjectTotal", subjectName),

  // Stats / reporting
  getSubjectTimeStats: (startDate?: string, endDate?: string) => ipcRenderer.invoke("stats:getSubjectTimeStats", { startDate, endDate }),
  getSessionsForMonth: (year: number, month: number) => ipcRenderer.invoke("sessions:getForMonth", { year, month }),

  // Added the missing IPC handlers for store data
  getSessionsForDateWrapper: (date: string) => ipcRenderer.invoke("store:getSessionsForDate", date),
  getDailyStatsWrapper: () => ipcRenderer.invoke("store:getDailyStats"),
  getSubjectTotalsWrapper: () => ipcRenderer.invoke("store:getSubjectTotals"),

  // Backgrounds (unchanged)
  setViewBackground: (view: string, file: { name: string; data: Uint8Array }) => ipcRenderer.invoke("settings:setViewBackground", { view, file }),
  getViewBackground: (view: string) => ipcRenderer.invoke("settings:getViewBackground", view),
  getViewBackgroundData: (view: string) => ipcRenderer.invoke("settings:getViewBackgroundData", view),
  getAllBackgrounds: () => ipcRenderer.invoke("settings:getAllBackgrounds"),
  removeViewBackground: (view: string) => ipcRenderer.invoke("settings:removeViewBackground", view),
  setTrayState: (state: "active" | "idle") => ipcRenderer.invoke("tray:set-state", state),
  incrementSubjectTotal: (subjectName: string, minutes: number) => ipcRenderer.invoke("store:incrementSubjectTotal", subjectName, minutes),

  // Save live session progress
  saveSessionProgress: (payload: { sessionId?: string | number; activeSeconds?: number; pausedSeconds?: number; phase?: string; subjectName?: string; breakSeconds?: number; persistPause?: boolean }) =>
    ipcRenderer.invoke("sessions:saveProgress", payload),
  updateSessionProgress: (sessionId: string | number, activeSeconds: number, pausedSeconds: number) => ipcRenderer.invoke("sessions:updateProgress", { sessionId, activeSeconds, pausedSeconds }),

  // Timer Database APIs
  timerDb: {
    checkIfSubjectExists: (subject: string) => ipcRenderer.invoke("timerDb:checkIfSubjectExists", subject),
    addOrUpdateTimerData: (subject: string, date: string, minutesToAdd: number) => ipcRenderer.invoke("timerDb:addOrUpdateTimerData", subject, date, minutesToAdd),
    getAllSubjects: () => ipcRenderer.invoke("timerDb:getAllSubjects"),
    hideSubject: (subject: string) => ipcRenderer.invoke("timerDb:hideSubject", subject),
    unhideSubject: (subject: string) => ipcRenderer.invoke("timerDb:unhideSubject", subject),
    deleteSubjectCompletely: (subject: string) => ipcRenderer.invoke("timerDb:deleteSubjectCompletely", subject),
    getSubjectTotalsByDateRange: (startDate?: string, endDate?: string) => ipcRenderer.invoke("timerDb:getSubjectTotalsByDateRange", startDate, endDate),
    getDailyAggregatedData: (startDate?: string, endDate?: string) => ipcRenderer.invoke("timerDb:getDailyAggregatedData", startDate, endDate),
    getSubjectDateAggregatedData: (startDate?: string, endDate?: string) => ipcRenderer.invoke("timerDb:getSubjectDateAggregatedData", startDate, endDate),
    getHiddenSubjects: () => ipcRenderer.invoke("timerDb:getHiddenSubjects"),
    // ✨ THE INCORRECT LINE WAS REMOVED FROM HERE ✨
  },
});

export {};

// global typing
declare global {
  interface Window {
    electronAPI: {
      // Notifications
      notify: (title: string, body: string) => Promise<any>;
      getAllTodos: () => Promise<any[]>;

      // Sound playback
      playSound: (soundName: string) => Promise<{ success: boolean; path?: string; error?: string }>;

      // Reminders (timestamp is epoch ms)
      addReminder: (reminder: { id: string; title: string; body?: string; timestamp: number }) => Promise<any>;
      listReminders: () => Promise<Array<{ id: string; title: string; body?: string; timestamp: number }>>;
      removeReminder: (id: string) => Promise<boolean>;

      // Dashboard
      getDashboardData: (date?: string) => Promise<any>;

      // Sessions
      startSession: (subjectId: number | string) => Promise<any>;
      completeSession: (sessionId: number | string, durationMinutes: number, pausedSeconds: number) => Promise<any>;
      getAllSessions: () => Promise<any[]>;
      saveSessionProgress: (payload: { sessionId?: string | number; activeSeconds?: number; pausedSeconds?: number; phase?: string; subjectName?: string; breakSeconds?: number; persistPause?: boolean }) => Promise<any>;
      updateSessionProgress: (sessionId: string | number, activeSeconds: number, pausedSeconds: number) => Promise<any>;

      // Tray
      setTrayState: (state: "active" | "idle") => Promise<void>;

      // Generic CRUD
      query: (table: string, where?: any, options?: any) => Promise<any[]>;
      insert: (table: string, data: any) => Promise<any>;
      update: (table: string, id: number | string, data: any) => Promise<any>;
      remove: (table: string, id: number | string) => Promise<any>;

      // Todo APIs
      getTodosByDate: (date: string) => Promise<any[]>;
      addTodo: (todo: { date: string; text: string; subjectId?: number; starred?: boolean; dueDate?: string }) => Promise<any>;
      updateTodo: (id: number | string, updates: { done?: boolean; starred?: boolean; text?: string; dueDate?: string }) => Promise<any>;
      deleteTodo: (id: number | string) => Promise<any>;
      getStarredTodos: () => Promise<any[]>;

      // Store helpers
      removeSubjectTotal: (subjectName: string) => Promise<any>;
      incrementSubjectTotal: (subjectName: string, minutes: number) => Promise<any>;

      // Stats / reporting
      getSubjectTimeStats: (startDate?: string, endDate?: string) => Promise<any[]>;
      getSessionsForMonth: (year: number, month: number) => Promise<any[]>;
      getSessionsForDateWrapper: (date: string) => Promise<any[]>;
      getDailyStatsWrapper: () => Promise<any[]>;
      getSubjectTotalsWrapper: () => Promise<any>;

      // Backgrounds
      setViewBackground: (view: string, file: { name: string; data: Uint8Array }) => Promise<any>;
      getViewBackground: (view: string) => Promise<string | null>;
      getViewBackgroundData: (view: string) => Promise<string | null>;
      getAllBackgrounds: () => Promise<Record<string, string>>;
      removeViewBackground: (view: string) => Promise<boolean>;

      // Timer Database APIs
      timerDb: {
        checkIfSubjectExists: (subject: string) => Promise<boolean>;
        addOrUpdateTimerData: (subject: string, date: string, minutesToAdd: number) => Promise<any>;
        getAllSubjects: () => Promise<string[]>;
        hideSubject: (subject: string) => Promise<boolean>;
        unhideSubject: (subject: string) => Promise<boolean>;
        deleteSubjectCompletely: (subject: string) => Promise<boolean>;
        getSubjectTotalsByDateRange: (startDate?: string, endDate?: string) => Promise<Array<{ subject: string; total_minutes: number }>>;
        getDailyAggregatedData: (startDate?: string, endDate?: string) => Promise<Array<{ date: string; total_minutes: number; subjects: string[] }>>;
        getSubjectDateAggregatedData: (startDate?: string, endDate?: string) => Promise<Array<{ subject: string; date: string; total_minutes: number }>>;
        getHiddenSubjects: () => Promise<string[]>;
      };
    };
  }
}
