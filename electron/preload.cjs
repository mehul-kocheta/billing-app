const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readConfig: () => ipcRenderer.invoke('read-config'),
  writeConfig: (data) => ipcRenderer.invoke('write-config', data),
  printToPdf: () => ipcRenderer.invoke('print-to-pdf'),
  getHistoryPage: (query, page, limit) => ipcRenderer.invoke('get-history-page', { query, page, limit }),
  saveInvoice: (data) => ipcRenderer.invoke('save-invoice', data),
  deleteInvoice: (id) => ipcRenderer.invoke('delete-invoice', id),
  getAllHistory: () => ipcRenderer.invoke('get-all-history'),
  getParties: (query) => ipcRenderer.invoke('get-parties', query),
});
