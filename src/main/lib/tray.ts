import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import { getIconPath } from './window';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = nativeImage.createFromPath(getIconPath('icon.ico'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Clarity');

  tray.on('click', () => {
    mainWindow.show();
  });

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => mainWindow.show(),
      },
      {
        label: 'Quit',
        click: () => {
          (global as any).isQuitting = true;
          app.quit();
        },
      },
    ])
  );

  return tray;
}

export function setTrayState(state: 'active' | 'idle') {
  if (!tray) return;
  const iconName = state === 'active' ? 'icon.ico' : 'icon-bw.ico';
  const icon = nativeImage.createFromPath(getIconPath(iconName));
  tray.setImage(icon.resize({ width: 16, height: 16 }));
}
