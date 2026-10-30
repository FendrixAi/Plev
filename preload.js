const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desk', {
  setTheme: (mode) => ipcRenderer.send('theme', mode),
  popup: () => ipcRenderer.send('popup'),
  mini: (on) => ipcRenderer.send('mini', on),
  state: (s) => ipcRenderer.send('state', s),
  onCmd: (cb) => ipcRenderer.on('cmd', (e, c) => cb(c)),
  warn8: () => ipcRenderer.send('warn8'),
  saveMiniSettings: (s) => ipcRenderer.send('save-mini-settings', s),
  getMiniSettings: () => ipcRenderer.invoke('get-mini-settings'),
  libraryPick: () => ipcRenderer.invoke('library:pick'),
  libraryImport: (req) => ipcRenderer.invoke('library:import', req),
  libraryOpen: (req) => ipcRenderer.invoke('library:open', req),
  libraryDeleteFile: (req) => ipcRenderer.invoke('library:delete-file', req),
  libraryCleanupPending: (req) => ipcRenderer.invoke('library:cleanup-pending', req),
  libraryRecoverDeletions: () => ipcRenderer.invoke('library:recover-deletions'),
  libraryCheckFiles: (req) => ipcRenderer.invoke('library:check-files', req)
});
