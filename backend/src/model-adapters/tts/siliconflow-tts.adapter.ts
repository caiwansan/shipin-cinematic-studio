/**
 * model-adapters/tts/siliconflow-tts.adapter.ts
 *
 * 硅基流动 TTS 适配器
 *
 * 支持的模型: fishaudio, FunAudioLLM/CosyVoice2, fnlp/MOSS-TTSD 等
 * 端点: POST /v1/audio/speech
 * 格式: OpenAI TTS 兼容 { model, input, voice, response_format }
 *
 * 注意：硅基 TTS 的 voice 参数需要按模型格式传递
 *   - fnlp/MOSS-TTSD-v0.5 → voice: "fnlp/MOSS-TTSD-v0.5:alex"
 *   - FunAudioLLM/CosyVoice2-0.5B → voice: "FunAudioLLM/CosyVoice2-0.5B:benjamin" (或 :david)
 *   - fishaudio/fish-speech-1.5 → voice: "zh_male_deep" (通用预置音色)
 *
 * 前端传递的 voiceId 可能带模型名前缀（如后端 voice design 生成的），也可能用通用标识。
 * 适配器根据最终 model 自动修正 voice 格式，确保兼容。
 */

import { ModelAdapter, ModelAdapterInput, ModelAdapterResult } from '../types.js'

const BASE_URL = 'https://api.siliconflow.cn/v1/audio/speech'

// fishaudio 系列模型的默认音色映射（通用标识 → 硅基兼容格式）
const FISHAUDIO_VOICE_MAP: Record<string, string> = {
  'zh_male_deep': 'zh_male_deep',
  'zh_male_warm': 'zh_male_warm',
  'zh_male_calm': 'zh_male_calm',
  'zh_male_cheerful': 'zh_male_cheerful',
  'zh_male_young': 'zh_male_young',
  'zh_male_authoritative': 'zh_male_authoritative',
  'zh_female_calm': 'zh_female_calm',
  'zh_female_warm': 'zh_female_warm',
  'zh_female_cheerful': 'zh_female_cheerful',
  'zh_female_young': 'zh_female_young',
}

// FunAudioLLM/CosyVoice2 的默认音色（仅男声，女声自动切 fishaudio）
const COSYVOICE_VOICE_MAP: Record<string, string> = {
  'zh_male_deep': 'benjamin',
  'zh_male_warm': 'david',
  'zh_male_calm': 'alex',
  'zh_male_cheerful': 'alex',
  'zh_male_young': 'david',
  'zh_male_authoritative': 'benjamin',
}
const COSYVOICE_VOICES = ['benjamin', 'david', 'alex']

// fnlp/MOSS-TTSD 的默认音色
const MOSS_VOICES = ['alex', 'bob', 'charlie', 'david', 'emma', 'fiona']

function isFishaudioModel(model: string): boolean {
  return model.startsWith('fishaudio')
}

function isCosyVoiceModel(model: string): boolean {
  return model.includes('CosyVoice')
}

function isMossModel(model: string): boolean {
  return model.includes('MOSS-TTSD')
}

/**
 * 根据模型自动修正 voice 参数
 */
