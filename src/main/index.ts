import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerIpc } from './ipc'
import { PtyManager } from './pty-manager'
import { Store } from './store'

let mainWindow: BrowserWindow | null = null

const store = new Store()
// A destroyed window is still a truthy object whose `webContents` getter throws,
// so guard with isDestroyed() — pty teardown on quit flushes final data events
// after the window is gone.
const manager = new PtyManager(() => {
  if (!mainWindow || mainWindow.isDestroyed()) return null
  const wc = mainWindow.webContents
  return wc.isDestroyed() ? null : wc
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 640,
    minHeight: 400,
    show: false,
    title: 'muticode',
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    // Restore persisted agents once the renderer can receive their output.
    for (const agent of store.getAgents()) manager.restore(agent)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  store.load()
  registerIpc(store, manager)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  manager.disposeAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  manager.disposeAll()
})
