import { BrowserWindow } from 'electron';
import { registerAuthHandlers } from './auth.ipc';
import { registerTimerHandlers } from './timer.ipc';
import { registerTasksHandlers } from './tasks.ipc';
import { registerNotesHandlers } from './notes.ipc';
import { registerSettingsHandlers } from './settings.ipc';

let activeUserId: string | null = null;

export function getActiveUserId(): string {
  return activeUserId ?? '';
}

export function setActiveUserId(userId: string | null) {
  activeUserId = userId;
}

export function registerAllIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  const getUserId = () => activeUserId ?? '';

  registerAuthHandlers(getMainWindow);
  registerTimerHandlers(getMainWindow, getUserId);
  registerTasksHandlers(getMainWindow, getUserId);
  registerNotesHandlers(getMainWindow, getUserId);
  registerSettingsHandlers(getMainWindow, getUserId);
}
