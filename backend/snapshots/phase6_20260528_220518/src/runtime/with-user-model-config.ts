/**
 * runtime/with-user-model-config.ts — 用户模型配置注入
 *
 * ⚠️ 重要：不再注入 process.env，改为返回配置数据 + 设置 RuntimeContext
 *
 * 在执行 LLM/图片/视频/TTS 调用前，从数据库读取用户的 `UserModelConfig`
 * 如果用户配置了特定 provider 的模型名，就覆盖默认参数
 * 如果用户的某个模型类型被 disabled，直接抛错提示
 */

import { prisma } from '../utils/index.js'
import { decryptKey } from '../services/crypto.service.js'
import { withRuntimeContext, getRuntimeContext } from '../services/runtime-context.js'

export interface UserModelConfigData {
  provider: string
  apiKey?: string | null
  imageApiKey?: string | null       // 图片专用 Key
  videoApiKey?: string | null       // 视频专用 Key
  baseUrl?: string | null
  llmModel: string
  llmEnabled: boolean
  imageModel: string
  imageEnabled: boolean
  videoModel: string
  videoEnabled: boolean
  ttsModel: string
  ttsEnabled: boolean
  llmProvider?: string | null
  imageProvider?: string | null
  videoProvider?: string | null
  ttsProvider?: string | null
}

/**
 * 从数据库获取用户的模型配置
 * 如果用户没有显式配置，返回默认值
 */
export async function getUserModelConfig(
  userId: string,
  provider: string = 'aliyun',
): Promise<UserModelConfigData | null> {
  if (!userId || userId === 'anonymous') return null

  try {
    const user = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { memberTier: true }
    })
    if (!user) {
      console.log(`[UserModelConfig] User ${userId.substring(0,8)} not found`)
      return null
    }

    // 所有用户都能配置大模型（不强制 VIP）
    // 配额限制在 usage-quota.service.ts 统一处理

    const plan = await prisma.memberPlan.findUnique({ where: { level: user.memberTier } })
    if (plan) {
      if (provider === 'custom' && !plan.localModelEnabled) {
        console.log(`[UserModelConfig] User ${userId.substring(0,8)} tier ${user.memberTier} has no local model permission`)
        return null
      }
      if (provider !== 'custom' && provider !== 'aliyun' && !plan.onlineApiEnabled) {
        console.log(`[UserModelConfig] User ${userId.substring(0,8)} tier ${user.memberTier} has no online API permission`)
        return null
      }
    }

    console.warn("[LEGACY-V1-READ] with-user-model-config.ts — getUserModelConfig() 读 V1 findUnique");
    const config = await prisma.userModelConfig.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    })

    if (!config) return null

    let decryptedKey: string | null = null
    let decryptedImageKey: string | null = null
    let decryptedVideoKey: string | null = null
    if (config.apiKey) {
      try {
        decryptedKey = decryptKey(config.apiKey)
      } catch (err) {
        console.warn(`[UserModelConfig] Failed to decrypt API key for user ${userId.substring(0, 8)}`)
      }
    }
    if (config.imageApiKey) {
      try {
        decryptedImageKey = decryptKey(config.imageApiKey)
      } catch (err) {
        console.warn(`[UserModelConfig] Failed to decrypt imageApiKey for user ${userId.substring(0, 8)}`)
      }
    }
    if (config.videoApiKey) {
      try {
        decryptedVideoKey = decryptKey(config.videoApiKey)
      } catch (err) {
        console.warn(`[UserModelConfig] Failed to decrypt videoApiKey for user ${userId.substring(0, 8)}`)
      }
    }

    return {
      provider: config.provider,
      apiKey: decryptedKey,
      imageApiKey: decryptedImageKey,
      videoApiKey: decryptedVideoKey,
      baseUrl: config.baseUrl,
      llmModel: config.llmModel,
      llmEnabled: config.llmEnabled,
      imageModel: config.imageModel,
      imageEnabled: config.imageEnabled,
      videoModel: config.videoModel,
      videoEnabled: config.videoEnabled,
      ttsModel: config.ttsModel,
      ttsEnabled: config.ttsEnabled,
      llmProvider: config.llmProvider,
      imageProvider: config.imageProvider,
      videoProvider: config.videoProvider,
      ttsProvider: config.ttsProvider,
    }
  } catch (err) {
    console.warn(`[UserModelConfig] Query failed for user ${userId?.substring(0, 8)}:`, (err as Error).message)
    return null
  }
}

