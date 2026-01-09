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
    login: (username: string) => ipcRenderer.invoke("auth:login", { username }),
    logout: () => ipcRenderer.invoke("auth:logout"),
    getSession: () => ipcRenderer.invoke("auth:getSession"),
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

  // Chapters
  chapters: {
    getAll: () => ipcRenderer.invoke("chapters:getAll"),
    add: (chapter: any) => ipcRenderer.invoke("chapters:add", chapter),
    update: (id: string, updates: any) => ipcRenderer.invoke("chapters:update", { id, updates }),
    delete: (id: string) => ipcRenderer.invoke("chapters:delete", id),
    uploadImage: (file: { name: string; data: Uint8Array }) => ipcRenderer.invoke("chapters:uploadImage", file),
    getImage: (path: string) => ipcRenderer.invoke("chapters:getImage", path),
    reorder: (orderedIds: string[]) => ipcRenderer.invoke("chapters:reorder", orderedIds),
  },

  // Motivation
  motivation: {
    getAll: () => ipcRenderer.invoke("motivation:getAll"),
    add: (file: { name: string; data: Uint8Array }) => ipcRenderer.invoke("motivation:add", file),
    delete: (id: string) => ipcRenderer.invoke("motivation:delete", id),
    reorder: (orderedIds: string[]) => ipcRenderer.invoke("motivation:reorder", orderedIds),
    getImage: (path: string) => ipcRenderer.invoke("motivation:getImage", path),
  },

  // Game / Quest System
  game: {
    getData: () => ipcRenderer.invoke("game:getData"),
    // Skills
    addSkill: (skill: any) => ipcRenderer.invoke("game:addSkill", skill),
    updateSkill: (skillId: string, updates: any) => ipcRenderer.invoke("game:updateSkill", { skillId, updates }),
    deleteSkill: (skillId: string) => ipcRenderer.invoke("game:deleteSkill", skillId),
    // Quests
    addQuest: (quest: any) => ipcRenderer.invoke("game:addQuest", quest),
    deleteQuest: (questId: string) => ipcRenderer.invoke("game:deleteQuest", questId),
    completeQuest: (questId: string) => ipcRenderer.invoke("game:completeQuest", questId),
    // Habits
    addHabit: (habit: any) => ipcRenderer.invoke("game:addHabit", habit),
    deleteHabit: (habitId: string) => ipcRenderer.invoke("game:deleteHabit", habitId),
    completeHabit: (habitId: string) => ipcRenderer.invoke("game:completeHabit", habitId),
    // Character
    heal: (amount: number) => ipcRenderer.invoke("game:heal", amount),
    reset: () => ipcRenderer.invoke("game:reset"),
    updateCharacter: (updates: any) => ipcRenderer.invoke("game:updateCharacter", updates),
  },
});
