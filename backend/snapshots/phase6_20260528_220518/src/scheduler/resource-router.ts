/**
 * Resource Router — 统一资源调度
 * 
 * 根据 task 类型、复杂度、成本预算、延迟要求选择最佳资源
 * 
 * 资源类型: LLM (doubao/deepseek/gpt-4o-mini), Render Engine, Queue, Memory
 * 路由策略: priority-based, cost-aware, latency-aware, fallback-aware
 */

export type ResourceType = 'llm' | 'render' | 'queue' | 'memory'
export type LLMProvider = 'doubao' | 'deepseek' | 'bailian'
export type TaskComplexity = 'simple' | 'medium' | 'complex' | 'very_complex'

export interface ResourceRequest {
  taskType: ResourceType
  complexity: TaskComplexity
  priority: number // 1-10
  costBudget: number
  latencyBudget: number // ms
  preferProvider?: LLMProvider
}

export interface ResourceAllocation {
  provider: LLMProvider | 'render_engine' | 'bullmq' | 'local_memory'
  estimatedCost: number
  estimatedLatency: number
  quality: 'draft' | 'standard' | 'premium'
}

/**
 * 资源路由器 — 选择最佳资源
 */
export class ResourceRouter {
  private providerCosts: Record<LLMProvider, { per1kTokens: number; quality: 'draft' | 'standard' | 'premium'; avgLatency: number }> = {
    'doubao': { per1kTokens: 0.002, quality: 'standard', avgLatency: 3000 },
    'deepseek': { per1kTokens: 0.001, quality: 'standard', avgLatency: 5000 },
    'bailian': { per1kTokens: 0.008, quality: 'standard', avgLatency: 4000 },
  }

  select(request: ResourceRequest): ResourceAllocation {
    // Render 任务 -> 渲染引擎
    if (request.taskType === 'render') {
      return {
        provider: 'render_engine',
        estimatedCost: 0.05,
        estimatedLatency: 30000,
        quality: 'standard',
      }
    }

    // Queue 任务 -> BullMQ
    if (request.taskType === 'queue') {
      return {
        provider: 'bullmq',
        estimatedCost: 0,
        estimatedLatency: 100,
        quality: 'standard',
      }
    }

    // Memory 任务 -> 本地
    if (request.taskType === 'memory') {
      return {
        provider: 'local_memory',
        estimatedCost: 0,
        estimatedLatency: 10,
        quality: 'standard',
      }
    }

    // LLM 任务 — 根据 complexity + cost + latency 选择
    if (request.taskType === 'llm') {
      // 简单任务 -> 最便宜的模型
      if (request.complexity === 'simple') {
        return {
          provider: 'deepseek',
          estimatedCost: this.providerCosts.deepseek.per1kTokens,
          estimatedLatency: this.providerCosts.deepseek.avgLatency,
          quality: 'draft',
        }
      }

      // 有成本限制 -> deepseek
      if (request.costBudget < 0.01) {
        return {
          provider: 'deepseek',
          estimatedCost: this.providerCosts.deepseek.per1kTokens,
          estimatedLatency: this.providerCosts.deepseek.avgLatency,
          quality: 'standard',
        }
      }

      // 低延迟要求 -> doubao (更快)
      if (request.latencyBudget < 4000) {
        return {
          provider: 'doubao',
          estimatedCost: this.providerCosts.doubao.per1kTokens,
          estimatedLatency: this.providerCosts.doubao.avgLatency,
          quality: 'standard',
        }
      }

      // 复杂且预算充足 -> deepseek
      if (request.complexity === 'very_complex' && request.costBudget > 0.02) {
        return {
          provider: 'deepseek',
          estimatedCost: this.providerCosts.deepseek.per1kTokens,
          estimatedLatency: this.providerCosts.deepseek.avgLatency,
          quality: 'standard',
        }
      }

      // 默认用 doubao
      return {
        provider: 'doubao',
        estimatedCost: this.providerCosts.doubao.per1kTokens,
        estimatedLatency: this.providerCosts.doubao.avgLatency,
        quality: 'standard',
      }
    }

    // Fallback
    return {
      provider: 'deepseek',
      estimatedCost: 0.001,
      estimatedLatency: 5000,
      quality: 'draft',
    }
  }

  /**
   * 获取指定 provider 的配置（用于 narrative-gateway providerOverride）
   */
  getProviderConfig(provider: LLMProvider): { name: string; type: string } {
    switch (provider) {
      case 'doubao': return { name: 'doubao', type: 'volcengine' }
      case 'deepseek': return { name: 'deepseek', type: 'deepseek' }
      case 'bailian': return { name: 'bailian', type: 'bailian' }
    }
  }
}

export const resourceRouter = new ResourceRouter()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

