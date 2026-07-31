/**
 * Enterprise AI Workforce — Enterprise Model Pool Service
 * 企业模型资源池：管理企业的 LLM provider 配置（BYOK）
 */
import { prisma } from '../../utils/index.js'
import { encryptKey, decryptKey } from '../crypto.service.js'

export interface CreateLlmConfigInput {
  tenantId: string
  provider: string
  modelName: string
  apiKey: string
  baseUrl?: string
  credentialOwner?: 'enterprise' | 'kunlun' | 'user'
  maxTokensPerDay?: number
  maxRequestsPerMinute?: number
  capabilities?: string[]
  enabled?: boolean
}

export interface UpdateLlmConfigInput {
  provider?: string
  modelName?: string
  apiKey?: string
  baseUrl?: string
  maxTokensPerDay?: number
  maxRequestsPerMinute?: number
  capabilities?: string[]
  enabled?: boolean
  status?: string
}

export class EnterpriseLlmService {
  /**
   * 创建企业模型配置（自动加密 API Key）
   */
  async create(input: CreateLlmConfigInput) {
    const encrypted = encryptKey(input.apiKey)
    return await prisma.enterpriseLlmConfig.create({
      data: {
        tenantId: input.tenantId,
        provider: input.provider,
        modelName: input.modelName,
        encryptedApiKey: encrypted,
        baseUrl: input.baseUrl || null,
        credentialOwner: input.credentialOwner || 'enterprise',
        maxTokensPerDay: input.maxTokensPerDay || 0,
        maxRequestsPerMinute: input.maxRequestsPerMinute || 60,
        capabilities: JSON.stringify(input.capabilities || []),
        enabled: input.enabled ?? true,
        status: 'active',
      },
    })
  }

  /**
   * 获取企业的所有模型配置（不含密钥）
   */
  async listByTenant(tenantId: string) {
    const configs = await prisma.enterpriseLlmConfig.findMany({
      where: { tenantId, status: 'active' },
      orderBy: { createdAt: 'asc' },
    })
    return configs.map((c) => ({
      ...c,
      encryptedApiKey: undefined,
      hasKey: !!c.encryptedApiKey,
    }))
  }

  /**
   * 获取单个模型配置（不含密钥）
   */
  async getById(id: string) {
    const c = await prisma.enterpriseLlmConfig.findUnique({ where: { id } })
    if (!c) return null
    return { ...c, encryptedApiKey: undefined, hasKey: !!c.encryptedApiKey }
  }

  /**
   * 获取解密的 API Key（仅用于 LLM 调用）
   */
  async getDecryptedKey(id: string): Promise<string | null> {
    const c = await prisma.enterpriseLlmConfig.findUnique({ where: { id } })
    if (!c || !c.enabled || c.status !== 'active') return null
    try {
      return decryptKey(c.encryptedApiKey)
    } catch {
      return null
    }
  }

  /**
   * 获取完整配置（含解密密钥，仅供内部调用）
   */
  async getFullConfig(id: string) {
    const c = await prisma.enterpriseLlmConfig.findUnique({ where: { id } })
    if (!c) return null
    const apiKey = await this.getDecryptedKey(id)
    return { ...c, apiKey }
  }

  /**
   * 更新模型配置
   */
  async update(id: string, input: UpdateLlmConfigInput) {
    const data: any = {}
    if (input.provider !== undefined) data.provider = input.provider
    if (input.modelName !== undefined) data.modelName = input.modelName
    if (input.apiKey !== undefined) {
      data.encryptedApiKey = encryptKey(input.apiKey)
      // Sprint-05 T01: 重新配置 key 后重置健康状态 → untested（待重新检测验证）
      data.healthStatus = 'untested'
      data.healthError = null
      data.healthLatencyMs = null
      data.lastHealthCheckAt = null
    }
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl
    if (input.maxTokensPerDay !== undefined) data.maxTokensPerDay = input.maxTokensPerDay
    if (input.maxRequestsPerMinute !== undefined) data.maxRequestsPerMinute = input.maxRequestsPerMinute
    if (input.capabilities !== undefined) data.capabilities = JSON.stringify(input.capabilities)
    if (input.enabled !== undefined) data.enabled = input.enabled
    if (input.status !== undefined) data.status = input.status
    return await prisma.enterpriseLlmConfig.update({ where: { id }, data })
  }

  /**
   * 删除（软删除：标记 deprecated）
   */
  async deactivate(id: string) {
    return await prisma.enterpriseLlmConfig.update({
      where: { id },
      data: { status: 'deprecated', enabled: false },
    })
  }

  /**
   * 测试模型连通性
   */
  async testConnection(id: string): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
    const start = Date.now()
    const config = await this.getFullConfig(id)
    if (!config || !config.apiKey) return { success: false, error: '配置不存在或密钥无效' }

    const { getBaseUrl } = await import('../hdz/llm.client.js')
    const url = getBaseUrl(config.provider, config.baseUrl)
    const fetchUrl = `${url}/chat/completions`

    try {
      const resp = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.modelName,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      })
      const latencyMs = Date.now() - start
      if (resp.ok) return { success: true, latencyMs }
      const errText = await resp.text().catch(() => '')
      return { success: false, error: `${resp.status} ${errText.slice(0, 100)}`, latencyMs }
    } catch (e: any) {
      return { success: false, error: e.message, latencyMs: Date.now() - start }
    }
  }
}

export const enterpriseLlmService = new EnterpriseLlmService()
