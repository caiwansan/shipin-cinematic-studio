/**
 * runtime/resolveRuntimeConfig.ts — 运行时配置解析链
 *
 * ═══════════════════════════════════════════════════════════════════
 * Runtime Authority — 全系统唯一配置入口
 *
 * 职责：
 *   所有 provider 调用的 API Key / Base URL / Model / 策略
 *   只能从这里出来，禁止 provider 内部自行决定。
 *
 * 解析链优先级（从高到低）：
 *   1. 输入层 input.model / input.apiKey（前端用户选）
 *   2. 企业配置层 EnterpriseLlmConfig（tenantId + credentialOwner=enterprise）
 *   3. 平台配置层 admin-global-config（businessType 区分短剧/求职/PPT/音乐）
 *   4. 用户配置层 UserModelConfig（DB 存储，BYOK）
 *   5. 阶段配置层 AiStageModelConfig（管理配置）
 *   6. Provider 注册表 ModelProvider（系统默认）
 *   7. 环境变量 process.env（最低优先级，仅作为开发后门）
 *
 * Sprint-06A 新增：
 *   - tenantId 参数 → 读取 EnterpriseLlmConfig
 *   - businessType 参数 → 读取平台全局配置
 *   - 三类调用统一入口：平台 AI / 用户 BYOK / 企业 AI 员工
 * ═══════════════════════════════════════════════════════════════════
 */

import { prisma } from '../utils/index.js'
import { loadFullConfigV2 } from '../config/v2.js'
import { getRuntimeContext, type RuntimeContext } from '../services/runtime-context.js'
import { decryptKey } from '../services/crypto.service.js'
import { getRouteConfig } from '../utils/index.js'
import { env } from '../config/env.js'

// ─── Types ──────────────────────────────────────────────────────────

export interface ResolvedRuntimeConfig {
  /** Prisma-level userId (UUID) */
  userId: string
  /** 统一执行 ID（全链路追踪） */
  executionId: string
  /** 所选 Provider */
  provider: string
  /** 最终模型名 */
  model: string
  /** API 端点 */
  baseUrl: string
  /** API Key */
  apiKey: string
  /** Provider 友好名称 */
  providerLabel: string
  /** 超时（ms） */
  timeout: number
  /** 重试次数 */
  retry: number
  /** 配置来源追踪 */
  source: {
    model: 'input' | 'enterprise_config' | 'platform_config' | 'user_config' | 'stage_config' | 'provider_registry' | 'env_default'
    apiKey: 'enterprise_config' | 'user_config' | 'platform_config' | 'env' | 'none'
    baseUrl: 'enterprise_config' | 'user_config' | 'provider_registry' | 'env_default'
  }
}

// ─── Provider → Base URL 映射（仅作为最低 fallback）────────────────────

const PROVIDER_BASE_URLS: Record<string, string> = {
  bailian: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1',
  siliconflow: 'https://api.siliconflow.cn/v1',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
}

// ─── Capability → 环境变量 Key ──────────────────────────────────────

function envKeyForProvider(provider: string): string {
  const map: Record<string, string> = {
    deepseek: 'DEEPSEEK_API_KEY',
    openai: 'OPENAI_API_KEY',
    siliconflow: 'SILICONFLOW_API_KEY',
    volcengine: 'VOLCENGINE_API_KEY',
    aliyun: 'ALIYUN_API_KEY',
    bailian: 'ALIYUN_API_KEY',
  }
  return map[provider] || ''
}

// ─── 核心解析函数 ────────────────────────────────────────────────────

