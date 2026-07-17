import { app, BrowserWindow, dialog, shell } from 'electron'
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
    width: 1600,
    height: 900,
    minWidth: 480,
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

  mainWindow.on('close', (e) => {
    // Guard the important, possibly long-running agent sessions against an
    // accidental close (red button, Cmd+W, Cmd+Q). Sync dialog lets us decide
    // preventDefault inline with no async race. No agents → nothing to lose.
    if (store.getAgents().length === 0) return
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: 'warning',
      buttons: ['取消', '退出'],
      defaultId: 0,
      cancelId: 0,
      message: '确定要退出 muticode 吗?',
      detail: '所有终端会话及其中运行的任务都会被终止。'
    })
    if (choice === 0) e.preventDefault()
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

// PTYs are disposed here — after windows have actually closed (i.e. the close
// confirmation passed). NOT in before-quit: on Cmd+Q that fires before the
// window close event, so disposing there would kill sessions the user may
// still cancel back into.
app.on('window-all-closed', () => {
  manager.disposeAll()
  if (process.platform !== 'darwin') app.quit()
})

// On Cmd+Q / app.quit(), Electron closes windows then emits will-quit (not
// window-all-closed), and only if no close handler called preventDefault — so
// this runs exactly when the user has confirmed the quit. disposeAll is
// idempotent, so overlapping with window-all-closed is harmless.
app.on('will-quit', () => {
  manager.disposeAll()
})
