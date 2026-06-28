/**
 * runtime-provider-resolver.ts — Runtime Provider 解析器
 *
 * Router 只产出 (capability, model)，由本模块在运行时根据用户配置
 * 找到对应的 provider + apiKey + endpoint。
 *
 * 核心原则：
 *   - 用户配了什么 provider/Key/模型就用什么
 *   - model 与 provider 是运行时绑定，不是编译时固定
 *   - 零 fallback 零兜底（用户没配就报错）
 *   - 兼容性检查：模型必须支持目标 capability
 */

import { prisma } from './utils/index.js'
import { decryptKey } from './services/crypto.service.js'
import { assertModelCapability } from './model-capability-compatibility.js'

export interface ResolvedProvider {
  provider: string
  apiKey: string
  model: string
  baseURL: string
  taskType: string
  userId: string
}

/**
 * 根据用户配置的 V2 config，将 (model, taskType) 解析为可执行的 provider 绑定
 *
 * 规则：
 *   1. 模型名匹配 → 用匹配到的 provider 的 Key
 *   2. 同名 provider（如 volcengine）下，image/video/tts 各有自己的 Key 和模型
 *   3. 零 fallback：没配就抛错
 */
export async function resolveProviderFromUserConfig(
  userId: string,
  model: string,
  taskType: string
): Promise<ResolvedProvider> {
  const v2 = await prisma.userModelConfigV2.findUnique({
    where: { userId },
  })

  if (!v2) {
    throw new Error(`用户 ${userId.substring(0, 8)} 未配置大模型，请先在大模型设置中配置 API Key`)
  }

  // 根据 taskType 确定用哪个配置字段
  let provider = ''
  let modelName = ''
  let apiKey = ''
  let baseURL = v2.baseUrl || ''

  // 优先用 userConfig 中与 model name 匹配的 provider
  // 遍历所有类型，找到包含此模型的配置
  const typeConfigs: { prov: string | null; key: string | null; mdl: string | null; type: string }[] = [
    { prov: v2.imageProvider, key: v2.imageApiKey, mdl: v2.imageModel, type: 'image' },
    { prov: v2.videoProvider, key: v2.videoApiKey, mdl: v2.videoModel, type: 'video' },
    { prov: v2.ttsProvider,   key: v2.ttsApiKey,   mdl: v2.ttsModel,   type: 'tts' },
  ]

  // 按 taskType 优先搜索对应的类型
  const typeIndex = taskType === 'frame' ? 0 : taskType === 'image' ? 0 : taskType === 'video' ? 1 : 2
  // frame 等价于 image 类型

  // 核心修复：如果前端没传 model 名，直接用用户配置中对应类型的模型名
  // 先尝试精确匹配 model
  let matched = false

  if (model) {
    for (const cfg of typeConfigs) {
      if (!cfg.prov || !cfg.mdl || !cfg.key) continue

      const matches = cfg.mdl.endsWith('*')
        ? model.startsWith(cfg.mdl.slice(0, -1))
        : cfg.mdl === model

      if (matches) {
        let decrypted: string | null = null
        try {
          decrypted = decryptKey(cfg.key)
        } catch (e) {
          throw new Error(`加密数据无法解密（加密密钥可能已变更），请重新保存 ${cfg.prov} 的 API Key`)
        }
        if (!decrypted) throw new Error(`无法解密 ${cfg.prov} 的 API Key`)

        provider = cfg.prov
        apiKey = decrypted
        modelName = cfg.mdl
        matched = true
        break
      }
    }
  }

  // 如果没匹配到精确 model，用 taskType 对应用户配置的默认模型
  if (!matched) {
    const defaultCfg = typeConfigs[typeIndex]

    // 如果本类型没配 Key，尝试从相同 provider 的其他类型复用 Key
    let actualKey = defaultCfg.key
    if (!defaultCfg.prov || !actualKey || !defaultCfg.mdl) {
      // 查找同一个 provider 的其他能力是否有 Key
      for (const other of typeConfigs) {
        if (other.type === typeConfigs[typeIndex].type) continue
        if (other.prov === defaultCfg.prov && other.key && other.prov) {
          actualKey = other.key
          break
        }
      }
    }

    if (!defaultCfg.prov || !actualKey || !defaultCfg.mdl) {
      throw new Error(
        taskType === 'frame' || taskType === 'image'
          ? `首尾帧/图片生成需要配置图片（Image）的 API Key 和模型，请先在大模型设置中配置`
          : taskType === 'video'
            ? `视频生成需要配置视频（Video）的 API Key 和模型，请先在大模型设置中配置`
            : `TTS 语音需要配置 TTS 的 API Key 和模型，请先在大模型设置中配置`
      )
    }

    let decrypted: string | null = null
    try {
      decrypted = decryptKey(actualKey)
    } catch (e) {
      throw new Error(`加密数据无法解密（加密密钥可能已变更），请重新保存 ${defaultCfg.prov} 的 API Key`)
    }
    if (!decrypted) throw new Error(`无法解密 ${defaultCfg.prov} 的 API Key`)

    provider = defaultCfg.prov
    apiKey = decrypted
    modelName = defaultCfg.mdl
    matched = true
    console.log(`[ProviderResolver] 🎯 使用默认模型 ${modelName} (${defaultCfg.prov}) 处理 ${taskType}`)
  }

  // 零 fallback：没找到就抛错
  if (!provider || !apiKey) {
    throw new Error(
      taskType === 'frame'
        ? `首尾帧生成需要配置图片生成的 API Key 和模型。当前用户没有配置匹配模型 "${model}" 的图片 Key`
        : `未找到匹配模型 "${model}" 的配置。请检查大模型设置中 ${taskType} 类型的 API Key 和模型名`
    )
  }

  return {
    provider,
    apiKey,
    model: modelName,
    baseURL,
    taskType,
    userId,
  }
}

/**
 * 根据 taskType 找到对应的 capability 名称
 */
export function taskTypeToCapability(taskType: string): string {
  switch (taskType) {
    case 'frame':
    case 'image':
      return 'image-generation'
    case 'video':
      return 'video-generation'
    case 'tts':
      return 'tts-speech'
    case 'llm':
    case 'narrative':
    case 'shooting-plan':
      return 'llm-text'
    default:
      return 'image-generation' // 默认 fallback（不应走到这里）
  }
}
