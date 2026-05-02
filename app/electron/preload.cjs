// Preload script — runs in an isolated context with access to a limited
// subset of Node, and exposes a small safe API to the renderer via
// `window.combo`. We intentionally do NOT enable nodeIntegration in the
// renderer; all main↔renderer communication goes through these channels.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('combo', {
  /**
   * Subscribe to "update is downloaded and ready to install" notifications
   * coming from the main process. Returns an unsubscribe function.
   */
  onUpdateReady(callback) {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('update-ready', handler);
    return () => ipcRenderer.removeListener('update-ready', handler);
  },

  /**
   * Tell the main process to quit and install the downloaded update now.
   */
  installUpdate() {
    ipcRenderer.send('update-install');
  },
});
