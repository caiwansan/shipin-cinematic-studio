/**
 * services/enterprise/model-resolver.service.ts
 *
 * ═══════════════════════════════════════════════════════════════════
 * SPRINT-IDENTITY-REALITY-FIX-01 — 企业 AI 员工模型解析（BYOK 唯一原则）
 *
 * 昆仑镜 = AI 员工操作系统：企业提供算力，平台不托管企业 Key。
 *
 * 企业 AI 员工模型解析链（身份隔离，不 fallback 个人/平台 Key）：
 *   1. Runtime Input Override（显式传参，最高优先）
 *   2. OrgModelConfig + ProviderCredential（企业资产，加密存储）← 唯一权威
 *   3. EnterpriseLlmConfig（deprecated 兼容读取，仅存量企业过渡）
 *
 * 无企业配置 → 显式错误 ENTERPRISE_MODEL_CONFIG_MISSING（提示「企业模型配置缺失」，
 * 不是「平台模型错误」）。G2 验收：删除企业 Key → AI 员工停止运行 + 明确提示。
 *
 * Model Policy 不保存 Key，只保存：
 *   { capability, preferredProvider, preferredModel, fallbackModel }
 * 实际 Key 从 ProviderCredential（企业资产）解析。
 * ═══════════════════════════════════════════════════════════════════
 */
import { prisma } from '../../utils/index.js'
import { decryptKey, encryptKey } from '../crypto.service.js'
import { getBaseUrl, callLLM } from '../hdz/llm.client.js'

export type ModelSource = 'input' | 'org_byok' | 'compat_enterprise'

export interface ResolvedEnterpriseModel {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
  source: ModelSource
  sourceLabel: string // 展示用：企业BYOK / 兼容旧配置 / 输入覆盖
  configId?: string   // OrgModelConfig.id 或 EnterpriseLlmConfig.id
  credentialId?: string
  healthStatus?: string
}

export interface OrgModelSettings {
  provider: string
  model: string
  fallbackModel?: string
  apiKey?: string // 仅写入时使用（加密存储），读取不返回明文
  capability?: string
  isDefault?: boolean
}

export class ModelResolverService {
  /**
   * 企业 AI 员工专用解析：只走企业模型设置（BYOK），不 fallback 个人/平台 Key。
   * @returns null = 企业未配置模型（调用方应提示「企业模型配置缺失」）
   */
  async resolveEnterpriseModel(params: {
    organizationId: string
    tenantId?: string
    inputOverride?: { provider?: string; model?: string; apiKey?: string }
  }): Promise<ResolvedEnterpriseModel | null> {
    const { organizationId, tenantId } = params

    // ── 1. Runtime Input Override（最高优先）──
    const ov = params.inputOverride
    if (ov?.provider && ov?.model && ov?.apiKey) {
      return {
        provider: ov.provider,
        model: ov.model,
        apiKey: ov.apiKey,
        baseUrl: getBaseUrl(ov.provider, ''),
        source: 'input',
        sourceLabel: '运行时覆盖',
      }
    }

    // ── 2. OrgModelConfig + ProviderCredential（唯一权威）──
    const orgConfig = await prisma.orgModelConfig.findFirst({
      where: { organizationId: organizationId as any, enabled: true, capability: 'llm' },
      orderBy: { isDefault: 'desc' },
    })
    if (orgConfig) {
      const credential = await prisma.providerCredential.findUnique({
        where: {
          ownerType_organizationId_provider: {
            ownerType: 'organization',
            organizationId: organizationId as any,
            provider: orgConfig.provider,
          },
        },
      })
      if (credential && credential.status === 'active') {
        try {
          const apiKey = decryptKey(credential.encryptedKey)
          if (apiKey) {
            return {
              provider: orgConfig.provider,
              model: orgConfig.model,
              apiKey,
              baseUrl: getBaseUrl(orgConfig.provider, ''),
              source: 'org_byok',
              sourceLabel: '企业BYOK',
              configId: orgConfig.id,
              credentialId: credential.id,
              healthStatus: credential.healthStatus,
            }
          }
        } catch {
          return null // 解密失败 = 配置缺失
        }
      }
      // 企业配置了模型但 Key 缺失/失效 → 显式缺失（G2：删除企业 Key → 员工停止运行）
      // 不 fallback compat/个人/平台 Key（身份隔离）
      return null
    }

    // ── 3. EnterpriseLlmConfig（deprecated 兼容读取，仅存量企业过渡）──
    if (tenantId) {
      try {
        const legacy = await prisma.enterpriseLlmConfig.findFirst({
          where: {
            tenantId,
            status: 'active',
            enabled: true,
            credentialOwner: 'enterprise',
          },
          orderBy: { createdAt: 'asc' },
        })
        if (legacy?.encryptedApiKey) {
          const apiKey = decryptKey(legacy.encryptedApiKey)
          if (apiKey) {
            return {
              provider: legacy.provider,
              model: legacy.modelName,
              apiKey,
              baseUrl: legacy.baseUrl || getBaseUrl(legacy.provider, ''),
              source: 'compat_enterprise',
              sourceLabel: '兼容旧配置',
              configId: legacy.id,
              healthStatus: legacy.healthStatus,
            }
          }
        }
      } catch { /* ignore */ }
    }

    return null
  }

