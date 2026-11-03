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
  updateStatus: () => ipcRenderer.invoke('update:status'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateCancel: () => ipcRenderer.invoke('update:cancel'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => ipcRenderer.on('update:status', (e, s) => cb(s)),
  onUpdateOpen: (cb) => ipcRenderer.on('update:open', () => cb()),
  // Proses utama minta isi data sebelum memasang pembaruan; jawabannya dicadangkan ke disk.
  onUpdatePrepare: (provide) => ipcRenderer.on('update:prepare', () => {
    let json = null;
    try { json = provide(); } catch (err) { json = null; }
    ipcRenderer.invoke('update:backup', json);
  }),
  libraryPick: (req) => ipcRenderer.invoke('library:pick', req),
  libraryStoreGenerated: (req) => ipcRenderer.invoke('library:store-generated', req),
  libraryImport: (req) => ipcRenderer.invoke('library:import', req),
  libraryOpen: (req) => ipcRenderer.invoke('library:open', req),
  libraryDeleteFile: (req) => ipcRenderer.invoke('library:delete-file', req),
  libraryCleanupPending: (req) => ipcRenderer.invoke('library:cleanup-pending', req),
  libraryRecoverDeletions: () => ipcRenderer.invoke('library:recover-deletions'),
  libraryCheckFiles: (req) => ipcRenderer.invoke('library:check-files', req)
});
