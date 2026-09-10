const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  redeemActivationToken: (token) => ipcRenderer.invoke('redeem-activation-token', token),
  saveOfflineSale: (sale) => ipcRenderer.invoke('save-offline-sale', sale),
  getOfflineSaleCount: () => ipcRenderer.invoke('get-offline-sale-count'),
  syncOfflineSales: (config) => ipcRenderer.invoke('sync-offline-sales', config),
  getTerminalStatus: () => ipcRenderer.invoke('get-terminal-status'),
});