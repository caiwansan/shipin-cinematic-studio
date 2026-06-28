/**
 * Multi-Agent Execution Pool
 * 
 * agent 不绑定单 graph，可跨 graph 复用
 * 支持并发执行，资源池化管理
 */

import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { resourceRouter } from './resource-router.js'
import type { LLMProvider, TaskComplexity } from './resource-router.js'
import type { GraphInstance } from './graph.instance.js'

// ============================================================
// Agent Types
// ============================================================

export type AgentType = 'story' | 'character' | 'scene' | 'storyboard' | 'render'

export interface AgentTask {
  agentType: AgentType
  input: string
  systemPrompt: string
  graphId: string
  traceId: string
  complexity: TaskComplexity
  userId?: string
}

export interface AgentResult {
  ok: boolean
  degraded: boolean
  content: string
  cost: number
  latency: number
  provider: string
}

const AGENT_SYSTEM_PROMPTS: Record<AgentType, string> = {
  story: '你是一位专业故事分析师。分析故事结构、情感曲线、角色弧光，返回 JSON 格式分析结果。',
  character: '你是一位专业角色设计师。根据故事文本设计角色外貌、性格、背景，返回 JSON 格式角色规范。',
  scene: '你是一位专业场景设计师。根据故事文本设计场景氛围、时间、地点、天气，返回 JSON 格式场景规范。',
  storyboard: '你是一位专业分镜师。根据故事和场景信息生成分镜方案，返回 JSON 格式分镜表。',
  render: '你负责将 AIGC 规格转换为渲染任务参数。返回 JSON 格式渲染配置。',
}

const AGENT_COMPLEXITY: Record<AgentType, TaskComplexity> = {
  story: 'complex',
  character: 'medium',
  scene: 'simple',
  storyboard: 'medium',
  render: 'simple',
}

// ============================================================
// Agent Pool
// ============================================================

class AgentPool {
  private maxConcurrency = 5
  private running = 0
  private queue: Array<{ task: AgentTask; resolve: (result: AgentResult) => void }> = []

  async execute(task: AgentTask): Promise<AgentResult> {
    if (this.running >= this.maxConcurrency) {
      return new Promise(resolve => {
        this.queue.push({ task, resolve })
      })
    }

    return this._execute(task)
  }

  private async _execute(task: AgentTask): Promise<AgentResult> {
    this.running++
    const start = Date.now()

    try {
      // Resource Router 选择 provider
      const allocation = resourceRouter.select({
        taskType: 'llm',
        complexity: task.complexity || AGENT_COMPLEXITY[task.agentType],
        priority: 5,
        costBudget: 0.01,
        latencyBudget: 15000,
      })

      const systemPrompt = task.systemPrompt || AGENT_SYSTEM_PROMPTS[task.agentType]

      const result = await narrativeGateway.execute({
        systemPrompt,
        userMessage: task.input.slice(0, 6000),
        userId: task.userId || 'agent-pool',
        projectId: task.graphId,
        timeoutTier: task.complexity === 'simple' ? 'normal' : task.complexity === 'complex' ? 'batch' : 'batch',
        providerOverride: allocation.provider !== 'deepseek' ? [allocation.provider] : undefined,
      })

      return {
        ok: result.ok !== false,
        degraded: result.degraded || false,
        content: result.content,
        cost: allocation.estimatedCost,
        latency: Date.now() - start,
        provider: result.provider || allocation.provider,
      }
    } catch (err: any) {
      return {
        ok: false,
        degraded: true,
        content: '',
        cost: 0,
        latency: Date.now() - start,
        provider: 'degraded',
      }
    } finally {
      this.running--
      this._drainQueue()
    }
  }

  private _drainQueue() {
    while (this.running < this.maxConcurrency && this.queue.length > 0) {
      const next = this.queue.shift()!
      this._execute(next.task).then(next.resolve)
    }
  }

  get runningCount() { return this.running }
  get queuedCount() { return this.queue.length }
}

export const agentPool = new AgentPool()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

