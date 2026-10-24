const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mini', {
  onState: (cb) => ipcRenderer.on('state', (e, s) => cb(s)),
  onAlarm: (cb) => ipcRenderer.on('alarm', () => cb()),
  onWarn8: (cb) => ipcRenderer.on('warn8', () => cb()),
  onMiniSettings: (cb) => ipcRenderer.on('mini-settings', (e, s) => cb(s)),
  cmd: (c) => ipcRenderer.send('mini-cmd', c),
  ready: () => ipcRenderer.send('mini-ready'),
  hover: (on) => ipcRenderer.send('mini-hover', on)
});