function normalizeVoice(model: string, voiceId: string): string {
  // 如果 voice 已经带模型前缀（如 "FunAudioLLM/CosyVoice2-0.5B:benjamin"），检查是否匹配 model
  if (voiceId.includes(':')) {
    const [voiceModel, voiceName] = voiceId.split(':', 2)

    // 前缀模型与当前 model 匹配 → 原样使用
    if (model.includes(voiceModel.replace(/^[^/]+\//, '')) || voiceModel === model) {
      return voiceId
    }

    // 前缀模型不匹配 → 提取 voiceName，根据当前 model 重新组装
    if (isFishaudioModel(model)) {
      // fishaudio 系列只接受通用标识
      return FISHAUDIO_VOICE_MAP[voiceName] || 'zh_male_deep'
    }
    if (isCosyVoiceModel(model)) {
      return `${model}:${voiceName}`
    }
    if (isMossModel(model)) {
      return `${model}:${voiceName}`
    }
    // 未知模型，用 voiceName
    return voiceName || 'zh_male_deep'
  }

  // voice 是通用标识（如 zh_male_deep）
  if (isFishaudioModel(model)) {
    return FISHAUDIO_VOICE_MAP[voiceId] || 'zh_male_deep'
  }
  if (isCosyVoiceModel(model)) {
    // CosyVoice 需要模型名:音色名，按通用标识映射角色名
    const cosyName = COSYVOICE_VOICE_MAP[voiceId]
    if (cosyName) return `${model}:${cosyName}`
    // 无匹配时降级判断：voiceId 以 female 开头用 emma，否则用 benjamin
    const fallback = voiceId.startsWith('zh_female') ? 'emma' : 'benjamin'
    console.warn(`[SiliconTTS] ⚠️ 无 CosyVoice 音色映射，fallback: ${voiceId} → ${fallback}`)
    return `${model}:${fallback}`
  }
  if (isMossModel(model)) {
    return `${model}:${MOSS_VOICES[0]}`
  }

  // 默认原样返回
  return voiceId
}

export const siliconflowTtsAdapter: ModelAdapter = {
  name: 'siliconflow-tts',
  supportedModels: [
    'fishaudio*',
    'fishaudio/fish-speech*',
    'FunAudioLLM/*',
    'FunAudioLLM/CosyVoice2*',
    'fnlp/MOSS-TTSD*',
    'fnlp/MOSS-TTSD-v0.5',
  ],
  taskTypes: ['tts'],
  provider: 'siliconflow',

  async execute(runtime: RuntimePayload, input: ModelAdapterInput): Promise<ModelAdapterResult> {
    const apiKey = runtime.apiKey || ''
    if (!apiKey) throw new Error('硅基流动 API Key 未配置')

    const text = input.text || input.prompt || ''
    const rawVoice = input.voiceId || 'zh_male_deep'
    const format = (input.format || 'mp3') === 'mp3' ? 'mp3' : 'wav'
    let model = input.model || 'fishaudio/fish-speech-1.5'

    // 当模型是 CosyVoice2 且 voice 为女声时，自动切换到 fishaudio（CosyVoice2 无女声支持）
    if (isCosyVoiceModel(model) && rawVoice.startsWith('zh_female')) {
      console.log(`[SiliconTTS] 🔄 CosyVoice2 不支持女声，模型切换 fishaudio: ${model} → fishaudio/fish-speech-1.5, voice=${rawVoice}`)
      model = 'fishaudio/fish-speech-1.5'
    }

    // 根据模型自动修正 voice 格式
    const voice = normalizeVoice(model, rawVoice)

    console.log(`[SiliconTTS] Synthesizing: model=${model}, rawVoice=${rawVoice}, resolvedVoice=${voice}, text="${text.substring(0, 50)}..."`)

    const body: any = {
      model,
      input: text,
      voice,
      response_format: format,
      stream: false,
    }
    if (input.speed) body.speed = input.speed

    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const errText = await res.text()
      // 音色不合法时尝试自动降级到通用音色
      if (res.status === 400 && errText.includes('Invalid voice')) {
        const fallbackVoice = rawVoice.startsWith('zh_female') ? `${model}:emma` : `${model}:benjamin`
        console.warn(`[SiliconTTS] ⚠️ voice=${voice} 不合法，fallback 到 ${fallbackVoice}`)
        body.voice = fallbackVoice
        const retryRes = await fetch(BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(120000),
        })
        if (!retryRes.ok) throw new Error(`硅基 TTS 失败 (${retryRes.status}): ${await retryRes.text()}`)
        const retryBuf = await retryRes.arrayBuffer()
        const retryBase64 = Buffer.from(retryBuf).toString('base64')
        const retryDataUrl = `data:audio/mpeg;base64,${retryBase64}`
        const tempPath = `/tmp/tts_silicon_${Date.now()}.mp3`
        const fs = await import('fs')
        try { fs.writeFileSync(tempPath, Buffer.from(retryBuf)) } catch {}
        return { url: retryDataUrl, duration: Math.round(retryBuf.byteLength / 16000), provider: 'siliconflow' }
      }
      throw new Error(`硅基 TTS 失败 (${res.status}): ${errText}`)
    }

    // 返回的是音频二进制流，转为 base64 data URL 供前端直接使用
    const arrayBuffer = await res.arrayBuffer()
    const ext = format === 'mp3' ? 'mp3' : 'wav'
    const mimeType = format === 'mp3' ? 'audio/mpeg' : 'audio/wav'
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const dataUrl = `data:${mimeType};base64,${base64}`

    // 也写一份到磁盘做持久缓存/调试
    const tempPath = `/tmp/tts_silicon_${Date.now()}.${ext}`
    const fs = await import('fs')
    try { fs.writeFileSync(tempPath, Buffer.from(arrayBuffer)) } catch {}

    // 粗略估算时长：mp3 约 16KB/s, wav 约 256KB/s
    const bytesPerSec = format === 'mp3' ? 16000 : 256000
    const duration = arrayBuffer.byteLength > 0 ? Math.round(arrayBuffer.byteLength / bytesPerSec) : 0

    return {
      url: dataUrl,
      duration,
      provider: 'siliconflow',
    }
  },
}
