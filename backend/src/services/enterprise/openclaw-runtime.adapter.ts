/**
 * openclaw-runtime.adapter.ts — OpenClaw Runtime 实现
 * Sprint 4.2.9 Phase 5
 *
 * 实现 AgentRuntimeAdapter 接口，对接 OpenClaw Runtime
 * 与 MockAgentRuntimeAdapter 完全兼容
 */
import type { CreateAgentParams, ExecuteTaskParams, TaskResult, RuntimeStatus } from './agent-runtime.adapter.js'
import type { AgentRuntimeAdapter } from './agent-runtime.adapter.js'

export class OpenClawRuntimeAdapter implements AgentRuntimeAdapter {
  name = 'openclaw'
  private runtimeUrl: string
  private apiKey: string

  constructor() {
    this.runtimeUrl = process.env.OPENCLAW_RUNTIME_URL || 'http://localhost:8080'
    this.apiKey = process.env.OPENCLAW_API_KEY || ''
  }

  /**
   * 创建 Agent → OpenClaw Namespace + Session
   */
  async createAgent(params: CreateAgentParams): Promise<{ success: boolean; agentId: string }> {
    try {
      const res = await fetch(`${this.runtimeUrl}/api/v1/agents`, {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify({
          agentId: params.agentId,
          tenantId: params.tenantId,
          namespace: params.namespace,
          role: params.role,
          model: params.modelConfig,
        }),
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`OpenClaw ${res.status}: ${body.slice(0, 200)}`)
      }
      return { success: true, agentId: params.agentId }
    } catch (err: any) {
      return { success: false, agentId: params.agentId }
    }
  }

  /**
   * 启动 Agent
   */
  async startAgent(agentId: string): Promise<void> {
    try {
      await fetch(`${this.runtimeUrl}/api/v1/agents/${agentId}/start`, {
        method: 'POST',
        headers: this.authHeaders(),
      })
    } catch {
      // ignore
    }
  }

  /**
   * 停止 Agent
   */
  async stopAgent(agentId: string): Promise<void> {
    try {
      await fetch(`${this.runtimeUrl}/api/v1/agents/${agentId}/stop`, {
        method: 'POST',
        headers: this.authHeaders(),
      })
    } catch {
      // ignore
    }
  }

  /**
   * 执行任务 → 投递到 OpenClaw
   */
  async executeTask(params: ExecuteTaskParams): Promise<TaskResult> {
    const start = Date.now()
    try {
      const res = await fetch(`${this.runtimeUrl}/api/v1/agents/${params.agentId}/tasks`, {
        method: 'POST',
        headers: this.jsonHeaders(),
        body: JSON.stringify({
          taskType: params.taskType,
          input: params.input,
          namespace: params.namespace,
          modelConfig: params.modelConfig,
        }),
      })
      if (!res.ok) {
        return { success: false, output: '', tokenInput: 0, tokenOutput: 0, cost: 0, durationMs: Date.now() - start, error: `HTTP ${res.status}` }
      }
      const data: any = await res.json()
      return {
        success: true,
        output: data.output || data.result || '',
        tokenInput: data.tokenInput || Math.floor(params.input.length / 4),
        tokenOutput: data.tokenOutput || 0,
        cost: data.cost || 0,
        durationMs: data.durationMs || Date.now() - start,
      }
    } catch (err: any) {
      return { success: false, output: '', tokenInput: 0, tokenOutput: 0, cost: 0, durationMs: Date.now() - start, error: err.message }
    }
  }

  /**
   * 查询 Agent 状态
   */
  async getStatus(agentId: string): Promise<RuntimeStatus> {
    try {
      const res = await fetch(`${this.runtimeUrl}/api/v1/agents/${agentId}/status`, {
        headers: this.authHeaders(),
      })
      if (!res.ok) {
        return { agentId, namespace: '', status: 'stopped', totalTasks: 0, totalErrors: 0 }
      }
      const data: any = await res.json()
      return {
        agentId,
        namespace: data.namespace || '',
        status: data.status || 'stopped',
        lastActiveAt: data.lastActiveAt ? new Date(data.lastActiveAt) : undefined,
        totalTasks: data.totalTasks || 0,
        totalErrors: data.totalErrors || 0,
      }
    } catch {
      return { agentId, namespace: '', status: 'stopped', totalTasks: 0, totalErrors: 0 }
    }
  }

  private jsonHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...this.authHeaders() }
  }

  private authHeaders(): Record<string, string> {
    return this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}
  }
}

/**
 * Runtime Adapter Factory
 * RUNTIME_DRIVER=mock|openclaw
 */
export function createRuntimeAdapter(): AgentRuntimeAdapter {
  const driver = process.env.RUNTIME_DRIVER || 'mock'
  if (driver === 'openclaw') {
    return new OpenClawRuntimeAdapter()
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MockAgentRuntimeAdapter } = require('./agent-runtime.adapter.js') as typeof import('./agent-runtime.adapter.js')
  return new MockAgentRuntimeAdapter()
}
