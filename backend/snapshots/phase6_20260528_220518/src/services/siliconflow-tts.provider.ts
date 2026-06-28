/**
 * SiliconFlow TTS Provider — 硅基流动语音合成
 *
 * API: POST https://api.siliconflow.cn/v1/audio/speech
 * 文档: https://docs.siliconflow.cn/capabilities/text-to-speech
 */

interface TTSRequest {
  text: string
  voice?: string
  speed?: number
  gain?: number
  format?: string
  model?: string
}

interface TTSResult {
  audioUrl: string    // data: URL
  duration: number
  format: string
}

const BASE_URL = 'https://api.siliconflow.cn/v1'
// 支持的模式列表
const MODELS = [
  'FunAudioLLM/CosyVoice2-0.5B',
  'fishaudio/fish-speech-1.5',
]

// 系统预置音色（在 voice 参数中拼接模型名:音色名）
// 音色列表参考 CosyVoice2 支持的音色：benjamin, charles, alex, david, anna, bella, claire, diana
const PRESET_VOICES: Record<string, string> = {
  'zh_male_deep': 'FunAudioLLM/CosyVoice2-0.5B:benjamin',          // 低沉男声
  'zh_male_warm': 'FunAudioLLM/CosyVoice2-0.5B:charles',           // 磁性男声
  'zh_male_calm': 'FunAudioLLM/CosyVoice2-0.5B:alex',              // 沉稳男声
  'zh_male_cheerful': 'FunAudioLLM/CosyVoice2-0.5B:david',         // 欢快男声
  'zh_male_young': 'FunAudioLLM/CosyVoice2-0.5B:charles',          // 年轻男声 → 映射到 charles
  'zh_male_authoritative': 'FunAudioLLM/CosyVoice2-0.5B:benjamin', // 权威男声 → 映射到 benjamin
  'zh_female_calm': 'FunAudioLLM/CosyVoice2-0.5B:anna',            // 沉稳女声
  'zh_female_warm': 'FunAudioLLM/CosyVoice2-0.5B:claire',          // 温柔女声
  'zh_female_cheerful': 'FunAudioLLM/CosyVoice2-0.5B:diana',       // 活泼女声
  'zh_female_young': 'FunAudioLLM/CosyVoice2-0.5B:bella',          // 年轻女声 → 映射到 bella
  'zh_female_passion': 'FunAudioLLM/CosyVoice2-0.5B:bella',        // 激情女声
  'zh_female_gentle': 'FunAudioLLM/CosyVoice2-0.5B:claire',        // 温柔女声（兼容旧名）
}

// 获取硅基流动 API Key
// Phase 1-D: 优先从 process.env 读取（由 modelAdapterRegistry.execute 在调用前注入）
// 回退到 RuntimeContext（ALS，兼容旧流程）
function getApiKey(): string {
  // Phase 1-D: process.env 优先（由 modelAdapterRegistry.execute 在调用前注入）
  if (process.env.SILICONFLOW_API_KEY) return process.env.SILICONFLOW_API_KEY

  // 回退: RuntimeContext（ALS，兼容旧流程）
  try {
    const { getRuntimeContext } = require('./runtime-context.js')
    const ctx = getRuntimeContext()
    if ((ctx as any)?.secrets?.siliconflowApiKey) return (ctx as any).secrets.siliconflowApiKey as string
  } catch {}
  return ''
}

export const siliconflowTTS = {
  async synthesize(params: TTSRequest): Promise<TTSResult> {
    const apiKey = getApiKey()
    if (!apiKey) {
      throw new Error('SILICONFLOW_API_KEY 未配置')
    }

    // 使用传入的 model，默认 CosyVoice2
    const model = params.model || 'FunAudioLLM/CosyVoice2-0.5B'
    const voice = params.voice
      ? (PRESET_VOICES as Record<string, string>)[params.voice] || `${model}:benjamin`
      : `${model}:benjamin`  // 默认低沉男声

    const speed = params.speed ?? 1.0
    const gain = params.gain ?? 0.0
    const responseFormat = params.format || 'mp3'

    console.log(`[SiliconTTS] Synthesizing: voice=${voice}, text="${params.text.substring(0, 30)}..."`)

    const response = await fetch(`${BASE_URL}/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: params.text,
        voice,
        speed,
        gain,
        response_format: responseFormat,
        // mp3 要求 32000Hz 或 44100Hz
        sample_rate: responseFormat === 'mp3' ? 32000 : 24000,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`SiliconTTS failed (${response.status}): ${errText.slice(0, 200)}`)
    }

    // 返回的是二进制音频流
    const contentType = response.headers.get('content-type') || ''
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')

    // 估算时长（按中文平均 3.5 字/秒）
    const estimatedDuration = Math.max(2, Math.ceil(params.text.length / 3.5))

    return {
      audioUrl: `data:${contentType || 'audio/mpeg'};base64,${base64}`,
      duration: estimatedDuration,
      format: responseFormat,
    }
  },

  /** 获取可用音色列表 */
  getVoices() {
    return Object.entries(PRESET_VOICES).map(([key, value]) => ({
      id: key,
      name: value,
      description: {
        'zh_male_deep': '低沉男声',
        'zh_male_warm': '磁性男声',
        'zh_male_calm': '沉稳男声',
        'zh_male_cheerful': '欢快男声',
        'zh_female_calm': '沉稳女声',
        'zh_female_passion': '激情女声',
        'zh_female_gentle': '温柔女声',
        'zh_female_cheerful': '欢快女声',
      }[key] || key,
    }))
  },
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};