/**
 * 注入用户模型配置到 RuntimeContext（不再注入 process.env）
 * 在执行模型调用前调用，返回 [配置数据, 恢复函数]
 *
 * @param userId 用户 ID
 * @param modelType 模型类型: 'llm' | 'image' | 'video' | 'tts'
 * @param provider 目标 provider（默认 'aliyun'）
 * @returns [配置数据, 恢复函数]
 */
export async function withUserModelConfig(
  userId: string,
  modelType: 'llm' | 'image' | 'video' | 'tts',
  provider: string = 'aliyun',
): Promise<[UserModelConfigData | null, () => void]> {
  const restore = () => {
    /* noop — AsyncLocalStorage 自动恢复 */
  }

  const config = await getUserModelConfig(userId, provider)
  if (!config) return [null, restore]

  // 检查该模型类型是否被禁用
  const enabledMap: Record<string, boolean> = {
    llm: config.llmEnabled,
    image: config.imageEnabled,
    video: config.videoEnabled,
    tts: config.ttsEnabled,
  }

  if (!enabledMap[modelType]) {
    const labels: Record<string, string> = {
      llm: '语言模型 (LLM)',
      image: '图片模型',
      video: '视频模型',
      tts: '语音模型 (TTS)',
    }
    throw new Error(`您已关闭${labels[modelType]}功能，请在"大模型设置"中开启后再试`)
  }

  const modelKeyMap: Record<string, string> = {
    llm: 'llmModel',
    image: 'imageModel',
    video: 'videoModel',
    tts: 'ttsModel',
  }

  const envModelKey = modelKeyMap[modelType]
  const modelName = (config as any)[envModelKey]

  // 构建 RuntimeContext secrets
  const secrets: Record<string, string> = {}

  // 优先使用专用 Key，没有则用通用 apiKey
  if (modelType === 'image' && config.imageApiKey) {
    secrets[`${provider}ApiKey`] = config.imageApiKey
  } else if (modelType === 'video' && config.videoApiKey) {
    secrets[`${provider}ApiKey`] = config.videoApiKey
  } else if (config.apiKey) {
    secrets[`${provider}ApiKey`] = config.apiKey
  }
  if (config.baseUrl) {
    secrets[`${provider}BaseUrl`] = config.baseUrl
  }
  // 模型名（阿里系才有 per-type 模型覆盖）
  if (provider === 'aliyun' && modelName) {
    const modelFieldMap: Record<string, string> = {
      llm: 'aliyunLlmModel',
      image: 'aliyunImageModel',
      video: 'aliyunVideoModel',
      tts: 'aliyunTtsModel',
    }
    const field = modelFieldMap[modelType]
    if (field) secrets[field] = modelName
  }

  console.log(`[UserModelConfig] 🔧 用户 ${userId.substring(0, 8)} 已注入 ${provider}/${modelType}`)

  // 如果当前已有 RuntimeContext，合并 secrets
  const existingCtx = getRuntimeContext()
  if (existingCtx) {
    Object.assign(existingCtx.secrets, secrets)
    return [config, restore]
  }

  // 否则创建新的 context
  return [config, restore]
}

/**
 * 快捷方式：注入 LLM 配置
 */
export async function withUserLLMConfig(userId: string, provider?: string) {
  return withUserModelConfig(userId, 'llm', provider)
}

/**
 * 快捷方式：注入图片配置
 */
export async function withUserImageConfig(userId: string, provider?: string) {
  return withUserModelConfig(userId, 'image', provider)
}

/**
 * 快捷方式：注入视频配置
 */
export async function withUserVideoConfig(userId: string, provider?: string) {
  return withUserModelConfig(userId, 'video', provider)
}

/**
 * 快捷方式：注入 TTS 配置
 */
export async function withUserTTSConfig(userId: string, provider?: string) {
  return withUserModelConfig(userId, 'tts', provider)
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

