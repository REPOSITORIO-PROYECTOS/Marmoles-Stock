const { app, BrowserWindow, dialog, shell } = require('electron')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

const isDev = process.argv.includes('--dev')
const BACKEND_PORT = 8000
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`

let mainWindow = null
let splashWindow = null
let backendProcess = null

function getDataDir() {
  const dir = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getDbPath() {
  return path.join(getDataDir(), 'marmoles.db').replace(/\\/g, '/')
}

function getFrontendDir() {
  if (isDev) return null
  return path.join(process.resourcesPath, 'frontend')
}

function getExcelPath() {
  // Busca el Excel en resources (instalado) o junto al exe en dev
  const candidates = [
    path.join(process.resourcesPath || '', 'Control_Inventario_Marmoleria.xlsx'),
    path.join(app.getAppPath(), '..', 'Control_Inventario_Marmoleria.xlsx'),
  ]
  return candidates.find(p => fs.existsSync(p)) || null
}

function startBackend() {
  const frontendDir = getFrontendDir()
  const env = {
    ...process.env,
    DATABASE_URL: `sqlite:///${getDbPath()}`,
    ENABLE_COMMERCIAL_MODULES: 'true',
    HOST: '127.0.0.1',
    PORT: String(BACKEND_PORT),
    FRONTEND_DIST_DIR: frontendDir || '',
  }

  if (isDev) {
    const backendDir = path.join(__dirname, '..', 'backend')
    const python = path.join(backendDir, '.venv', 'Scripts', 'python.exe')
    backendProcess = spawn(python, [
      '-m', 'uvicorn', 'app.main:app',
      '--host', '127.0.0.1',
      '--port', String(BACKEND_PORT),
    ], { env, cwd: backendDir })
  } else {
    const exe = path.join(process.resourcesPath, 'backend', 'backend.exe')
    backendProcess = spawn(exe, [], { env, windowsHide: true })
  }

  backendProcess.stdout?.on('data', d => process.stdout.write(`[backend] ${d}`))
  backendProcess.stderr?.on('data', d => process.stderr.write(`[backend] ${d}`))
  backendProcess.on('exit', code => {
    if (code !== 0 && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'Error del servidor',
        `El servidor local se cerró inesperadamente (código ${code}).\nReiniciá la aplicación.`
      )
    }
  })
}

function waitForBackend(maxRetries = 40, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      const req = http.get(`${BACKEND_URL}/health`, res => {
        res.resume()
        if (res.statusCode === 200) return resolve()
        retry()
      })
      req.on('error', retry)
      req.setTimeout(800, () => { req.destroy(); retry() })

      function retry() {
        if (++attempts >= maxRetries) {
          return reject(new Error('El servidor no respondió después de 40 intentos'))
        }
        setTimeout(check, interval)
      }
    }
    setTimeout(check, 800)
  })
}

function showSplash() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    webPreferences: { contextIsolation: true },
  })
  splashWindow.loadFile(path.join(__dirname, 'splash.html'))
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Marmoles Taup · Sistema de Gestión',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(BACKEND_URL)

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close()
    splashWindow = null
    mainWindow.show()
    mainWindow.focus()
  })

  // Links externos se abren en el browser del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function setupAutoUpdater() {
  if (isDev) return
  autoUpdater.autoDownload = false

  autoUpdater.on('update-available', info => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización disponible',
      message: `Nueva versión ${info.version} disponible.\n¿Querés descargarla ahora?`,
      buttons: ['Sí, descargar', 'Más tarde'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate()
    })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Lista para instalar',
      message: 'La actualización se descargó. La app se va a reiniciar para instalarla.',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on('error', err => {
    console.error('Error en auto-updater:', err)
  })

  // Chequea actualizaciones 5 segundos después de abrir
  setTimeout(() => autoUpdater.checkForUpdates(), 5000)
}

function killBackend() {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
}

// ── Ciclo de vida de la app ──────────────────────────────────────────────────

app.whenReady().then(async () => {
  showSplash()
  startBackend()

  try {
    await waitForBackend()
    createMainWindow()
    setupAutoUpdater()
  } catch (err) {
    killBackend()
    dialog.showErrorBox(
      'Error al iniciar',
      `No se pudo iniciar el servidor local.\n\n${err.message}\n\nReiniciá la aplicación.`
    )
    app.quit()
  }
})

app.on('window-all-closed', () => {
  killBackend()
  app.quit()
})

app.on('before-quit', killBackend)
