/**
 * services/api-router.service.ts — BYO AI + 平台 fallback 路由层
 *
 * v2 增强:
 * - 熔断器感知（跳过 OPEN 的 provider）
 * - 评分路由（可靠性 × 延迟 - 成本 - 负载）
 * - 智能 fallback 链
 */

import { prisma } from '../utils/index.js'
import { canRequest, registerProvider, recordResult, getAllCircuitBreakerStatus } from '../core/circuit-breaker.js'

interface ProviderScoreParams {
  reliability: number  // 0~1
  latency: number      // ms
  cost: number         // 单次预估成本
  isPlatformKey: boolean
  isUserProvider: boolean
}

const TASK_PROVIDERS: Record<string, { provider: string; envKey: string; cost: number }[]> = {
  image: [
    { provider: 'aliyun', envKey: 'ALIYUN_API_KEY', cost: 0.004 },
    { provider: 'volcengine', envKey: 'VOLCENGINE_API_KEY', cost: 0.008 },
  ],
  tts: [
    { provider: 'volcengine', envKey: 'VOLCENGINE_API_KEY', cost: 0.001 },
    { provider: 'aliyun', envKey: 'ALIYUN_API_KEY', cost: 0.002 },
    { provider: 'siliconflow', envKey: 'SILICONFLOW_API_KEY', cost: 0.0015 },
  ],
  video: [
    { provider: 'volcengine', envKey: 'VOLCENGINE_API_KEY', cost: 0.05 },
    { provider: 'aliyun', envKey: 'ALIYUN_API_KEY', cost: 0.04 },
  ],
  llm: [
    { provider: 'deepseek', envKey: 'DEEPSEEK_API_KEY', cost: 0.001 },
    { provider: 'volcengine', envKey: 'VOLCENGINE_API_KEY', cost: 0.0008 },
    { provider: 'aliyun', envKey: 'ALIYUN_API_KEY', cost: 0.002 },
  ],
}

export interface ProviderConfig {
  provider: string
  envKeyName: string
  baseUrl?: string
  isUserOwned: boolean
  modelName?: string
}

function enabledForTask(config: any, taskType: string): boolean {
  const map: Record<string, string> = {
    llm: 'llmEnabled',
    image: 'imageEnabled',
    tts: 'ttsEnabled',
    video: 'videoEnabled',
    frame: 'imageEnabled',
  }
  return config[map[taskType]] !== false
}

