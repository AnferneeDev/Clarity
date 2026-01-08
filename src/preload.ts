import { contextBridge, ipcRenderer } from "electron";

/**
 * Minimal electronAPI for Clarity v2
 * 
 * Most data operations now happen in the renderer via dataService.
 * This preload only exposes what MUST go through the main process:
 * - Notifications (native OS notifications)
 * - Sound playback
 * - Tray icon state
 */
contextBridge.exposeInMainWorld("electronAPI", {
  // ============================================
  // Notifications (must be in main process)
  // ============================================
  notify: (title: string, body: string) => 
    ipcRenderer.invoke("notify", { title, body }),

  // ============================================
  // Sound playback (file system access)
  // ============================================
  playSound: (soundName: string) => 
    ipcRenderer.invoke("play-sound", soundName),

  // ============================================
  // Tray icon state
  // ============================================
  setTrayState: (state: "active" | "idle") => 
    ipcRenderer.invoke("set-tray-state", state),
});

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: {
      notify: (title: string, body: string) => Promise<string>;
      playSound: (soundName: string) => Promise<void>;
      setTrayState: (state: "active" | "idle") => Promise<void>;
    };
  }
}
