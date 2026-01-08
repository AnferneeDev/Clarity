import { contextBridge, ipcRenderer } from "electron";

/**
 * Clarity v2 - Preload
 * 
 * Exposes IPC handlers to renderer.
 * Backend consists of 'storage.ts' (JSON) and 'main.ts' (IPC).
 */

contextBridge.exposeInMainWorld("electronAPI", {
  // Core
  notify: (title: string, body: string) => ipcRenderer.invoke("notify", title, body),
  playSound: (soundName: string) => ipcRenderer.invoke("playSound", soundName),
  setTrayState: (state: "active" | "idle") => ipcRenderer.invoke("setTrayState", state),

  // Auth
  auth: {
    login: (u: string, p: string) => ipcRenderer.invoke("auth:login", { username: u, password: p }),
    register: (u: string, p: string) => ipcRenderer.invoke("auth:register", { username: u, password: p }),
    verify: (id: string) => ipcRenderer.invoke("auth:verify", id),
    logout: () => ipcRenderer.invoke("auth:logout"),
  },

  // Timer / Subjects
  timerDb: {
    getAllSubjects: () => ipcRenderer.invoke("timerDb:getAllSubjects"),
    checkIfSubjectExists: (name: string) => ipcRenderer.invoke("timerDb:checkIfSubjectExists", name),
    addOrUpdateTimerData: (subject: string, date: string, minutes: number) => 
      ipcRenderer.invoke("timerDb:addOrUpdateTimerData", subject, date, minutes),
    addSubject: (name: string) => ipcRenderer.invoke("timerDb:addSubject", name),
    hideSubject: (name: string) => ipcRenderer.invoke("timerDb:hideSubject", name),
    unhideSubject: (name: string) => ipcRenderer.invoke("timerDb:unhideSubject", name),
    deleteSubjectCompletely: (name: string) => ipcRenderer.invoke("timerDb:deleteSubjectCompletely", name),
    getHiddenSubjects: () => ipcRenderer.invoke("timerDb:getHiddenSubjects"),
    getSubjectTotalsByDateRange: (start?: string, end?: string) => 
      ipcRenderer.invoke("timerDb:getSubjectTotalsByDateRange", start, end),
    getDailyAggregatedData: (start?: string, end?: string) => 
      ipcRenderer.invoke("timerDb:getDailyAggregatedData", start, end),
    getSubjectDateAggregatedData: (start?: string, end?: string) => 
      ipcRenderer.invoke("timerDb:getSubjectDateAggregatedData", start, end),
  },

  // Todos
  getAllTodos: () => ipcRenderer.invoke("todos:getAll"),
  addTodo: (todo: any) => ipcRenderer.invoke("todos:add", todo),
  updateTodo: (id: number, updates: any) => ipcRenderer.invoke("todos:update", { id, updates }),
  deleteTodo: (id: number) => ipcRenderer.invoke("todos:delete", id),

  // Notes (generic query interface for compatibility)
  query: (table: string, where?: any, options?: any) => ipcRenderer.invoke("db:query", { table, where, options }),
  insert: (table: string, data: any) => ipcRenderer.invoke("db:insert", { table, data }),
  update: (table: string, id: number, data: any) => ipcRenderer.invoke("db:update", { table, id, data }),
  remove: (table: string, id: number) => ipcRenderer.invoke("db:remove", { table, id }),

  // Backgrounds
  setViewBackground: (view: string, file: { name: string; data: Uint8Array }) => 
    ipcRenderer.invoke("setViewBackground", view, file),
  getViewBackground: (view: string) => ipcRenderer.invoke("getViewBackground", view),
  getViewBackgroundData: (view: string) => ipcRenderer.invoke("getViewBackgroundData", view),
  getAllBackgrounds: () => ipcRenderer.invoke("getAllBackgrounds"),
  removeViewBackground: (view: string) => ipcRenderer.invoke("removeViewBackground", view),
});
