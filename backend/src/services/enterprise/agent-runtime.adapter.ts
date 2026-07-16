/**
 * Agent Runtime Adapter Interface
 * Sprint 4.2.9 Phase 1 — AI员工中心产品化
 *
 * 核心原则：共享 OpenClaw Runtime，多 Agent Identity 隔离
 * 每个 Agent 通过 namespace 隔离 Memory/Tools/Context
 */

export interface CreateAgentParams {
  agentId: string
  tenantId: string
  namespace: string
  role: string
  modelConfig?: {
    provider: string
    model: string
    temperature?: number
    maxTokens?: number
  }
}

export interface ExecuteTaskParams {
  agentId: string
  namespace: string
  taskType: string
  input: string
  modelConfig?: {
    provider: string
    model: string
    apiKey: string
    baseUrl?: string
    temperature?: number
    maxTokens?: number
  }
}

export interface TaskResult {
  success: boolean
  output: string
  tokenInput: number
  tokenOutput: number
  cost: number
  durationMs: number
  error?: string
}

export interface RuntimeStatus {
  agentId: string
  namespace: string
  status: 'active' | 'paused' | 'stopped'
  lastActiveAt?: Date
  totalTasks: number
  totalErrors: number
}

/**
 * Agent Runtime 适配器接口
 * 未来实现：OpenClawAdapter → OpenClaw Runtime
 * 当前为接口定义 + Mock 实现
 */
export interface AgentRuntimeAdapter {
  createAgent(params: CreateAgentParams): Promise<{ success: boolean; agentId: string }>
  startAgent(agentId: string): Promise<void>
  stopAgent(agentId: string): Promise<void>
  executeTask(params: ExecuteTaskParams): Promise<TaskResult>
  getStatus(agentId: string): Promise<RuntimeStatus>
}

/**
 * Mock Adapter（当前阶段使用）
 * 保留扩展点，未来替换为 OpenClawAdapter
 */
export class MockAgentRuntimeAdapter implements AgentRuntimeAdapter {
  private agents = new Map<string, { status: string; namespace: string }>()

  async createAgent(params: CreateAgentParams): Promise<{ success: boolean; agentId: string }> {
    this.agents.set(params.agentId, { status: 'active', namespace: params.namespace })
    return { success: true, agentId: params.agentId }
  }

  async startAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (agent) agent.status = 'active'
  }

  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (agent) agent.status = 'stopped'
  }

  async executeTask(params: ExecuteTaskParams): Promise<TaskResult> {
    const start = Date.now()
    // Mock 执行：实际未来调用 LLM
    const mockOutput = `[${params.taskType}] 已处理: ${params.input.slice(0, 50)}...`
    return {
      success: true,
      output: mockOutput,
      tokenInput: Math.floor(params.input.length / 4),
      tokenOutput: Math.floor(mockOutput.length / 4),
      cost: 0.001,
      durationMs: Date.now() - start,
    }
  }

  async getStatus(agentId: string): Promise<RuntimeStatus> {
    const agent = this.agents.get(agentId)
    return {
      agentId,
      namespace: agent?.namespace || '',
      status: (agent?.status as any) || 'stopped',
      totalTasks: 0,
      totalErrors: 0,
    }
  }
}

// 全局单例
export const agentRuntimeAdapter = new MockAgentRuntimeAdapter()
