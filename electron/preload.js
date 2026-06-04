// Preload mínimo — la app carga desde localhost, no necesita bridge IPC por ahora
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronApp', {
  version: process.env.npm_package_version || '1.0.0',
  platform: process.platform,
})
