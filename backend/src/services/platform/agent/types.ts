// ============================================================
// Agent Types — KMKI-PLAT-010
// 平台可调度 Agent 内核：Agent = Capability 的智能编排执行者
// ============================================================

import type { PlatformContext } from '@platform/context/platform-context'

// ─── Agent Definition ───

export interface AgentDefinition {
  id: string
  code: string
  name: string
  version: string
  description?: string
  capabilities: string[]           // capability names this agent can handle
  supportedResources?: string[]    // resource types this agent can use
  inputSchema?: Record<string, unknown>   // JSON Schema
  outputSchema?: Record<string, unknown>  // JSON Schema
  executionMode: 'sync' | 'async' | 'streaming'
  permissions?: string[]           // required permission codes
  category?: 'official' | 'enterprise' | 'private'
  status: 'active' | 'deprecated' | 'disabled'
  metadata?: Record<string, unknown>
  schemaVersion: number
  createdAt: Date
  updatedAt: Date
}

export type CreateAgentDefinitionInput = Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion' | 'status'> & {
  status?: 'active' | 'deprecated' | 'disabled'
}

export type UpdateAgentDefinitionInput = Partial<Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'>>

// ─── Agent Session ───

export interface AgentSession {
  id: string
  workspaceId: string
  agentId: string
  sessionType: 'manual' | 'scheduled' | 'workflow' | 'dispatch'
  status: 'pending' | 'planning' | 'executing' | 'streaming' | 'paused' | 'completed' | 'failed' | 'cancelled'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  runtimeState?: Record<string, unknown>
  error?: string
  startedAt?: Date
  finishedAt?: Date
  executedBy?: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

// ─── Agent Step Execution ───

export interface AgentStepExecution {
  id: string
  sessionId: string
  stepName: string
  planId: string
  executionId: string
  capability: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  cost?: number
  tokenCount?: number
  latencyMs?: number
  error?: string
  startedAt?: Date
  completedAt?: Date
  metadata?: Record<string, unknown>
  createdAt: Date
}

// ─── Agent Memory ───

export interface AgentMemory {
  id: string
  sessionId: string
  type: 'shortTerm' | 'workspace' | 'knowledge' | 'summary'
  content: Record<string, unknown>
  relevanceScore?: number   // 0-1
  ttl?: number              // time-to-live in seconds
  metadata?: Record<string, unknown>
  createdAt: Date
  expiresAt?: Date
}

// ─── Agent Context ───

export interface AgentContext {
  sessionId: string
  workspace: {
    id: string
    type: string
    name: string
    settings?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }
  executionContext?: {
    planId?: string
    stepName?: string
    executionMode?: string
  }
  capabilityResolver: {
    resolve: (capabilityName: string, input: any) => Promise<any>
    list: (filter?: Record<string, unknown>) => Promise<any[]>
  }
  resourceResolver: {
    resolve: (resourceType: string, config?: Record<string, unknown>) => Promise<any>
  }
  conversation?: {
    messages: Array<{ role: string; content: string; timestamp: Date }>
    addMessage: (role: string, content: string) => Promise<void>
  }
  memory: {
    store: (type: string, content: any, relevanceScore?: number, ttl?: number) => Promise<void>
    retrieve: (type: string) => Promise<AgentMemory[]>
    summarize: () => Promise<string>
  }
  variables: Record<string, any>
  settings: Record<string, any>
  agentDefinition: AgentDefinition
  platformContext: PlatformContext
  logger: {
    info: (msg: string, data?: any) => void
    warn: (msg: string, data?: any) => void
    error: (msg: string, data?: any) => void
    debug: (msg: string, data?: any) => void
  }
}

// ─── Agent Contract (interface for Agent implementations) ───

export interface AgentContract {
  initialize(ctx: AgentContext): Promise<void>
  plan(ctx: AgentContext, input: any): Promise<AgentPlan>
  execute(ctx: AgentContext, plan: AgentPlan): Promise<AgentResult>
  stream?(ctx: AgentContext, plan: AgentPlan): AsyncGenerator<AgentStreamChunk, AgentResult, void>
  pause(ctx: AgentContext): Promise<void>
  resume(ctx: AgentContext): Promise<void>
  cancel(ctx: AgentContext): Promise<void>
  complete(ctx: AgentContext, result: AgentResult): Promise<void>
  dispose(ctx: AgentContext): Promise<void>
}

export interface AgentPlan {
  steps: Array<{
    name: string
    capability: string
    input: any
    dependsOn?: string[]
    timeout?: number
    retry?: { maxAttempts: number; backoffMs: number }
  }>
  metadata?: Record<string, unknown>
}

export interface AgentResult {
  success: boolean
  output: Record<string, unknown> | null
  error?: string
  metrics?: {
    totalSteps: number
    completedSteps: number
    failedSteps: number
    totalDurationMs: number
    totalCost: number
    totalTokens: number
  }
}

export interface AgentStreamChunk {
  type: 'planning' | 'executing' | 'toolCalled' | 'intermediate' | 'error' | 'complete'
  stepName?: string
  data?: any
  timestamp: Date
}

// ─── Tool Adapter ───

export interface ToolAdapter {
  invoke(type: ToolType, name: string, params: Record<string, unknown>, ctx?: AgentContext): Promise<ToolResult>
  install(type: ToolType, config: ToolConfig): Promise<void>
  uninstall(type: ToolType): Promise<void>
  listAvailable(): ToolType[]
  getStatus(type: ToolType): ToolStatus
}

export type ToolType =
  | 'mcp'         // Model Context Protocol
  | 'browser'     // Headless browser
  | 'search'      // Web search
  | 'python'      // Python execution
  | 'database'    // Database query
  | 'http'        // HTTP request
  | 'filesystem'  // File system operations
  | 'custom'      // Custom plugin tool

export interface ToolConfig {
  enabled: boolean
  options?: Record<string, unknown>
  auth?: {
    type: 'apiKey' | 'bearer' | 'basic' | 'none'
    credentials?: Record<string, string>
  }
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  durationMs?: number
  metadata?: Record<string, unknown>
}

export type ToolStatus = 'available' | 'unavailable' | 'error' | 'not_installed'

// ─── Schedule Plan ───

export interface AgentSchedulePlan {
  id?: string
  workspaceId: string
  steps: AgentScheduleStep[]
  priority: number
  maxRetries?: number
  timeout?: number       // total plan timeout in ms
  metadata?: Record<string, unknown>
}

export interface AgentScheduleStep {
  agentCode: string
  input: any
  mode: 'sequential' | 'parallel'
  dependsOn?: string[]
  timeout?: number
  retry?: { maxAttempts: number; backoffMs: number }
}

// ─── Dispatch Types ───

export interface DispatchInput {
  agentCode: string
  input: any
  context?: Partial<AgentContext>
  metadata?: Record<string, unknown>
}

export interface DispatchMultipleInput {
  agents: Array<{
    code: string
    input: any
    dependsOn?: string[]
  }>
  mode?: 'sequential' | 'parallel' | 'hybrid'
  metadata?: Record<string, unknown>
}

export interface DispatchResult {
  sessionId: string
  agentCode: string
  status: string
  result?: AgentResult
  error?: string
  startedAt: Date
  completedAt?: Date
}
