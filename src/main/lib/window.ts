import { app, BrowserWindow } from 'electron';
import * as path from 'path';

const ASSETS_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

export function getIconPath(iconName: string): string {
  return path.join(ASSETS_PATH, iconName);
}

export function createMainWindow(preloadPath: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minHeight: 600,
    minWidth: 800,
    center: true,
    trafficLightPosition: { x: 10, y: 10 },
    icon: getIconPath('icon.ico'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    backgroundColor: '#000000',
    resizable: true,
    fullscreen: false,
    fullscreenable: true,
  });

  win.setMenu(null);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  return win;
}