export async function resolveRuntimeConfig(
  capability: 'llm' | 'image' | 'video' | 'tts',
  input?: {
    model?: string
    provider?: string
    userId?: string
    tenantId?: string      // Sprint-06A: 企业 ID → EnterpriseLlmConfig
    businessType?: string  // Sprint-07A.3: 'hdz' | 'career_advisor' | 'ppt' | 'music' → admin-global-config
  }
): Promise<ResolvedRuntimeConfig> {
  const ctx = getRuntimeContext() as RuntimeContext | undefined
  const userId = input?.userId || ctx?.userId || ''
  const tenantId = input?.tenantId || ''
  const executionId = ctx?.executionId || `exec_${Date.now().toString(36)}`

  // ── 1. 输入层（最高优先级） ──
  if (input?.model && input?.provider) {
    let apiKey: string | undefined
    // Sprint-06A: 如果有 tenantId，优先从 EnterpriseLlmConfig 取 Key
    if (tenantId) {
      try {
        const enterpriseConfig = await prisma.enterpriseLlmConfig.findFirst({
          where: {
            tenantId,
            provider: input.provider,
            modelName: input.model,
            enabled: true,
            status: 'active',
            credentialOwner: 'enterprise',
          },
        })
        if (enterpriseConfig?.encryptedApiKey) {
          apiKey = decryptKey(enterpriseConfig.encryptedApiKey)
        }
      } catch { /* ignore */ }
    }
    if (!apiKey) {
      apiKey = await resolveApiKeyExact(userId, input.provider, capability)
    }
    return buildConfig({
      userId,
      executionId,
      provider: input.provider,
      model: input.model,
      baseUrl: PROVIDER_BASE_URLS[input.provider] || '',
      apiKey,
      source: { model: 'input', apiKey: apiKey ? (tenantId ? 'enterprise_config' : 'user_config') : 'env', baseUrl: 'provider_registry' },
    })
  }

  // ── 2. 企业配置层（EnterpriseLlmConfig, credentialOwner=enterprise）──
  // Sprint-06A: 企业 AI 员工走这里，不走用户 BYOK
  if (tenantId && capability === 'llm') {
    try {
      const enterpriseConfig = await prisma.enterpriseLlmConfig.findFirst({
        where: {
          tenantId,
          enabled: true,
          status: 'active',
          credentialOwner: 'enterprise',
        },
        orderBy: { createdAt: 'asc' },
      })
      if (enterpriseConfig && enterpriseConfig.encryptedApiKey) {
        const apiKey = decryptKey(enterpriseConfig.encryptedApiKey)
        if (apiKey) {
          return buildConfig({
            userId,
            executionId,
            provider: enterpriseConfig.provider,
            model: enterpriseConfig.modelName,
            baseUrl: enterpriseConfig.baseUrl || PROVIDER_BASE_URLS[enterpriseConfig.provider] || '',
            apiKey,
            source: {
              model: 'enterprise_config',
              apiKey: 'enterprise_config',
              baseUrl: enterpriseConfig.baseUrl ? 'enterprise_config' : 'provider_registry',
            },
          })
        }
      }
    } catch (e) {
      console.warn(`[resolveRuntimeConfig] EnterpriseLlmConfig 读取失败:`, e)
    }
  }

  // ── 3. 平台配置层（admin-global-config + businessType）──
  // Sprint-07A.2: 平台 AI 能力走这里，API Key 优先从 apiKey 表读取
  if (input?.businessType && capability === 'llm') {
    try {
      const platformModel = await getRouteConfig(
        `route:admin-global-config:${input.businessType}`,
        'llm_model',
        ''
      )
      const platformProvider = await getRouteConfig(
        `route:admin-global-config:${input.businessType}`,
        'llm_provider',
        'deepseek'
      )
      if (platformModel) {
        // Sprint-07A.2: 优先从 apiKey 表读取管理员配置的 Key
        let apiKey = ''
        try {
          const apiKeyRow = await prisma.apiKey.findUnique({
            where: { provider: `business_type_${input.businessType}` }
          })
          if (apiKeyRow?.keyValue) {
            apiKey = apiKeyRow.keyValue
          }
        } catch { /* apiKey 表不存在时忽略 */ }

        // Fallback: 环境变量
        if (!apiKey) {
          const envKey = envKeyForProvider(platformProvider)
          apiKey = process.env[envKey] || ''
        }

        // Base URL（优先从 routeConfig 读取）
        let baseUrl = ''
        try {
          baseUrl = await getRouteConfig(
            `route:admin-global-config:${input.businessType}`,
            'llm_base_url',
            ''
          )
        } catch { /* 忽略 */ }
        if (!baseUrl) {
          baseUrl = PROVIDER_BASE_URLS[platformProvider as string] || ''
        }

        if (apiKey) {
          return buildConfig({
            userId,
            executionId,
            provider: platformProvider,
            model: platformModel as string,
            baseUrl,
            apiKey,
            source: {
              model: 'platform_config',
              apiKey: 'platform_config',
              baseUrl: baseUrl ? 'platform_config' : 'provider_registry',
            },
          })
        }
      }
    } catch (e) {
      console.warn(`[resolveRuntimeConfig] Platform config 读取失败 (businessType=${input.businessType}):`, e)
    }
  }

  // ── 4. 用户配置层（V2 单行配置） ──
  if (userId && userId !== 'anonymous') {
    try {
      const v2 = await loadFullConfigV2(userId)
      if (v2) {
        // Sprint-07A.2-AI-03: LLM 能力级覆盖（capabilityLlmConfigs）
        if (capability === 'llm' && v2.capabilityLlmConfigs) {
          const capConfigs = v2.capabilityLlmConfigs as Record<string, any>
          // Sprint-07A.3: 从 input.businessType 或默认 'career_agent' 读取能力级配置
          const capType = input?.businessType || 'career_agent'
          const capConfig = capConfigs[capType]
          if (capConfig?.provider && capConfig?.model && capConfig?.apiKey) {
            return buildConfig({
              userId,
              executionId,
              provider: capConfig.provider,
              model: capConfig.model,
              baseUrl: capConfig.baseUrl || PROVIDER_BASE_URLS[capConfig.provider] || '',
              apiKey: capConfig.apiKey,
              source: {
                model: 'user_capability_config',
                apiKey: 'user_capability_config',
                baseUrl: capConfig.baseUrl ? 'user_capability_config' : 'provider_registry',
              },
            })
          }
        }

        // 根据 capability 取对应字段
        const providerMap: Record<string, string> = { llm: 'llmProvider', image: 'imageProvider', video: 'videoProvider', tts: 'ttsProvider' }
        const keyMap: Record<string, string> = { llm: 'llmApiKey', image: 'imageApiKey', video: 'videoApiKey', tts: 'ttsApiKey' }
        const modelMap: Record<string, string> = { llm: 'llmModel', image: 'imageModel', video: 'videoModel', tts: 'ttsModel' }
        const enabledMap: Record<string, string> = { llm: 'llmEnabled', image: 'imageEnabled', video: 'videoEnabled', tts: 'ttsEnabled' }

        const providerField = providerMap[capability]
        const keyField = keyMap[capability]
        const modelField_m = modelMap[capability]
        const enabledField_m = enabledMap[capability]

        if (providerField && v2[enabledField_m as keyof typeof v2]) {
          const provider = (v2[providerField as keyof typeof v2] || 'volcengine') as string
          const encKey = v2[keyField as keyof typeof v2] as string | null
          const model = (v2[modelField_m as keyof typeof v2] || requireModel(provider, capability)) as string

          if (encKey) {
            const apiKey = decryptKey(encKey)
            return buildConfig({
              userId, executionId,
              provider, model, baseUrl: v2.baseUrl || PROVIDER_BASE_URLS[provider] || '', apiKey,
              source: { model: 'user_config', apiKey: 'user_config', baseUrl: v2.baseUrl ? 'user_config' : 'provider_registry' },
            })
          }

          // 有 provider + model 但没有 Key → 抛显式错误
          throw new Error(
            `[CONFIG_ERROR] 用户已选择 ${provider}:${capability}，` +
            `但未配置该能力的 API Key。请先在大模型设置中配置 Key。`
          )
        }
      }
    } catch (e) {
      // 重新抛 CONFIG_ERROR，捕获包裹其他错误
      if (e instanceof Error && e.message.startsWith('[CONFIG_ERROR]')) throw e
      console.warn(`[resolveRuntimeConfig] V2 配置读取失败:`, e)
    }
  }

  // ── 5. 阶段配置层 ──
  try {
    const stageConfig = await prisma.aiStageModelConfig.findUnique({
      where: { stage: capability },
    })
    if (stageConfig?.enabled) {
      const apiKey = await resolveApiKeyExact(userId, stageConfig.provider, capability)
      return buildConfig({
        userId,
        executionId,
        provider: stageConfig.provider,
        model: stageConfig.model,
        baseUrl: stageConfig.baseUrl || PROVIDER_BASE_URLS[stageConfig.provider] || '',
        apiKey,
        source: { model: 'stage_config', apiKey: apiKey ? 'user_config' : 'env', baseUrl: stageConfig.baseUrl ? 'provider_registry' : 'provider_registry' },
      })
    }
  } catch {
    // stage config 不存在是正常的（未迁移）
  }

  // ── 6. 环境变量（开发后门） ──
  const provider = input?.provider || 'bailian'
  const model = env[`${provider.toUpperCase()}_${capability.toUpperCase()}_MODEL` as keyof typeof env] as string
              || env[`ALIYUN_${capability.toUpperCase()}_MODEL` as keyof typeof env] as string
              || requireModel(provider, capability)
  const apiKey = process.env[envKeyForProvider(provider)] || ''

  return buildConfig({
    userId,
    executionId,
    provider,
    model,
    baseUrl: PROVIDER_BASE_URLS[provider] || '',
    apiKey,
    source: { model: 'env_default', apiKey: apiKey ? 'env' : 'none', baseUrl: 'env_default' },
  })
}