  /**
   * 保存企业模型设置：OrgModelConfig（模型选择）+ ProviderCredential（加密 Key，企业资产）
   * 幂等：存在则更新，不存在则创建。
   */
  async saveOrgModelSettings(organizationId: string, settings: OrgModelSettings): Promise<{ configId: string; credentialId: string }> {
    const { provider, model, fallbackModel, apiKey, capability = 'llm', isDefault = false } = settings

    // ProviderCredential（企业资产，加密存储）
    let credential = await prisma.providerCredential.findUnique({
      where: {
        ownerType_organizationId_provider: {
          ownerType: 'organization',
          organizationId: organizationId as any,
          provider,
        },
      },
    })
    if (apiKey) {
      const encryptedKey = encryptKey(apiKey)
      if (credential) {
        credential = await prisma.providerCredential.update({
          where: { id: credential.id },
          data: { encryptedKey, status: 'active', healthStatus: 'untested', healthError: null },
        })
      } else {
        credential = await prisma.providerCredential.create({
          data: {
            ownerType: 'organization',
            organizationId: organizationId as any,
            provider,
            encryptedKey: encryptKey(apiKey),
          },
        })
      }
    } else if (!credential) {
      throw new Error('API_KEY_REQUIRED: 企业模型设置必须提供 API Key（平台不托管企业 Key）')
    }

    // OrgModelConfig（模型选择）
    const existing = await prisma.orgModelConfig.findUnique({
      where: {
        organizationId_provider_model: { organizationId: organizationId as any, provider, model },
      },
    })
    let config: any
    if (existing) {
      config = await prisma.orgModelConfig.update({
        where: { id: existing.id },
        data: { fallbackModel, capability, enabled: true, isDefault },
      })
    } else {
      config = await prisma.orgModelConfig.create({
        data: {
          organizationId: organizationId as any,
          provider,
          model,
          fallbackModel,
          capability,
          isDefault,
        },
      })
    }

    return { configId: config.id, credentialId: credential.id }
  }

  /**
   * 获取企业模型设置（不含 Key 明文 — 平台管理员不可见企业 Key，G4 验收）
   */
  async getOrgModelSettings(organizationId: string) {
    const configs = await prisma.orgModelConfig.findMany({
      where: { organizationId: organizationId as any, enabled: true },
      orderBy: { isDefault: 'desc' },
    })
    const credentials = await prisma.providerCredential.findMany({
      where: { ownerType: 'organization', organizationId: organizationId as any },
    })
    const credMap = new Map(credentials.map((c: any) => [c.provider, c]))
    return configs.map((c: any) => {
      const cred = credMap.get(c.provider)
      return {
        id: c.id,
        provider: c.provider,
        model: c.model,
        fallbackModel: c.fallbackModel,
        capability: c.capability,
        isDefault: c.isDefault,
        hasCredential: !!cred && cred.status === 'active',
        healthStatus: cred?.healthStatus || 'untested',
        // 绝不返回 encryptedKey / 明文 Key
      }
    })
  }

  /**
   * 测试连接：真实调用模型（验证企业 Key 可用性）
   */
  async testConnection(organizationId: string, provider: string, model: string, apiKey?: string): Promise<{ ok: boolean; latencyMs?: number; error?: string; model?: string }> {
    let key = apiKey
    if (!key) {
      const credential = await prisma.providerCredential.findUnique({
        where: {
          ownerType_organizationId_provider: {
            ownerType: 'organization',
            organizationId: organizationId as any,
            provider,
          },
        },
      })
      if (!credential) return { ok: false, error: '企业未配置该 Provider 的 API Key' }
      try {
        key = decryptKey(credential.encryptedKey)
      } catch {
        return { ok: false, error: '密钥解密失败，请重新配置' }
      }
    }
    const t0 = Date.now()
    try {
      await callLLM(
        { provider, modelName: model, apiKey: key, baseUrl: getBaseUrl(provider, '') },
        '你是连接测试助手，请只回复 OK。',
        'ping',
        { maxTokens: 16, temperature: 0 },
      )
      const latencyMs = Date.now() - t0
      // 更新健康状态
      await prisma.providerCredential.updateMany({
        where: { ownerType: 'organization', organizationId: organizationId as any, provider },
        data: { healthStatus: 'ok', healthLatencyMs: latencyMs, healthError: null, lastHealthCheckAt: new Date() },
      }).catch(() => {})
      return { ok: true, latencyMs, model }
    } catch (e: any) {
      const latencyMs = Date.now() - t0
      const errMsg = (e?.message || '连接失败').slice(0, 500)
      await prisma.providerCredential.updateMany({
        where: { ownerType: 'organization', organizationId: organizationId as any, provider },
        data: { healthStatus: 'failed', healthLatencyMs: latencyMs, healthError: errMsg, lastHealthCheckAt: new Date() },
      }).catch(() => {})
      return { ok: false, latencyMs, error: errMsg }
    }
  }
}

export const modelResolver = new ModelResolverService()
