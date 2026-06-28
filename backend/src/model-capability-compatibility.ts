/**
 * model-capability-compatibility.ts — 模型-能力兼容性检查层
 *
 * 用户配置 model × capability 时，系统必须验证兼容性。
 * 不允许模型被用于它不支持的 capability。
 *
 * 原则：
 *   1. 用户选的模型必须属于目标 capability
 *   2. 兼容性矩阵是系统定义的（不可变）
 *   3. 零 fallback：不兼容就报错
 */

import { Capability, modelBelongsToCapability } from './capability-registry.js'

/**
 * 模型到 capability 的映射规则
 * 这些是系统级规则：一个模型能做什么事是确定的
 */
const MODEL_CAPABILITY_RULES: Record<string, Capability[]> = {
  // ===== 图片生成 =====
  'wan2.7-image-pro': ['image-generation'],
  'wan2.7-image': ['image-generation'],
  'wan2.6-image': ['image-generation'],
  'wan2.5-t2i': ['image-generation'],
  'wan2.5-t2i-preview': ['image-generation'],
  'wan2.2-t2i-plus': ['image-generation'],
  'wan2.2-t2i-flash': ['image-generation'],
  'wanx2.1-t2i-plus': ['image-generation'],
  'wanx2.1-t2i-turbo': ['image-generation'],
  'doubao-seedream-5-1-260516': ['image-generation'],
  'doubao-seedream-5-2-260520': ['image-generation'],
  'doubao-seedream-5-0-260128': ['image-generation'],
  'doubao-seedream-4-5-251128': ['image-generation'],
  'doubao-seedream-3-0-250102': ['image-generation'],
  'qwen-image-max': ['image-generation'],
  'qwen-image-plus': ['image-generation'],
  'qwen-image-2.0-pro': ['image-generation'],
  'qwen-image-2.0': ['image-generation'],
  'dall-e-3': ['image-generation'],
  'dall-e-2': ['image-generation'],
  'stable-diffusion-3.5-large': ['image-generation'],
  'stable-diffusion-3.5-large-turbo': ['image-generation'],
  'flux-1.1-pro': ['image-generation'],

  // ===== 视频生成 =====
  'wan2.7-i2v': ['video-generation'],
  'wan2.7-t2v': ['video-generation'],
  'wan2.7-r2v': ['video-generation'],
  'wan2.7-videoedit': ['video-generation'],
  'wan2.6-i2v': ['video-generation'],
  'wan2.6-t2v': ['video-generation'],
  'wan2.6-r2v': ['video-generation'],
  'wan2.5-i2v': ['video-generation'],
  'wan2.5-t2v': ['video-generation'],
  'wan2.2-i2v': ['video-generation'],
  'wan2.2-t2v': ['video-generation'],
  'doubao-seedance-1-5-pro-251215': ['video-generation'],
  'doubao-seedance-1-0-pro-fast-251015': ['video-generation'],

  // ===== LLM 文本 =====
  'doubao-seed-2-0-plus-260428': ['llm-text'],
  'doubao-seed-2-0-mini-260428': ['llm-text'],
  'doubao-seed-2-1-turbo-260628': ['llm-text'],
  'doubao-seed-2-1-pro-260628': ['llm-text'],
  'doubao-seed-evolving': ['llm-text'],

  'qwen-plus': ['llm-text'],
  'qwen-max': ['llm-text'],
  'qwen-turbo': ['llm-text'],
  'qwen2.5-72b-instruct': ['llm-text'],
  'qwen2.5-32b-instruct': ['llm-text'],
  'qwen2.5-14b-instruct': ['llm-text'],
  'deepseek-chat': ['llm-text'],
  'deepseek-r1': ['llm-text'],
  'gemini-2.0-flash': ['llm-text'],
  'gemini-2.5-pro': ['llm-text'],

  // ===== TTS =====
  'qwen3-tts-flash': ['tts-speech'],
  'cosyvoice-v1': ['tts-speech'],
  'siliconflow-tts': ['tts-speech'],
}

/**
 * 前缀匹配规则型号
 * 匹配结果 = 所有匹配的前缀对应的 capability 集合
 */
const PREFIX_RULES: [string, Capability[]][] = [
  // wan 系列：以 task 区分，非 model name 区分
  // image 类
  ['wan2.7-image', ['image-generation']],
  ['wan2.6-image', ['image-generation']],
  ['wan2.5-t2i', ['image-generation']],
  ['wan2.2-t2i', ['image-generation']],
  ['wanx2.1-t2i', ['image-generation']],
  // video 类
  ['wan2.7-video', ['video-generation']],
  ['wan2.6-video', ['video-generation']],
  ['wan2.5', ['video-generation']],
  ['wan2.2', ['video-generation']],
  ['wanx2.1', ['video-generation']],
  ['happyhorse', ['video-generation']],
  // LLM 类
  ['qwen2.5', ['llm-text']],
  ['qwen2', ['llm-text']],
  ['deepseek', ['llm-text']],
  ['gemini', ['llm-text']],
  // 火山豆包 系列
  ['doubao-seedream', ['image-generation']],
  ['doubao-seedance', ['video-generation']],
  ['doubao-seed-2', ['llm-text']],
  ['doubao-seed-evolving', ['llm-text']],
  // 硅基流动 系列
  ['stabilityai', ['image-generation']],
  ['black-forest-labs', ['image-generation']],
  ['Pro/', ['llm-text']],
  // TTS
  ['cosyvoice', ['tts-speech']],
  ['siliconflow-tts', ['tts-speech']],
]

/**
 * 检查模型是否支持指定的 capability
 * 零 fallback：不兼容直接抛错
 */
export function assertModelCapability(
  model: string,
  capability: Capability
): void {
  // 1. 精确匹配
  const exactCaps = MODEL_CAPABILITY_RULES[model]
  if (exactCaps) {
    if (exactCaps.includes(capability)) return
    throw new Error(`模型 "${model}" 不支持 ${capability}（仅支持: ${exactCaps.join(', ')}）`)
  }

  // 2. 前缀匹配
  for (const [prefix, caps] of PREFIX_RULES) {
    if (model.startsWith(prefix)) {
      if (caps.includes(capability)) return
      throw new Error(`模型 "${model}"（匹配前缀 "${prefix}"）不支持 ${capability}`)
    }
  }

  // 3. 兜底：用 capability-registry 的通用匹配
  if (modelBelongsToCapability(model, capability)) return

  throw new Error(`模型 "${model}" 未知或不属于 capability "${capability}"，请检查模型名是否正确`)
}

/**
 * 获取模型支持的所有 capability
 */
export function getModelCapabilities(model: string): Capability[] {
  const exact = MODEL_CAPABILITY_RULES[model]
  if (exact) return [...exact]

  for (const [prefix, caps] of PREFIX_RULES) {
    if (model.startsWith(prefix)) return [...caps]
  }

  return []
}
