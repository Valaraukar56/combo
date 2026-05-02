const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    title: 'Combo',
    autoHideMenuBar: true,
  });

  win.loadFile(path.join(__dirname, '../dist/index.html'));
  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  // Vérifie les mises à jour silencieusement au démarrage. Le renderer affiche
  // une bannière custom (voir UpdateBanner.tsx) quand l'update est téléchargée.
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-downloaded', (info) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-ready', {
        version: info?.version ?? null,
        releaseName: info?.releaseName ?? null,
        releaseNotes: typeof info?.releaseNotes === 'string' ? info.releaseNotes : null,
      });
    }
  });

  // Le renderer demande l'installation après que l'utilisateur ait cliqué
  // « Redémarrer » dans la modale custom.
  ipcMain.on('update-install', () => {
    autoUpdater.quitAndInstall();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
