import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { Agent, PersistedState } from '../shared/types'

const EMPTY: PersistedState = { agents: [], columnLayout: {} }

export class Store {
  private file = join(app.getPath('userData'), 'muticode.json')
  private state: PersistedState = EMPTY

  load(): PersistedState {
    try {
      const raw = readFileSync(this.file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<PersistedState>
      this.state = {
        agents: Array.isArray(parsed.agents) ? parsed.agents : [],
        columnLayout:
          parsed.columnLayout && typeof parsed.columnLayout === 'object'
            ? parsed.columnLayout
            : {}
      }
    } catch {
      this.state = { agents: [], columnLayout: {} }
    }
    return this.state
  }

  private persist(): void {
    try {
      writeFileSync(this.file, JSON.stringify(this.state, null, 2), 'utf8')
    } catch (err) {
      console.error('[store] failed to persist:', err)
    }
  }

  getAgents(): Agent[] {
    return this.state.agents
  }

  setAgents(agents: Agent[]): void {
    this.state.agents = agents
    this.persist()
  }

  addAgent(agent: Agent): void {
    this.state.agents.push(agent)
    this.persist()
  }

  removeAgent(id: string): void {
    this.state.agents = this.state.agents.filter((a) => a.id !== id)
    this.persist()
  }

  getColumnLayout(): Record<string, number> {
    return this.state.columnLayout
  }

  setColumnLayout(layout: Record<string, number>): void {
    this.state.columnLayout = layout
    this.persist()
  }
}
