/**
 * services/user-model-resolver.ts — 用户模型配置解析（V2 真相源）
 *
 * 已从 V1 → V2 迁移。直接从 UserModelConfigV2 读取配置。
 * 移除所有 V1 UserModelConfig 表调用。
 *
 * S3.4.1.5: Development Provider 兜底（仅 dev/test）
 * S4.1 BYOK: Tenant Provider Credential 优先（企业自持凭证, 组织隔离）
 * 解析优先级（冻结）:
 *   1. TenantProviderCredential（organizationId 隔离, ACTIVE）
 *   2. UserModelConfigV2（用户 BYOK）
 *   3. Dev Provider（KUNLUN_DEV_PROVIDER=1 + DEEPSEEK_DEV_API_KEY）
 * 原则: 不新增 Provider 路由体系（调用仍唯一经 Unified AI Gateway）
 */

import { prisma } from '../utils/index.js'
import { decryptKey } from './crypto.service.js'
import { getOrganizationIdForUser } from './enterprise/organization/identity-bootstrap.service.js'

export interface ResolvedProvider {
  provider: string
  modelName: string
  apiKey: string
  baseUrl?: string
  /** S4.1: 解析来源（审计可追踪: tenant-credential | user-config | dev） */
  source?: 'tenant-credential' | 'user-config' | 'dev'
}

export class UserModelResolver {
  /**
   * S3.4.1.5: Development Provider（dev/test 点火钥匙, 非商业能力）
   */
  async resolveDevProvider(capability: string): Promise<ResolvedProvider | null> {
    if (capability !== 'llm') return null
    const devEnabled = process.env.KUNLUN_DEV_PROVIDER === '1'
    const key = process.env.DEEPSEEK_DEV_API_KEY
    if (!devEnabled || !key) return null
    return {
      provider: 'deepseek',
      modelName: process.env.DEEPSEEK_LLM_MODEL || 'deepseek-v4-flash',
      apiKey: key,
      baseUrl: process.env.DEEPSEEK_BASE_URL || undefined,
      source: 'dev',
    }
  }

  /**
   * S4.1 BYOK: 企业自持凭证（租户隔离, 加密存储）
   * 输入 userId → governance org → TenantProviderCredential
   */
  async resolveTenantCredential(capability: string, userId: string): Promise<ResolvedProvider | null> {
    if (capability !== 'llm') return null
    const orgId = await getOrganizationIdForUser(userId).catch(() => null)
    if (!orgId) return null
    const cred = await prisma.tenantProviderCredential
      .findUnique({ where: { organizationId: orgId } })
      .catch(() => null)
    if (!cred || cred.status !== 'ACTIVE') return null
    try {
      const decrypted = decryptKey(cred.credentialRef)
      return {
        provider: cred.provider,
        modelName: cred.modelName,
        apiKey: decrypted,
        baseUrl: cred.baseUrl || undefined,
        source: 'tenant-credential',
      }
    } catch {
      return null
    }
  }

  async resolve(capability: string, userId: string): Promise<ResolvedProvider | null> {
    // UUID 格式校验：如果不是合法 UUID，直接返回 null
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return null
    }

    // S4.1: Tenant BYOK 优先（企业级凭证; 调用方无组织则跳过）
    const tenantCred = await this.resolveTenantCredential(capability, userId)
    if (tenantCred) return tenantCred

    let v2: any
    try {
      v2 = await prisma.userModelConfigV2.findUnique({ where: { userId } })
    } catch {
      return this.resolveDevProvider(capability)
    }
    if (!v2) return this.resolveDevProvider(capability)

    // capability 到 V2 配置字段映射
    const map: Record<string, { prov: string; key: string; mdl: string; en: boolean }> = {
      llm: { prov: v2.llmProvider || '', key: v2.llmApiKey || '', mdl: v2.llmModel || '', en: v2.llmEnabled },
      image: { prov: v2.imageProvider || '', key: v2.imageApiKey || '', mdl: v2.imageModel || '', en: v2.imageEnabled },
      video: { prov: v2.videoProvider || '', key: v2.videoApiKey || '', mdl: v2.videoModel || '', en: v2.videoEnabled },
      tts: { prov: v2.ttsProvider || '', key: v2.ttsApiKey || '', mdl: v2.ttsModel || '', en: v2.ttsEnabled },
    }

    const cfg = map[capability]
    if (!cfg || !cfg.key || !cfg.en) return this.resolveDevProvider(capability)

    let decrypted: string
    try {
      decrypted = decryptKey(cfg.key)
    } catch {
      return this.resolveDevProvider(capability)
    }

    return {
      provider: cfg.prov,
      modelName: cfg.mdl,
      apiKey: decrypted,
      baseUrl: v2.baseUrl || undefined,
      source: 'user-config',
    }
  }
}

export const userModelResolver = new UserModelResolver()
