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
 *   2. 用户配置层 UserModelConfig（DB 存储）
 *   3. 阶段配置层 AiStageModelConfig（管理配置）
 *   4. Provider 注册表 ModelProvider（系统默认）
 *   5. 环境变量 process.env（最低优先级，仅作为开发后门）
 * ═══════════════════════════════════════════════════════════════════
 */

import { prisma } from '../utils/index.js'
import { loadFullConfigV2 } from '../config/v2.js'
import { getRuntimeContext, type RuntimeContext } from '../services/runtime-context.js'
import { decryptKey } from '../services/crypto.service.js'
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
    model: 'input' | 'user_config' | 'stage_config' | 'provider_registry' | 'env_default'
    apiKey: 'user_config' | 'env' | 'none'
    baseUrl: 'user_config' | 'provider_registry' | 'env_default'
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
  }
): Promise<ResolvedRuntimeConfig> {
  const ctx = getRuntimeContext() as RuntimeContext | undefined
  const userId = input?.userId || ctx?.userId || ''
  const executionId = ctx?.executionId || `exec_${Date.now().toString(36)}`

  // ── 1. 输入层（最高优先级） ──
  if (input?.model && input?.provider) {
    const apiKey = await resolveApiKeyExact(userId, input.provider, capability)
    return buildConfig({
      userId,
      executionId,
      provider: input.provider,
      model: input.model,
      baseUrl: PROVIDER_BASE_URLS[input.provider] || '',
      apiKey,
      source: { model: 'input', apiKey: apiKey ? 'user_config' : 'env', baseUrl: 'provider_registry' },
    })
  }

  // ── 2. 用户配置层（V2 单行配置） ──
  if (userId && userId !== 'anonymous') {
    try {
      const v2 = await loadFullConfigV2(userId)
      if (v2) {
        // 根据 capability 取对应字段
        const providerMap: Record<string, string> = { image: 'imageProvider', video: 'videoProvider', tts: 'ttsProvider' }
        const keyMap: Record<string, string> = { image: 'imageApiKey', video: 'videoApiKey', tts: 'ttsApiKey' }
        const modelMap: Record<string, string> = { image: 'imageModel', video: 'videoModel', tts: 'ttsModel' }
        const enabledMap: Record<string, string> = { image: 'imageEnabled', video: 'videoEnabled', tts: 'ttsEnabled' }

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

  // ── 3. 阶段配置层 ──
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

  // ── 4. 环境变量（开发后门） ──
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
