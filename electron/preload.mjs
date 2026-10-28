import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readConfig: () => ipcRenderer.invoke('read-config'),
  writeConfig: (data) => ipcRenderer.invoke('write-config', data),
  printToPdf: (defaultName) => ipcRenderer.invoke('print-to-pdf', defaultName),
  savePdf: (defaultName) => ipcRenderer.invoke('save-pdf', defaultName),
  printDocument: () => ipcRenderer.invoke('print-document'),
  getHistoryPage: (query, page, limit) => ipcRenderer.invoke('get-history-page', { query, page, limit }),
  saveInvoice: (data) => ipcRenderer.invoke('save-invoice', data),
  deleteInvoice: (id) => ipcRenderer.invoke('delete-invoice', id),
  getAllHistory: () => ipcRenderer.invoke('get-all-history'),
  getParties: (query) => ipcRenderer.invoke('get-parties', query),
});
