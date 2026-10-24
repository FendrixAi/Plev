const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desk', {
  popup: () => ipcRenderer.send('popup'),
  mini: (on) => ipcRenderer.send('mini', on),
  state: (s) => ipcRenderer.send('state', s),
  onCmd: (cb) => ipcRenderer.on('cmd', (e, c) => cb(c)),
  warn8: () => ipcRenderer.send('warn8'),
  saveMiniSettings: (s) => ipcRenderer.send('save-mini-settings', s),
  getMiniSettings: () => ipcRenderer.invoke('get-mini-settings')
});
