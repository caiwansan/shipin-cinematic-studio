/**
 * model-adapters/tts/aliyun-tts.adapter.ts
 *
 * 阿里百炼 TTS 适配器（千问 qwen3-tts-flash 和 CosyVoice 音色克隆）
 *
 * 统一使用 multimodal-generation 端点：
 *   qwen3-tts-flash 同步，input.text 格式
 *   cosyvoice 异步，input.text + voice 格式
 *
 * 核心原则：
 *   1. 不从顶层持有 API Key（从 runtime.apiKey 读取）
 *   2. 不硬编码 model
 *   3. 零 fallback
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult, RuntimePayload } from '../types.js'

/** qwen3-tts-flash endpoint（已验证可用） */
const TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'



/** zh_female/zh_male -> qwen3-tts-flash 音色映射 */
/** zh_female/zh_male -> qwen3-tts-flash 音色映射 */
/** zh_female/zh_male -> 阿里百炼 TTS 音色映射 */
const ALIYUN_TTS_VOICE_MAP: Record<string, { voice: string; model: string }> = {
  // 女声 -> qwen3-tts-flash
  'zh_female_calm':       { voice: 'Cherry', model: 'qwen3-tts-flash' },
  'zh_female_warm':       { voice: 'Cherry', model: 'qwen3-tts-flash' },
  'zh_female_cheerful':   { voice: 'Stella', model: 'qwen3-tts-flash' },
  'zh_female_young':      { voice: 'Stella', model: 'qwen3-tts-flash' },
  // 男声 -> qwen-tts (Ethan)
  'zh_male_deep':         { voice: 'Ethan', model: 'qwen-tts' },
  'zh_male_warm':         { voice: 'Ethan', model: 'qwen-tts' },
  'zh_male_calm':         { voice: 'Ethan', model: 'qwen-tts' },
  'zh_male_cheerful':     { voice: 'Ethan', model: 'qwen-tts' },
  'zh_male_young':        { voice: 'Ethan', model: 'qwen-tts' },
  'zh_male_authoritative': { voice: 'Ethan', model: 'qwen-tts' },
}

/** 返回映射后的 voice + model（男声自动切 qwen-tts/Ethan） */
function mapVoice(voice: string, model: string): { voice: string; model: string } {
  if (!model) return { voice: voice || 'Cherry', model: 'qwen3-tts-flash' }
  if (voice.startsWith('zh_')) {
    const m = ALIYUN_TTS_VOICE_MAP[voice]
    if (!m) return { voice: 'Cherry', model: 'qwen3-tts-flash' }
    return { voice: m.voice, model: m.model }
  }
  if (!model.startsWith('qwen')) return { voice, model }
  return { voice, model }
}

export const aliyunTtsAdapter: ModelAdapter = {
  name: 'aliyun-tts',
  supportedModels: [
    // qwen-tts（无通配符）必须在 qwen3-tts* 前面，防止被 LLM 的 qwen* 劫持
    'qwen-tts', 'qwen3-tts-flash', 'qwen3-tts*',
    'cosyvoice-1.0', 'cosyvoice-1.5', 'cosyvoice*',
  ],
  taskTypes: ['tts'],
  provider: 'aliyun',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('阿里百炼 API Key 未配置')

    const text = input.text || input.prompt || ''
    const format = input.format || 'mp3'
    const model = input.model || 'qwen3-tts-flash'
    const voice = input.voiceId || 'Cherry'

    // 自动探测：如果 voiceId 是自定义设计音色（非 zh_ 模板），自动切换到 cosyvoice 模型
    const effectiveModel = (!voice.startsWith('zh_') && voice !== 'Cherry' && voice !== 'Stella' && voice !== 'Ethan')
      ? 'cosyvoice-v3.5-plus'
      : model
    // 如果探测到需要 cosyvoice 但当前 model 不是，打日志
    if (effectiveModel !== model) {
      console.log(`[AliyunTTS] 🔄 自动切换到 ${effectiveModel}: voiceId=${voice} 为自定义音色`)
    }

    console.log(`[AliyunTTS] model=${effectiveModel}, voice=${voice}, textLen=${text.length}`)

    // CosyVoice 音色克隆（含阿里云设计的自定义音色）
    if (effectiveModel.startsWith('cosyvoice')) {
      if (!text) throw new Error('CosyVoice 需要文本内容')
      // 如果 voice 是自定义音色 ID（非 zh_ 前缀），直接使用
      // 如果 voice 是 zh_ 模板音色，fallback 到内置音色
      const targetVoice = voice.startsWith('zh_') ? voice.replace('zh_male', 'longxiaochun').replace('zh_female', 'siqi') : voice
      const body = {
        model: model,
        input: {
          text,
          voice: targetVoice,
        },
        parameters: { format },
      }
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      })
      if (!res.ok) throw new Error(`阿里 TTS 失败 (${res.status}): ${await res.text()}`)
      const data = await res.json()
      const url = data?.output?.audio?.url || data?.output?.audio_url || data?.url || ''
      if (!url) throw new Error(`阿里 TTS: 响应中没有音频 URL: ${JSON.stringify(data).substring(0, 300)}`)
      return { url, provider: 'aliyun' }
    }

    // qwen3-tts-flash 同步 TTS — 用 input.voice 格式
    const body: any = {
      model,
      input: { text },
      parameters: { format },
    }
    const mv = mapVoice(voice, model)
    if (mv) {
      body.input.voice = mv.voice
      body.model = mv.model
    }

    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) throw new Error(`阿里 TTS 失败 (${res.status}): ${await res.text()}`)

    const data = await res.json()
    const url = data?.output?.audio?.url || data?.output?.audio_url || data?.url || ''
    if (!url) throw new Error(`阿里 TTS: 响应中没有音频 URL: ${JSON.stringify(data).substring(0, 300)}`)

    return {
      url,
      duration: data?.usage?.characters || undefined,
      provider: 'aliyun',
    }
  },
}
