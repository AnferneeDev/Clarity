import { contextBridge, ipcRenderer } from 'electron';

// ============================================
// Channel Whitelists
// ============================================
const AUTH_CHANNELS = [
  'auth:login',
  'auth:logout',
  'auth:getSession',
  'auth:signUp',
  'auth:oauth',
] as const;

const TIMER_CHANNELS = [
  'timer:getSubjects',
  'timer:addSubject',
  'timer:hideSubject',
  'timer:deleteSubject',
  'timer:deleteSubjectCompletely',
  'timer:saveSession',
  'timer:getSubjectTotals',
  'timer:getDailyAggregate',
  'timer:getSubjectDateAggregated',
] as const;

const TASKS_CHANNELS = [
  'tasks:getAll',
  'tasks:add',
  'tasks:update',
  'tasks:delete',
] as const;

const NOTES_CHANNELS = [
  'notes:getAll',
  'notes:add',
  'notes:update',
  'notes:delete',
] as const;

const SETTINGS_CHANNELS = [
  'settings:getBackground',
  'settings:getAllBackgrounds',
  'settings:setBackground',
  'settings:removeBackground',
  'settings:getPreferences',
  'settings:updatePreferences',
] as const;

const APP_CHANNELS = [
  'app:minimize',
  'app:maximize',
  'app:close',
  'tray:setState',
] as const;

const ALL_CHANNELS = [
  ...AUTH_CHANNELS,
  ...TIMER_CHANNELS,
  ...TASKS_CHANNELS,
  ...NOTES_CHANNELS,
  ...SETTINGS_CHANNELS,
  ...APP_CHANNELS,
] as const;

// ============================================
// Typed API exposed to renderer
// ============================================
contextBridge.exposeInMainWorld('electronAPI', {
  // Generic invoke (channel-whitelisted)
  invoke: (channel: string, ...args: unknown[]) => {
    if (ALL_CHANNELS.includes(channel as typeof ALL_CHANNELS[number])) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Channel "${channel}" not allowed`));
  },

  // ---- Auth ----
  auth: {
    login: (email: string, password: string) =>
      ipcRenderer.invoke('auth:login', email, password),

    signUp: (email: string, password: string) =>
      ipcRenderer.invoke('auth:signUp', email, password),

    oauth: (provider: string) =>
      ipcRenderer.invoke('auth:oauth', provider),

    onOAuthComplete: (callback: (result: { success: boolean; error?: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, result: { success: boolean; error?: string }) => {
        callback(result);
      };
      ipcRenderer.on('auth:oauth-complete', handler);
      return () => ipcRenderer.removeListener('auth:oauth-complete', handler);
    },

    logout: () =>
      ipcRenderer.invoke('auth:logout'),

    getSession: () =>
      ipcRenderer.invoke('auth:getSession'),
  },

  // ---- Timer ----
  timer: {
    getSubjects: () =>
      ipcRenderer.invoke('timer:getSubjects'),

    addSubject: (name: string) =>
      ipcRenderer.invoke('timer:addSubject', name),

    hideSubject: (name: string) =>
      ipcRenderer.invoke('timer:hideSubject', name),

    deleteSubject: (name: string) =>
      ipcRenderer.invoke('timer:deleteSubject', name),

    deleteSubjectCompletely: (name: string) =>
      ipcRenderer.invoke('timer:deleteSubjectCompletely', name),

    saveSession: (subjectName: string, date: string, minutes: number) =>
      ipcRenderer.invoke('timer:saveSession', subjectName, date, minutes),

    getSubjectTotals: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('timer:getSubjectTotals', startDate, endDate),

    getDailyAggregate: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('timer:getDailyAggregate', startDate, endDate),

    getSubjectDateAggregated: (startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('timer:getSubjectDateAggregated', startDate, endDate),
  },

  // ---- Tasks ----
  tasks: {
    getAll: () =>
      ipcRenderer.invoke('tasks:getAll'),

    add: (task: { text: string; starred?: boolean; due_date?: string }) =>
      ipcRenderer.invoke('tasks:add', task),

    update: (id: number, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('tasks:update', id, updates),

    delete: (id: number) =>
      ipcRenderer.invoke('tasks:delete', id),
  },

  // ---- Notes ----
  notes: {
    getAll: () =>
      ipcRenderer.invoke('notes:getAll'),

    add: (note: { title: string; content?: string; color?: string }) =>
      ipcRenderer.invoke('notes:add', note),

    update: (id: number, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('notes:update', id, updates),

    delete: (id: number) =>
      ipcRenderer.invoke('notes:delete', id),
  },

  // ---- Settings ----
  settings: {
    getBackground: (viewName: string) =>
      ipcRenderer.invoke('settings:getBackground', viewName),

    getAllBackgrounds: () =>
      ipcRenderer.invoke('settings:getAllBackgrounds'),

    setBackground: (viewName: string, file: { name: string; data: Uint8Array }) =>
      ipcRenderer.invoke('settings:setBackground', viewName, file),

    removeBackground: (viewName: string) =>
      ipcRenderer.invoke('settings:removeBackground', viewName),

    getPreferences: () =>
      ipcRenderer.invoke('settings:getPreferences'),

    updatePreferences: (updates: Record<string, unknown>) =>
      ipcRenderer.invoke('settings:updatePreferences', updates),
  },

  // ---- App ----
  app: {
    minimize: () => ipcRenderer.invoke('app:minimize'),
    maximize: () => ipcRenderer.invoke('app:maximize'),
    close: () => ipcRenderer.invoke('app:close'),
    setTrayState: (state: 'active' | 'idle') => ipcRenderer.invoke('tray:setState', state),
  },
});
