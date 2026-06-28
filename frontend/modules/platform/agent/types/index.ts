// ============================================================
// Frontend Agent Types — KMKI-PLAT-010
// ============================================================

export interface AgentDefinition {
  id: string
  code: string
  name: string
  version: string
  description?: string
  capabilities: string[]
  supportedResources?: string[]
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  executionMode: 'sync' | 'async' | 'streaming'
  permissions?: string[]
  category?: 'official' | 'enterprise' | 'private'
  status: 'active' | 'deprecated' | 'disabled'
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface AgentSession {
  id: string
  workspaceId: string
  agentId: string
  agentCode?: string
  agentName?: string
  sessionType: string
  status: string
  input?: any
  output?: any
  error?: string
  startedAt?: string
  finishedAt?: string
  executedBy?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface AgentExecution {
  id: string
  sessionId: string
  stepName: string
  planId: string
  capability: string
  status: string
  input?: any
  output?: any
  cost?: number
  tokenCount?: number
  latencyMs?: number
  error?: string
  startedAt?: string
  completedAt?: string
}

export interface AgentMemoryItem {
  id: string
  sessionId: string
  type: string
  content: any
  relevanceScore?: number
  createdAt: string
  expiresAt?: string
}

export interface DispatchResult {
  sessionId: string
  agentCode: string
  status: string
  result?: any
  error?: string
  startedAt: string
  completedAt?: string
}

export interface AgentHealth {
  status: string
  registeredAgents: number
  activeSessions: number
  availableTools: string[]
}

export interface AgentSchedulePlan {
  id?: string
  workspaceId: string
  steps: AgentScheduleStep[]
  priority: number
  maxRetries?: number
  timeout?: number
}

export interface AgentScheduleStep {
  agentCode: string
  input: any
  mode: 'sequential' | 'parallel'
  dependsOn?: string[]
  timeout?: number
  retry?: { maxAttempts: number; backoffMs: number }
}
