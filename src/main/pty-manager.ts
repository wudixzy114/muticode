import { randomUUID } from 'crypto'
import type { IpcMain, WebContents } from 'electron'
import * as pty from 'node-pty'
import type { Agent, AgentStatus, CreateAgentInput } from '../shared/types'
import { IPC } from '../shared/types'
import { StatusTracker } from './status-detector'

interface Session {
  agent: Agent
  proc: pty.IPty
  tracker: StatusTracker
  timer: NodeJS.Timeout
}

const DEFAULT_SHELL = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : 'zsh')
const POLL_MS = 500

export class PtyManager {
  private sessions = new Map<string, Session>()

  constructor(private getWebContents: () => WebContents | null) {}

  private emitStatus(id: string, status: AgentStatus): void {
    this.getWebContents()?.send(IPC.statusEvent, id, status)
  }

  private emitData(id: string, data: string): void {
    this.getWebContents()?.send(IPC.ptyDataPrefix + id, data)
  }

  /** Spawn a login shell in the agent's cwd and type its command. */
  private spawn(agent: Agent): Session {
    const proc = pty.spawn(DEFAULT_SHELL, ['-l'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: agent.cwd,
      env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>
    })

    const tracker = new StatusTracker(() => Date.now())

    proc.onData((data) => {
      const next = tracker.push(data)
      this.emitData(agent.id, data)
      this.emitStatus(agent.id, next)
    })

    proc.onExit(({ exitCode }) => {
      const status = tracker.markExit(exitCode)
      this.emitStatus(agent.id, status)
      const s = this.sessions.get(agent.id)
      if (s) clearInterval(s.timer)
    })

    // Type the command so aliases/functions/PATH resolve like a real terminal.
    if (agent.command.trim()) {
      proc.write(agent.command + '\r')
    }

    // Poll to decay busy->idle and detect waiting after silence.
    const timer = setInterval(() => {
      const before = tracker.current
      const after = tracker.evaluate()
      if (after !== before) this.emitStatus(agent.id, after)
    }, POLL_MS)

    const session: Session = { agent, proc, tracker, timer }
    this.sessions.set(agent.id, session)
    return session
  }

  create(input: CreateAgentInput): Agent {
    const agent: Agent = {
      id: randomUUID(),
      name: input.name.trim() || 'agent',
      cwd: input.cwd,
      command: input.command.trim() || 'claude'
    }
    this.spawn(agent)
    return agent
  }

  /** Restore an agent that was persisted from a previous session. */
  restore(agent: Agent): void {
    if (this.sessions.has(agent.id)) return
    this.spawn(agent)
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.proc.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    const s = this.sessions.get(id)
    if (!s || cols < 1 || rows < 1) return
    try {
      s.proc.resize(cols, rows)
    } catch {
      /* pty already exited */
    }
  }

  restart(id: string): void {
    const s = this.sessions.get(id)
    if (!s) return
    const { agent } = s
    this.kill(id)
    this.spawn(agent)
    this.emitStatus(agent.id, 'starting')
  }

  private kill(id: string): void {
    const s = this.sessions.get(id)
    if (!s) return
    clearInterval(s.timer)
    try {
      s.proc.kill()
    } catch {
      /* already dead */
    }
    this.sessions.delete(id)
  }

  remove(id: string): void {
    this.kill(id)
  }

  disposeAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id)
  }
}
