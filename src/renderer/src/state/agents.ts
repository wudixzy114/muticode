import { create } from 'zustand'
import type { Agent, AgentStatus, CreateAgentInput } from '../../../shared/types'

interface AgentsState {
  agents: Agent[]
  statuses: Record<string, AgentStatus>
  loaded: boolean
  load: () => Promise<void>
  addAgent: (input: CreateAgentInput) => Promise<void>
  removeAgent: (id: string) => Promise<void>
  restartAgent: (id: string) => Promise<void>
  setStatus: (id: string, status: AgentStatus) => void
}

export const useAgents = create<AgentsState>((set, get) => ({
  agents: [],
  statuses: {},
  loaded: false,

  load: async () => {
    const agents = await window.muti.listAgents()
    const statuses: Record<string, AgentStatus> = {}
    for (const a of agents) statuses[a.id] = 'starting'
    set({ agents, statuses, loaded: true })
  },

  addAgent: async (input) => {
    const agent = await window.muti.createAgent(input)
    set((s) => ({
      agents: [...s.agents, agent],
      statuses: { ...s.statuses, [agent.id]: 'starting' }
    }))
  },

  removeAgent: async (id) => {
    await window.muti.removeAgent(id)
    set((s) => {
      const statuses = { ...s.statuses }
      delete statuses[id]
      return { agents: s.agents.filter((a) => a.id !== id), statuses }
    })
  },

  restartAgent: async (id) => {
    await window.muti.restartAgent(id)
    set((s) => ({ statuses: { ...s.statuses, [id]: 'starting' } }))
  },

  setStatus: (id, status) => {
    if (!get().statuses.hasOwnProperty(id) && !get().agents.some((a) => a.id === id)) return
    set((s) => ({ statuses: { ...s.statuses, [id]: status } }))
  }
}))
