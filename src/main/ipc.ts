import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { CreateAgentInput } from '../shared/types'
import { IPC } from '../shared/types'
import { PtyManager } from './pty-manager'
import { Store } from './store'

export function registerIpc(store: Store, manager: PtyManager): void {
  ipcMain.handle(IPC.listAgents, () => store.getAgents())

  ipcMain.handle(IPC.createAgent, (_e, input: CreateAgentInput) => {
    const agent = manager.create(input)
    store.addAgent(agent)
    return agent
  })

  ipcMain.handle(IPC.removeAgent, (_e, id: string) => {
    manager.remove(id)
    store.removeAgent(id)
  })

  ipcMain.handle(IPC.restartAgent, (_e, id: string) => {
    manager.restart(id)
  })

  ipcMain.on(IPC.writeToAgent, (_e, id: string, data: string) => {
    manager.write(id, data)
  })

  ipcMain.on(IPC.resizeAgent, (_e, id: string, cols: number, rows: number) => {
    manager.resize(id, cols, rows)
  })

  ipcMain.handle(IPC.pickDirectory, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.getColumnLayout, () => store.getColumnLayout())

  ipcMain.on(IPC.saveColumnLayout, (_e, layout: Record<string, number>) => {
    store.setColumnLayout(layout)
  })
}
