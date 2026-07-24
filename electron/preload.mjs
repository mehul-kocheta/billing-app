import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readConfig: () => ipcRenderer.invoke('read-config'),
  writeConfig: (data) => ipcRenderer.invoke('write-config', data),
  printToPdf: () => ipcRenderer.invoke('print-to-pdf'),
  readHistory: () => ipcRenderer.invoke('read-history'),
  writeHistory: (data) => ipcRenderer.invoke('write-history', data),
});
