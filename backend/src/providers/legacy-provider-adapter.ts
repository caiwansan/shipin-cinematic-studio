/**
 * providers/legacy-provider-adapter.ts — 旧 Provider 适配器
 *
 * ═══════════════════════════════════════════════════════════════════
 * 使命：在不对旧 provider 做翻新改造的前提下，
 *      让它们不再自行读 process.env / 自行 fallback，
 *      改为从 RuntimeContext 获取全部配置。
 *
 * 策略（不修改旧 provider 源代码）:
 *   - 在调用旧 provider 前，临时设置 RuntimeContext
 *   - 在旧 provider 的 getApiKey() 中，优先检查 RuntimeContext
 *   - 使得旧代码中 process.env 的读取可以被 context 覆盖
 *
 * 当所有旧 provider 迁移到 ProviderV2 后，本文件可删除。
 * ═══════════════════════════════════════════════════════════════════
 */

import { getRuntimeContext, createContext, withRuntimeContext, type RuntimeContext, type ProviderSecrets } from '../services/runtime-context.js'
import type { ResolvedRuntimeConfig } from '../runtime/resolveRuntimeConfig.js'

/**
 * 用 ResolvedRuntimeConfig 包裹旧 provider 调用
 * 临时注入 context，使得旧 provider 内部的 getRuntimeContext() 可以读到正确的配置
 */
export async function withProviderContext<T>(
  config: ResolvedRuntimeConfig,
  fn: () => Promise<T>
): Promise<T> {
  // 已有 context 且 executionId 匹配 → 复用
  const existingCtx = getRuntimeContext()
  if (existingCtx && existingCtx.executionId === config.executionId) {
    return fn()
  }

  // 注入 secrets，使得旧 provider 的 getRuntimeContext()?.secrets 能读到
  const ctx = createContext({
    userId: config.userId,
    executionId: config.executionId,
    taskId: config.executionId,
    provider: {
      name: config.provider,
      model: config.model,
      source: config.source.apiKey === 'user_config' ? 'BYOK' : 'SYSTEM',
    },
    secrets: buildSecrets(config),
  })

  return withRuntimeContext(ctx, fn)
}

/**
 * 把 ResolvedRuntimeConfig 转成 RuntimeContext 能识别的 secrets
 */
function buildSecrets(config: ResolvedRuntimeConfig): ProviderSecrets {
  const provider = config.provider
  const secrets: ProviderSecrets = {}

  // 通用设置
  const apiKeyField = `${provider}ApiKey` as keyof ProviderSecrets
  const baseUrlField = `${provider}BaseUrl` as keyof ProviderSecrets
  secrets[apiKeyField] = config.apiKey
  secrets[baseUrlField] = config.baseUrl

  // 模型名设置（供旧 provider 内部模型名查找用）
  const capabilityModelField = `aliyun${capType(config.model)}Model` as keyof ProviderSecrets
  secrets[capabilityModelField] = config.model as any

  // 也设置 aliyunXXXModel（旧代码硬编码了 aliyun 前缀）
  secrets.aliyunImageModel = config.model as any
  secrets.aliyunVideoModel = config.model as any
  secrets.aliyunLlmModel = config.model as any
  secrets.aliyunTtsModel = config.model as any

  return secrets
}

function capType(model: string): string {
  if (model.includes('tts') || model.includes('voice')) return 'Tts'
  if (model.includes('video') || model.includes('wan')) return 'Video'
  if (model.includes('image') || model.includes('wan')) return 'Image'
  return 'Llm'
}

/**
 * 强制注入旧 provider 的环境变量
 * 对于仍顽固读 process.env 的旧 provider，用此方法做 fallback
 */
export function injectLegacyEnv(config: ResolvedRuntimeConfig): () => void {
  const envKey = `${config.provider.toUpperCase()}_API_KEY`
  const oldKey = process.env[envKey]
  const oldBaseUrl = process.env[`${config.provider.toUpperCase()}_BASE_URL`]

  process.env[envKey] = config.apiKey
  if (config.baseUrl) {
    process.env[`${config.provider.toUpperCase()}_BASE_URL`] = config.baseUrl
  }

  return () => {
    if (oldKey) process.env[envKey] = oldKey
    else delete process.env[envKey]
    if (oldBaseUrl) process.env[`${config.provider.toUpperCase()}_BASE_URL`] = oldBaseUrl
    else delete process.env[`${config.provider.toUpperCase()}_BASE_URL`]
  }
}

/**
 * 自检：当前系统是否有未经过 Gateway 的 provider 调用在运行
 * 检测方法：检查当前域名的执行路径
 */
export function executionPathDetect(): 'gateway' | 'legacy' | 'unknown' {
  const ctx = getRuntimeContext()
  if (ctx?.executionId && ctx?.provider?.name) return 'gateway'
  // 没有 context → 大概率是旧路径
  return 'legacy'
}
