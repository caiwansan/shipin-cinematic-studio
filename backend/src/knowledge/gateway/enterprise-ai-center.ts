/**
 * Phase 3.9: Enterprise AI Center — 企业 AI 配置中心
 * 
 * 工作台级 + 企业级双层配置：
 *   企业级默认模型 → 适用于所有工作台
 *   工作台覆盖配置 → 求职/新媒体/法律/广告等可以指定不同模型
 * 
 * 权限模型：
 *   基础会员（29元）：官方共享模型，限制请求数
 *   高级会员（119元）：支持 BYOK
 *   企业版：必须 BYOK，完整 Agent 能力
 */

import type { LLMProviderType, LLMModel } from './llm-gateway'
import { LLMGateway, BudgetGuard, FallbackChain, DeepSeekAdapter, OpenAIAdapter, ClaudeAdapter } from './llm-gateway'

// ─── 企业 AI 配置 ───

export interface EnterpriseAIConfig {
  organizationId: string
  // 企业级默认模型
  defaultProvider: LLMProviderType
  defaultModel: string
  // 工作台级覆盖配置
  workbenchOverrides: WorkbenchOverride[]
  // API Keys（加密存储）
  apiKeys: ProviderAPIKey[]
  // 预算设置
  budget: BudgetConfig
  // 降级配置
  fallbackChain: LLMProviderType[]
  // 权限
  tier: 'free' | 'basic' | 'premium' | 'enterprise'
}

export interface WorkbenchOverride {
  workbenchId: string        // 'job' | 'media' | 'legal' | 'ad' | 'geo'
  workbenchName: string
  provider: LLMProviderType
  model: string
  reason: string             // 为什么选择这个模型
}

export interface ProviderAPIKey {
  provider: LLMProviderType
  encryptedKey: string
  baseUrl?: string
  model: string
  enabled: boolean
  priority: number           // 优先级（数字越小越优先）
  dailyRequestLimit: number
  monthlyBudgetLimit: number  // 元
}

export interface BudgetConfig {
  dailyLimit: number          // 每日预算限制（元）
  monthlyLimit: number        // 每月预算限制（元）
  autoDowngrade: boolean      // 超预算自动降级
  downgradeProvider: LLMProviderType
  alertThreshold: number      // 告警阈值（百分比，如 80）
}

// ─── 用量统计 ───

export interface UsageStats {
  organizationId: string
  period: 'day' | 'month'
  totalRequests: number
  totalTokens: number
  totalCost: number              // 元
  byProvider: Record<LLMProviderType, {
    requests: number
    tokens: number
    cost: number
    avgLatencyMs: number
  }>
  byWorkbench: Record<string, {
    requests: number
    tokens: number
    cost: number
  }>
  budgetUsagePercent: number
}

// ─── 工作台预设 ───

export const WORKBENCH_PRESETS: WorkbenchOverride[] = [
  {
    workbenchId: 'job',
    workbenchName: '求职工作台',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    reason: '成本低、中文能力强，适合职业分析',
  },
  {
    workbenchId: 'media',
    workbenchName: '新媒体工作台',
    provider: 'qwen',
    model: 'qwen-plus',
    reason: '中文营销内容生成能力强',
  },
  {
    workbenchId: 'legal',
    workbenchName: '法律工作台',
    provider: 'claude',
    model: 'claude-3-5-sonnet',
    reason: '长文本分析能力强，法律文书处理',
  },
  {
    workbenchId: 'ad',
    workbenchName: '广告工作台',
    provider: 'openai',
    model: 'gpt-4o',
    reason: '创意生成能力最好',
  },
  {
    workbenchId: 'geo',
    workbenchName: 'GEO 工作台',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    reason: '成本低，结构化内容生成',
  },
]

// ─── Enterprise AI Center 主类 ───

export class EnterpriseAICenter {
  private configs = new Map<string, EnterpriseAIConfig>()
  private gateways = new Map<string, LLMGateway>()
  private budgetGuards = new Map<string, BudgetGuard>()
  private usageStats = new Map<string, UsageStats>()

  /**
   * 注册企业 AI 配置
   */
  registerConfig(config: EnterpriseAIConfig): void {
    this.configs.set(config.organizationId, config)

    // 为该企业创建 LLM Gateway
    const gateway = this.createGateway(config)
    this.gateways.set(config.organizationId, gateway)

    // 创建 Budget Guard
    const budgetGuard = new BudgetGuard({
      dailyBudgetLimit: config.budget.dailyLimit,
      monthlyBudgetLimit: config.budget.monthlyLimit,
      autoDowngrade: config.budget.autoDowngrade,
      downgradeProvider: config.budget.downgradeProvider,
    })
    this.budgetGuards.set(config.organizationId, budgetGuard)
  }

  /**
   * 获取企业的 LLM Gateway
   */
  getGateway(organizationId: string): LLMGateway | null {
    return this.gateways.get(organizationId) || null
  }

  /**
   * 获取企业的 Budget Guard
   */
  getBudgetGuard(organizationId: string): BudgetGuard | null {
    return this.budgetGuards.get(organizationId) || null
  }

  /**
   * 获取企业配置
   */
  getConfig(organizationId: string): EnterpriseAIConfig | null {
    return this.configs.get(organizationId) || null
  }