export const apiRouter = {
  /**
   * 选择最优 AI provider（熔断感知 + 评分）
   */
  async selectProvider(
    userId: string | undefined,
    taskType: string,
    fallbackOnUserFail: boolean = true,
    skipProvider?: string,  // 如果有，排除此 provider（用于余额不足 fallback 时不再选同一个）
    preferProvider?: string  // 如果有，优先尝试此 provider（由前端传的用户选择）
  ): Promise<ProviderConfig | null> {
    // 1. 尝试用户的私有 key（仅当 userId 是合法 UUID 时）
    if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      // ⭐ 先确定用户为此 taskType 选择的 preferred provider（来自 userModelConfig.xxxProvider）
      let userSpecifiedProvider = preferProvider || ''
      if (!userSpecifiedProvider) {
        try {
          const { getUserModelConfig } = await import('../runtime/with-user-model-config.js')
          // 遍历所有可能 provider，找到 xxxProvider 字段指向自己的
          const allProviders = ['aliyun', 'siliconflow', 'volcengine', 'deepseek', 'custom', 'openai']
          const providerFieldMap: Record<string, string> = {
            llm: 'llmProvider', image: 'imageProvider', video: 'videoProvider', tts: 'ttsProvider', frame: 'imageProvider',
          }
          const targetField = providerFieldMap[taskType]
          if (targetField) {
            for (const prov of allProviders) {
              const cfg = await getUserModelConfig(userId, prov)
              if (cfg?.apiKey && (cfg as any)[targetField] === prov) {
                userSpecifiedProvider = prov
                break
              }
            }
          }
        } catch (e) { /* ignore query error */ }
      }

      // 用户指定的 provider 优先，其余按合理顺序（aliyun/volcengine/siliconflow 有 handler）
      const providersToTry = userSpecifiedProvider
        ? [userSpecifiedProvider, ...['aliyun', 'volcengine', 'siliconflow', 'deepseek', 'custom', 'openai'].filter(p => p !== userSpecifiedProvider)]
        : ['aliyun', 'volcengine', 'siliconflow', 'deepseek', 'custom', 'openai']

      let userConfig: any = null
      try {
        const { getUserModelConfig } = await import('../runtime/with-user-model-config.js')
        for (const prov of providersToTry) {
          const cfg = await getUserModelConfig(userId, prov)
          if ((cfg?.apiKey || cfg?.imageApiKey || cfg?.videoApiKey) && enabledForTask(cfg, taskType)) {
            userConfig = cfg
            const envKeyMap: Record<string, string> = {
              siliconflow: 'SILICONFLOW_API_KEY',
              aliyun: 'ALIYUN_API_KEY',
              volcengine: 'VOLCENGINE_API_KEY',
              deepseek: 'DEEPSEEK_API_KEY',
              custom: 'CUSTOM_API_KEY',
            }
            return {
              provider: prov,
              envKeyName: envKeyMap[prov] || 'ALIYUN_API_KEY',
              baseUrl: cfg.baseUrl || undefined,
              isUserOwned: true,
              modelName: taskType === 'image' ? (cfg.imageModel || undefined)
                        : taskType === 'video' ? (cfg.videoModel || undefined)
                        : taskType === 'tts' ? (cfg.ttsModel || undefined)
                        : (cfg.llmModel || undefined),
            }
          }
        }
      } catch {}

      // 回退：查旧的 userApiKey 表
      const userApiKey = await prisma.userApiKey.findFirst({
        where: {
          userId,
          isActive: true,
          modelType: taskType === 'llm' ? { in: ['llm', 'audio'] }
                    : taskType === 'tts' ? 'tts'
                    : taskType === 'image' ? 'image'
                    : taskType === 'video' ? 'video' : undefined,
        },
        select: {
          provider: true,
          baseUrl: true,
          modelName: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      if (userApiKey) {
        // 检查用户 provider 的熔断状态
        const cbCheck = canRequest(`user:${userId}:${userApiKey.provider}`)
        if (cbCheck.allowed) {
          return {
            provider: userApiKey.provider,
            envKeyName: getEnvKeyName(userApiKey.provider) || '',
            baseUrl: userApiKey.baseUrl || undefined,
            isUserOwned: true,
            modelName: userApiKey.modelName || undefined,
          }
        }
        // 用户 key 熔断中 → fallback
        console.warn(`[ApiRouter] User provider ${userApiKey.provider} circuit open for user ${userId.substring(0,8)}, falling back`)
      }

      // fallback 检查：用户没配自己的 Key 就不能用，不走系统回退
      if (!fallbackOnUserFail || !userConfig?.apiKey) {
        return null  // 用户必须自行配置 API Key
      }
    }

    // 2. 平台 provider — 评分排序，跳过熔断 + 禁用的（仅匿名用户或兼容模式）
    const providers = TASK_PROVIDERS[taskType] || []
    if (providers.length === 0) return null

    // 从 DB 读取 admin 后台禁用的 provider 列表
    let disabledProviders = new Set<string>()
    try {
      const enabledRow = await prisma.apiKey.findUnique({ where: { provider: 'global_model_enabled_providers' } })
      if (enabledRow?.keyValue) {
        const enabledList = new Set(enabledRow.keyValue.split(',').map(s => s.trim()).filter(Boolean))
        // 有 enabled 列表时，不在列表里的就是禁用的
        // 注意别名：代码中用 bailian，admin 后台用 aliyun
        const codeToDb: Record<string, string> = { bailian: 'aliyun' }
        for (const p of providers) {
          const dbName = codeToDb[p.provider] || p.provider
          if (!enabledList.has(dbName)) {
            disabledProviders.add(p.provider)
          }
        }
      }
      // 如果没有 enabled 列表（首次使用），默认都启用
    } catch { /* ignore db errors */ }

    const scored: { provider: string; envKey: string; cost: number; score: number }[] = []

    console.log(`[ApiRouter] disabledProviders: ${Array.from(disabledProviders).join(',') || '(none)'}, providers: ${providers.map(p => p.provider).join(',')}`)

    for (const p of providers) {
      // 跳过指定排除的 provider（余额不足 fallback 用）
      if (skipProvider && p.provider === skipProvider) continue

      // 跳过 admin 后台禁用的 provider（但 video 类型不受限，因为视频只能走 volcengine）
      if (disabledProviders.has(p.provider) && taskType !== 'video') continue

      // 检查是否有环境变量
      if (!process.env[p.envKey]) continue

      // 检查熔断器
      const cbCheck = canRequest(p.provider)
      if (!cbCheck.allowed) continue

      // 获取熔断器状态信息用于评分
      const cbStatus = getAllCircuitBreakerStatus()[p.provider]
      const reliability = cbStatus ? 1 - cbStatus.failureRate : 1
      const latency = cbStatus ? cbStatus.avgLatency : 1000

      // 评分: reliability × 50 - latency(秒) × 10 - cost × 1000 - degradeFactor × 20
      const degradePenalty = cbCheck.degradeFactor < 1 ? 20 : 0
      const score = reliability * 50 - (latency / 1000) * 10 - p.cost * 1000 - degradePenalty

      scored.push({ ...p, score })
    }

    if (scored.length === 0) return null

    // 按评分降序排列
    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]

    console.log(`[ApiRouter] Selected ${best.provider} (score=${best.score.toFixed(1)}) for ${taskType}`)

    return {
      provider: best.provider,
      envKeyName: best.envKey,
      isUserOwned: false,
    }
  },

  /**
   * 获取可用 provider 列表
   */
  async getAvailableProviders(userId?: string): Promise<{
    user: string[]
    platform: string[]
  }> {
    const platformAvail = Object.keys(TASK_PROVIDERS).filter(t =>
      TASK_PROVIDERS[t].some(p => process.env[p.envKey])
    )

    let userProviders: string[] = []
    if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      const keys = await prisma.userApiKey.findMany({
        where: { userId, isActive: true },
        select: { provider: true },
      })
      userProviders = [...new Set(keys.map(k => k.provider))]
    }

    return {
      user: userProviders,
      platform: [...new Set(platformAvail)],
    }
  },

  /**
   * 记录一次 API 调用结果到熔断器
   */
  recordApiResult(
    provider: string,
    userId: string | undefined,
    success: boolean,
    latency: number,
    isTimeout: boolean = false
  ) {
    // 注册并记录
    registerProvider(provider)
    recordResult(provider, success, latency, isTimeout)

    // 如果是用户私有 key，独立熔断
    if (userId && success) {
      registerProvider(`user:${userId}:${provider}`)
    }
  },
}

function getEnvKeyName(provider: string): string | null {
  const map: Record<string, string> = {
    volcengine: 'VOLCENGINE_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    aliyun: 'ALIYUN_API_KEY',
    bailian: 'ALIYUN_API_KEY',
    siliconflow: 'SILICONFLOW_API_KEY',
  }
  return map[provider] || null
}
