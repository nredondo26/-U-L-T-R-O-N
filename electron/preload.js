const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('ultron', {
  version: '5.1.0',
  platform: process.platform,
});