  /**
   * 更新工作台覆盖配置
   */
  updateWorkbenchOverride(
    organizationId: string,
    workbenchId: string,
    override: Partial<WorkbenchOverride>,
  ): boolean {
    const config = this.configs.get(organizationId)
    if (!config) return false

    const idx = config.workbenchOverrides.findIndex(w => w.workbenchId === workbenchId)
    if (idx >= 0) {
      config.workbenchOverrides[idx] = { ...config.workbenchOverrides[idx], ...override }
    } else {
      config.workbenchOverrides.push(override as WorkbenchOverride)
    }
    return true
  }

  /**
   * 获取工作台最终使用的模型（考虑覆盖）
   */
  getWorkbenchModel(organizationId: string, workbenchId: string): { provider: LLMProviderType; model: string } | null {
    const config = this.configs.get(organizationId)
    if (!config) return null

    // 查找工作台覆盖
    const override = config.workbenchOverrides.find(w => w.workbenchId === workbenchId)
    if (override && override.provider && override.model) {
      return { provider: override.provider, model: override.model }
    }

    // 返回企业级默认
    return { provider: config.defaultProvider, model: config.defaultModel }
  }

  /**
   * 获取用量统计
   */
  getUsageStats(organizationId: string): UsageStats | null {
    return this.usageStats.get(organizationId) || null
  }

  /**
   * 获取所有用量
   */
  getAllUsageStats(): Map<string, UsageStats> {
    return this.usageStats
  }

  /**
   * 检查权限（会员等级）
   */
  checkPermission(organizationId: string, action: 'byok' | 'custom_model' | 'unlimited_requests'): boolean {
    const config = this.configs.get(organizationId)
    if (!config) return false

    switch (action) {
      case 'byok':
        return config.tier === 'premium' || config.tier === 'enterprise'
      case 'custom_model':
        return config.tier === 'enterprise'
      case 'unlimited_requests':
        return config.tier === 'enterprise'
      default:
        return false
    }
  }

  /**
   * 获取预设配置
   */
  static getPreset(tier: 'basic' | 'premium' | 'enterprise'): Partial<EnterpriseAIConfig> {
    switch (tier) {
      case 'basic':
        return {
          tier: 'basic',
          defaultProvider: 'deepseek',
          defaultModel: 'deepseek-v4-flash',
          budget: {
            dailyLimit: 10,
            monthlyLimit: 200,
            autoDowngrade: false,
            downgradeProvider: 'deepseek',
            alertThreshold: 80,
          },
          fallbackChain: ['deepseek'],
          workbenchOverrides: [],
        }

      case 'premium':
        return {
          tier: 'premium',
          defaultProvider: 'deepseek',
          defaultModel: 'deepseek-v4-flash',
          budget: {
            dailyLimit: 50,
            monthlyLimit: 1000,
            autoDowngrade: true,
            downgradeProvider: 'deepseek',
            alertThreshold: 80,
          },
          fallbackChain: ['deepseek', 'openai', 'claude'],
          workbenchOverrides: WORKBENCH_PRESETS.slice(0, 3),
        }

      case 'enterprise':
        return {
          tier: 'enterprise',
          defaultProvider: 'deepseek',
          defaultModel: 'deepseek-v4-flash',
          budget: {
            dailyLimit: 500,
            monthlyLimit: 10000,
            autoDowngrade: true,
            downgradeProvider: 'deepseek',
            alertThreshold: 80,
          },
          fallbackChain: ['deepseek', 'openai', 'claude', 'qwen', 'gemini'],
          workbenchOverrides: WORKBENCH_PRESETS,
        }
    }
  }

  // ─── 私有方法 ───

  private createGateway(config: EnterpriseAIConfig): LLMGateway {
    const models: LLMModel[] = config.apiKeys
      .filter(k => k.enabled)
      .map(k => ({
        id: `${k.provider}:${k.model}`,
        provider: k.provider,
        model: k.model,
        label: `${k.provider}/${k.model}`,
        maxTokens: 4096,
        costPerInputToken: this.getCostPerToken(k.provider, 'input'),
        costPerOutputToken: this.getCostPerToken(k.provider, 'output'),
        supportedTasks: ['default', 'career_analysis', 'job_matching', 'resume_analysis'],
        enabled: k.enabled,
      }))

    const gateway = new LLMGateway({
      models,
      defaultProvider: config.defaultProvider,
      budgetGuard: this.budgetGuards.get(config.organizationId),
    })

    // 注册 Adapters
    for (const apiKey of config.apiKeys) {
      if (!apiKey.enabled) continue

      switch (apiKey.provider) {
        case 'deepseek':
          gateway.registerAdapter('deepseek', new DeepSeekAdapter(apiKey.encryptedKey, apiKey.baseUrl))
          break
        case 'openai':
          gateway.registerAdapter('openai', new OpenAIAdapter(apiKey.encryptedKey, apiKey.baseUrl))
          break
        case 'claude':
          gateway.registerAdapter('claude', new ClaudeAdapter(apiKey.encryptedKey, apiKey.baseUrl))
          break
      }
    }

    return gateway
  }

  private getCostPerToken(provider: LLMProviderType, type: 'input' | 'output'): number {
    const costs: Record<LLMProviderType, { input: number; output: number }> = {
      deepseek: { input: 0.000001, output: 0.000002 },
      openai: { input: 0.00003, output: 0.00006 },
      claude: { input: 0.000025, output: 0.000075 },
      qwen: { input: 0.000002, output: 0.000004 },
      gemini: { input: 0.000015, output: 0.00003 },
      zhipu: { input: 0.000001, output: 0.000002 },
      ollama: { input: 0, output: 0 },
      azure: { input: 0.00003, output: 0.00006 },
      volcengine: { input: 0.000002, output: 0.000004 },
    }
    return costs[provider]?.[type] || 0.000001
  }
}
