export type AgentStatus =
  | 'starting'
  | 'busy'
  | 'waiting'
  | 'idle'
  | 'done'
  | 'error'

export interface Agent {
  id: string
  name: string
  cwd: string
  /** Command typed into the login shell once it spawns (default "claude"). */
  command: string
}

/** Persisted app state living in userData/muticode.json. */
export interface PersistedState {
  agents: Agent[]
  /** Column layout as a map of agent id -> size percentage (0..100). */
  columnLayout: Record<string, number>
}

export interface CreateAgentInput {
  name: string
  cwd: string
  command: string
}

/** renderer → main (invoke) */
export interface MutiApi {
  listAgents: () => Promise<Agent[]>
  createAgent: (input: CreateAgentInput) => Promise<Agent>
  removeAgent: (id: string) => Promise<void>
  restartAgent: (id: string) => Promise<void>
  writeToAgent: (id: string, data: string) => void
  resizeAgent: (id: string, cols: number, rows: number) => void
  pickDirectory: () => Promise<string | null>
  getColumnLayout: () => Promise<Record<string, number>>
  saveColumnLayout: (layout: Record<string, number>) => void
  /** Subscribe to raw PTY output for an agent. Returns an unsubscribe fn. */
  onData: (id: string, cb: (data: string) => void) => () => void
  /** Subscribe to status changes for any agent. Returns an unsubscribe fn. */
  onStatus: (cb: (id: string, status: AgentStatus) => void) => () => void
  /** Subscribe to agent removal (e.g. exited & cleaned). Returns unsubscribe fn. */
  onAgentExit: (cb: (id: string, status: AgentStatus) => void) => () => void
}

export const IPC = {
  listAgents: 'agents:list',
  createAgent: 'agents:create',
  removeAgent: 'agents:remove',
  restartAgent: 'agents:restart',
  writeToAgent: 'pty:write',
  resizeAgent: 'pty:resize',
  pickDirectory: 'dialog:pickDirectory',
  getColumnLayout: 'columns:get',
  saveColumnLayout: 'columns:save',
  ptyDataPrefix: 'pty:data:',
  statusEvent: 'agent:status',
  exitEvent: 'agent:exit'
} as const
