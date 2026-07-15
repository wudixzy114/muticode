import { contextBridge, ipcRenderer } from 'electron'
import type {
  Agent,
  AgentStatus,
  CreateAgentInput,
  MutiApi
} from '../shared/types'
import { IPC } from '../shared/types'

const api: MutiApi = {
  listAgents: () => ipcRenderer.invoke(IPC.listAgents),
  createAgent: (input: CreateAgentInput) => ipcRenderer.invoke(IPC.createAgent, input),
  removeAgent: (id: string) => ipcRenderer.invoke(IPC.removeAgent, id),
  restartAgent: (id: string) => ipcRenderer.invoke(IPC.restartAgent, id),
  writeToAgent: (id: string, data: string) => ipcRenderer.send(IPC.writeToAgent, id, data),
  resizeAgent: (id: string, cols: number, rows: number) =>
    ipcRenderer.send(IPC.resizeAgent, id, cols, rows),
  pickDirectory: () => ipcRenderer.invoke(IPC.pickDirectory),
  getColumnLayout: () => ipcRenderer.invoke(IPC.getColumnLayout),
  saveColumnLayout: (layout: Record<string, number>) =>
    ipcRenderer.send(IPC.saveColumnLayout, layout),

  onData: (id: string, cb: (data: string) => void) => {
    const channel = IPC.ptyDataPrefix + id
    const listener = (_e: unknown, data: string): void => cb(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },

  onStatus: (cb: (id: string, status: AgentStatus) => void) => {
    const listener = (_e: unknown, id: string, status: AgentStatus): void => cb(id, status)
    ipcRenderer.on(IPC.statusEvent, listener)
    return () => ipcRenderer.removeListener(IPC.statusEvent, listener)
  },

  onAgentExit: (cb: (id: string, status: AgentStatus) => void) => {
    const listener = (_e: unknown, id: string, status: AgentStatus): void => cb(id, status)
    ipcRenderer.on(IPC.exitEvent, listener)
    return () => ipcRenderer.removeListener(IPC.exitEvent, listener)
  }
}

contextBridge.exposeInMainWorld('muti', api)

export type { Agent }