// ─── Helper ─────────────────────────────────────────────────────────

function buildConfig(params: Omit<ResolvedRuntimeConfig, 'timeout' | 'retry' | 'providerLabel' | 'source'> & { source: ResolvedRuntimeConfig['source'] }): ResolvedRuntimeConfig {
  return {
    ...params,
    timeout: 180000,
    retry: 0,
    providerLabel: params.provider.charAt(0).toUpperCase() + params.provider.slice(1),
    source: params.source,
  }
}

/**
 * ⭐ 强约束 Key 索引：provider + capability 精确匹配
 *
 * 不再有：
 *   - 任意 Key 通配扫描
 *   - for 循环盲搜第一个非空 Key
 *
 * 匹配规则：
 *   V2 表：{llm,image,video,tts}ApiKey 字段各自绑定自己的 provider
 *   精确匹配 provider 和 capability 同时命中才返回
 */
async function resolveApiKeyExact(userId: string, provider: string, capability: string): Promise<string> {
  if (!userId || userId === 'anonymous') return process.env[envKeyForProvider(provider)] || ''

  try {
    const v2 = await loadFullConfigV2(userId)
    if (!v2) return process.env[envKeyForProvider(provider)] || ''

    // V2 表：各能力独立 Key 字段，检查该能力的 provider 是否匹配
    const providerCapMap: Record<string, string> = {
      llm: 'llmProvider',
      image: 'imageProvider',
      video: 'videoProvider',
      tts: 'ttsProvider',
    }
    const keyCapMap: Record<string, string> = {
      llm: 'llmApiKey',
      image: 'imageApiKey',
      video: 'videoApiKey',
      tts: 'ttsApiKey',
    }

    const capProvider = v2[providerCapMap[capability] as keyof typeof v2] as string | undefined
    const encKey = v2[keyCapMap[capability] as keyof typeof v2] as string | null

    // ✅ 精确匹配：该能力的 provider 字段与请求的 provider 一致，且有 Key
    if (capProvider === provider && encKey) {
      return decryptKey(encKey)
    }

    // 用户配置了该能力但 provider 不匹配 → 抛显式错误
    if (capProvider && encKey && capProvider !== provider) {
      throw new Error(
        `[CONFIG_ERROR] ${capability} 的 provider 为 ${capProvider}，` +
        `但请求使用了 ${provider}。请在大模型设置中切换一致。`
      )
    }

    // 没找到 Key
    throw new Error(
      `[CONFIG_ERROR] 用户 ${provider}:${capability} 的 API Key 未配置。` +
      `请先在大模型设置中配置 Key。`
    )
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('[CONFIG_ERROR]')) throw e
    return process.env[envKeyForProvider(provider)] || ''
  }
}

/**
 * ⭐ 强制显式错误，替代旧的 fallbackModel
 *
 * 不再静默 fallback 到硬编码的默认模型。
 * 用户没配 → 抛 CONFIG_ERROR，要么请用户配置，要么返回明确错误信息。
 */
function requireModel(provider: string, capability: string): string {
  throw new Error(
    `[CONFIG_ERROR] 用户未配置 ${provider}:${capability} 的模型名。` +
    `请先在大模型设置面板中配置模型。`
  )
}
