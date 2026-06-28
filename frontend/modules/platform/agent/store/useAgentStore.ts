// ============================================================
// Frontend Agent Store — KMKI-PLAT-010
// ============================================================

import { defineStore } from 'pinia'
import type { AgentDefinition, AgentSession, AgentHealth, DispatchResult } from '../types/index'

interface AgentState {
  agents: AgentDefinition[]
  sessions: AgentSession[]
  currentAgent: AgentDefinition | null
  currentSession: AgentSession | null
  health: AgentHealth | null
  loading: boolean
  error: string | null
}

export const useAgentStore = defineStore('agent', {
  state: (): AgentState => ({
    agents: [],
    sessions: [],
    currentAgent: null,
    currentSession: null,
    health: null,
    loading: false,
    error: null,
  }),

  getters: {
    activeAgents: (state) => state.agents.filter(a => a.status === 'active'),
    activeSessions: (state) => state.sessions.filter(s =>
      ['pending', 'planning', 'executing', 'streaming'].includes(s.status)
    ),
    completedSessions: (state) => state.sessions.filter(s =>
      ['completed', 'failed', 'cancelled'].includes(s.status)
    ),
  },

  actions: {
    setLoading(val: boolean) {
      this.loading = val
    },

    setError(err: string | null) {
      this.error = err
    },

    async fetchAgents() {
      this.setLoading(true)
      try {
        const response = await fetch('/api/platform/agents')
        const json = await response.json()
        if (json.success) {
          this.agents = json.data
        }
      } catch (err: any) {
        this.setError(err.message)
      } finally {
        this.setLoading(false)
      }
    },

    async fetchAgent(code: string) {
      this.setLoading(true)
      try {
        const response = await fetch(`/api/platform/agents/${code}`)
        const json = await response.json()
        if (json.success) {
          this.currentAgent = json.data
        }
      } catch (err: any) {
        this.setError(err.message)
      } finally {
        this.setLoading(false)
      }
    },

    async registerAgent(definition: Partial<AgentDefinition>) {
      this.setLoading(true)
      try {
        const response = await fetch('/api/platform/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(definition),
        })
        const json = await response.json()
        if (json.success) {
          this.agents.push(json.data)
          return json.data
        }
        throw new Error(json.error || 'Failed to register agent')
      } catch (err: any) {
        this.setError(err.message)
        throw err
      } finally {
        this.setLoading(false)
      }
    },

    async unregisterAgent(code: string) {
      try {
        const response = await fetch(`/api/platform/agents/${code}`, { method: 'DELETE' })
        const json = await response.json()
        if (json.success) {
          this.agents = this.agents.filter(a => a.code !== code)
        }
      } catch (err: any) {
        this.setError(err.message)
      }
    },

    async executeAgent(code: string, input: any): Promise<DispatchResult | null> {
      this.setLoading(true)
      try {
        const response = await fetch(`/api/platform/agents/${code}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input }),
        })
        const json = await response.json()
        if (json.success) {
          return json.data
        }
        throw new Error(json.error || 'Execution failed')
      } catch (err: any) {
        this.setError(err.message)
        return null
      } finally {
        this.setLoading(false)
      }
    },

    async fetchSessions(filter?: { status?: string; agentCode?: string }) {
      this.setLoading(true)
      try {
        const params = new URLSearchParams()
        if (filter?.status) params.set('status', filter.status)
        if (filter?.agentCode) params.set('agentCode', filter.agentCode)
        const response = await fetch(`/api/platform/agent-sessions?${params}`)
        const json = await response.json()
        if (json.success) {
          this.sessions = json.data
        }
      } catch (err: any) {
        this.setError(err.message)
      } finally {
        this.setLoading(false)
      }
    },
  },
})
