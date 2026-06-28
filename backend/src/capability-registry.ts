/**
 * capability-registry.ts — 能力注册表
 *
 * 定义系统所有 AI capability 及对应的 model 列表（provider 无关）。
 * 这是从 "模型中心" 迁移到 "能力中心" 的核心文件。
 *
 * 正确用法：
 *   capability → models[] → (model + user provider) → provider resolver → adapter execution
 *   ↑ Router 只做这个     ↑ user config 决定         ↑ runtime resolve    ↑ 纯执行
 */

/**
 * 系统支持的所有 AI Capability
 */
export type Capability =
  | 'llm-text'
  | 'image-generation'
  | 'video-generation'
  | 'tts-speech'

/**
 * 能力注册表中的模型条目（provider 无关）
 */
export interface CapabilityModelEntry {
  /** 模型名（唯一标识） */
  model: string
  /** 模型所属的 provider family（用于 provider 选择时的匹配提示） */
  family?: string
}

/**
 * 能力注册表
 * capability → 可用模型列表
 */
const CAPABILITY_REGISTRY: Record<Capability, CapabilityModelEntry[]> = {
  'llm-text': [
    // 阿里百炼
    { model: 'qwen-plus', family: 'aliyun' },
    { model: 'qwen-max', family: 'aliyun' },
    { model: 'qwen-turbo', family: 'aliyun' },
    { model: 'qwen2.5-*', family: 'aliyun' },
    // 火山引擎
    { model: 'doubao-seed-2-0-plus-260428', family: 'volcengine' },
    { model: 'doubao-seed-2-0-mini-260428', family: 'volcengine' },
    { model: 'doubao-seed-2-1-turbo-260628', family: 'volcengine' },
    { model: 'doubao-seed-2-1-pro-260628', family: 'volcengine' },
    { model: 'doubao-seed-evolving', family: 'volcengine' },
    { model: 'doubao*', family: 'volcengine' },
    { model: 'deepseek*', family: 'volcengine' },
    // 硅基流动
    { model: 'Qwen*', family: 'siliconflow' },
    { model: 'deepseek*', family: 'siliconflow' },
    { model: 'Pro*', family: 'siliconflow' },
    // DeepSeek
    { model: 'deepseek-chat', family: 'deepseek' },
    // Google Gemini
    { model: 'gemini*', family: 'google' },
  ],

  'image-generation': [
    // wan 系列（可在 aliyun 或 volcengine 运行）
    { model: 'wan2.7-image-pro', family: 'aliyun' },
    { model: 'wan2.7-image', family: 'aliyun' },
    { model: 'wan2.6-image', family: 'aliyun' },
    { model: 'wan2.5-t2i', family: 'aliyun' },
    { model: 'wan*', family: 'aliyun' },
    // 千问图片
    { model: 'qwen-image-max', family: 'aliyun' },
    { model: 'qwen-image-plus', family: 'aliyun' },
    { model: 'qwen-image*', family: 'aliyun' },
    // 火山 Seedream
    { model: 'doubao-seedream-4-5-251128', family: 'volcengine' },
    { model: 'doubao*', family: 'volcengine' },
    { model: 'seedream*', family: 'volcengine' },
    // 硅基流动
    { model: 'stabilityai*', family: 'siliconflow' },
    { model: 'black-forest-labs*', family: 'siliconflow' },
    // OpenAI DALL-E
    { model: 'dall-e-3', family: 'openai' },
    { model: 'dall-e-2', family: 'openai' },
    // Google Gemini
    { model: 'gemini*', family: 'google' },
  ],

  'video-generation': [
    // wan 视频（阿里百炼）
    { model: 'wan2.7-i2v', family: 'aliyun' },
    { model: 'wan2.7-t2v', family: 'aliyun' },
    { model: 'wan2.7-r2v', family: 'aliyun' },
    { model: 'wan2.6-i2v', family: 'aliyun' },
    { model: 'wan2.6-t2v', family: 'aliyun' },
    { model: 'wan*', family: 'aliyun' },
    // 火山引擎豆包视频
    { model: 'doubao-seedance-1-5-pro-251215', family: 'volcengine' },
    { model: 'doubao-seedance-1-0-pro-fast-251015', family: 'volcengine' },
    { model: 'doubao*', family: 'volcengine' },
    { model: 'seedance*', family: 'volcengine' },
    // Google Gemini
    { model: 'gemini*', family: 'google' },
  ],

  'tts-speech': [
    { model: 'qwen3-tts-flash', family: 'aliyun' },
    { model: 'cosyvoice*', family: 'aliyun' },
    { model: 'siliconflow-tts', family: 'siliconflow' },
    { model: 'cosyvoice-v1', family: 'volcengine' },
    { model: 'doubao*', family: 'volcengine' },
  ],
}

// ========== API ==========

/**
 * 根据 capability 获取可用模型列表
 */
export function getModelsForCapability(capability: Capability): CapabilityModelEntry[] {
  return CAPABILITY_REGISTRY[capability] || []
}

/**
 * 注册一个新的 capability 模型条目（运行时插件用）
 */
export function registerCapabilityModel(
  capability: Capability,
  entry: CapabilityModelEntry
): void {
  CAPABILITY_REGISTRY[capability] = CAPABILITY_REGISTRY[capability] || []
  CAPABILITY_REGISTRY[capability].push(entry)
}

/**
 * 根据模型名查找所属的 capability
 */
export function findCapabilityByModel(model: string): Capability | undefined {
  for (const [cap, entries] of Object.entries(CAPABILITY_REGISTRY)) {
    for (const entry of entries) {
      const pat = entry.model
      if ((pat.endsWith('*') && model.startsWith(pat.slice(0, -1))) || pat === model) {
        return cap as Capability
      }
    }
  }
  return undefined
}

/**
 * 判断某个 model 是否属于某个 capability
 */
export function modelBelongsToCapability(model: string, capability: Capability): boolean {
  const entries = CAPABILITY_REGISTRY[capability]
  if (!entries) return false
  return entries.some((entry) => {
    const pat = entry.model
    return pat.endsWith('*') ? model.startsWith(pat.slice(0, -1)) : pat === model
  })
}
