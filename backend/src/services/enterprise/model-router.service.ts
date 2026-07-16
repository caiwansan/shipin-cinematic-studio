/**
 * Enterprise AI Workforce — Model Intelligence Router
 * 模型路由核心：所有 Agent LLM 调用均经过此路由器
 *
 * 调用链：Agent Task → Model Router → Enterprise Model Pool → LLM Provider
 */
import { prisma } from '../../utils/index.js'
import { getBaseUrl, type LLMConfig } from '../hdz/llm.client.js'
import { enterpriseLlmService } from './enterprise-llm.service.js'

export interface RouteInput {
  tenantId: string
  agentType: string   // growth_director / content_manager / writer / reviewer / ...
  taskType: string    // strategy / content / research / customer / sales / creative
  organizationId?: string
  userId?: string     // 用于 fallback 到用户个人 BYOK
}

export interface RouteResult {
  configId: string
  provider: string
  modelName: string
  apiKey: string
  baseUrl?: string
  maxTokens: number
  temperature: number
  source: 'agent_binding' | 'routing_policy' | 'default_fallback' | 'user_byok'
  credentialOwner: string
}

export class ModelRouterService {
  /**
   * 核心路由方法：根据任务上下文选择最合适的模型
   */
  async resolve(input: RouteInput): Promise<RouteResult | null> {
    // 1. 优先查询 Agent 绑定（需要 agentId）
    // 2. 查询路由策略
    // 3. Fallback 到企业默认模型池
    // 4. Fallback 到用户个人 BYOK

    const { tenantId, agentType, taskType } = input

    // --- Step 1: 查询 model_routing_policy ---
    const policies = await prisma.modelRoutingPolicy.findMany({
      where: {
        tenantId,
        OR: [
          { agentType, taskType, enabled: true },
          { agentType: null, taskType, enabled: true },
        ],
      },
      orderBy: { priority: 'desc' },
    })

    for (const policy of policies) {
      if (policy.llmConfigId) {
        const result = await this.tryConfig(policy.llmConfigId)
        if (result) return { ...result, source: 'routing_policy' }
        if (policy.fallbackChain) {
          try {
            const chain: string[] = JSON.parse(policy.fallbackChain)
            for (const fallbackId of chain) {
              const fb = await this.tryConfig(fallbackId)
              if (fb) return { ...fb, source: 'routing_policy' }
            }
          } catch { /* ignore */ }
        }
      }
    }

    // --- Step 2: 查找企业默认模型（第一个启用的） ---
    const defaultConfigs = await prisma.enterpriseLlmConfig.findMany({
      where: { tenantId, enabled: true, status: 'active' },
      orderBy: { createdAt: 'asc' },
      take: 3,
    })

    for (const cfg of defaultConfigs) {
      const result = await this.tryConfig(cfg.id)
      if (result) return { ...result, source: 'default_fallback' }
    }

    // --- Step 3: Fallback 到用户个人 BYOK ---
    if (input.userId) {
      const userCfg = await this.resolveUserLLM(input.userId)
      if (userCfg) return { ...userCfg, source: 'user_byok' }
    }

    return null
  }

  /**
   * 根据 Agent 绑定获取模型（当已知具体 agentId 时）
   */
  resolveByAgentBinding(agentId: string, taskType: string): Promise<RouteResult | null> {
    // TODO: 需要在 service 层调用时传入 agentId
    // 暂时通过 routing policy 路由
    return this.resolve({ tenantId: '', agentType: '', taskType })
  }

  /**
   * 读取用户个人 BYOK（迁移兼容）
   */
  private async resolveUserLLM(userId: string): Promise<RouteResult | null> {
    const { getUserLLMConfig } = await import('../hdz/llm.client.js')
    const cfg = await getUserLLMConfig(userId)
    if (!cfg) return null
    return {
      configId: 'user_byok',
      provider: cfg.provider,
      modelName: cfg.modelName,
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      maxTokens: cfg.maxTokens || 16384,
      temperature: 0.7,
      source: 'user_byok',
      credentialOwner: 'user',
    }
  }

  /**
   * 尝试加载一个企业模型配置（验证有效性并解密）
   */
  private async tryConfig(configId: string): Promise<RouteResult | null> {
    const full = await enterpriseLlmService.getFullConfig(configId)
    if (!full || !full.apiKey || !full.enabled || full.status !== 'active') return null

    return {
      configId: full.id,
      provider: full.provider,
      modelName: full.modelName,
      apiKey: full.apiKey,
      baseUrl: full.baseUrl || undefined,
      maxTokens: 16384,
      temperature: 0.7,
      source: 'routing_policy',
      credentialOwner: full.credentialOwner as string,
    }
  }

  /**
   * 将 RouteResult 转为 LLMConfig（供 callLLM 使用）
   */
  toLLMConfig(result: RouteResult): LLMConfig {
    return {
      provider: result.provider,
      modelName: result.modelName,
      apiKey: result.apiKey,
      baseUrl: result.baseUrl,
      maxTokens: result.maxTokens,
    }
  }

  /**
   * 获取 Base URL（代理 getBaseUrl）
   */
  getBaseUrl(provider: string, customUrl?: string): string {
    return getBaseUrl(provider, customUrl || undefined)
  }
}

export const modelRouter = new ModelRouterService()
