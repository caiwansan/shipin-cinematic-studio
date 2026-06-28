/**
 * Aliyun TTS Provider — 阿里百炼 TTS 语音合成
 * 
 * 使用用户的 BYOK API Key 调用阿里百炼 multimodal-generation 端点
 * 支持 qwen-tts / qwen3-tts-flash / cosyvoice-v3.5-plus
 */
import type { AudioChunk, VoiceProvider, AudioSegment } from './provider'

const TTS_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'

/** 内置音色名字映射 */
const VOICE_NAME_MAP: Record<string, string> = {
  'zh_female_calm': 'Cherry',
  'zh_female_warm': 'Cherry',
  'zh_female_cheerful': 'Stella',
  'zh_female_young': 'Stella',
  'zh_male_deep': 'Ethan',
  'zh_male_warm': 'Ethan',
  'zh_male_calm': 'Ethan',
  'zh_male_cheerful': 'Ethan',
  'zh_male_young': 'Ethan',
  'zh_male_authoritative': 'Ethan',
}

export class AliyunTtsProvider implements VoiceProvider {
  readonly name = 'aliyun'

  constructor(
    private apiKey: string,
    private defaultVoice: string = 'Cherry',
    private defaultModel: string = 'qwen-tts',
  ) {}

  setApiKey(key: string) {
    this.apiKey = key
  }

  async synthesize(segment: AudioSegment): Promise<AudioChunk> {
    if (!this.apiKey) {
      throw new Error(`[AliyunTts] API Key 未配置`)
    }

    // narrator 映射为默认旁白音色
    const rawVoice = segment.speaker || this.defaultVoice
    const voice = rawVoice === 'narrator' || rawVoice === 'default' ? this.defaultVoice : rawVoice
    const model = this.detectModel(voice, this.defaultModel)
    const mappedVoice = VOICE_NAME_MAP[voice] || voice

    console.log(`[AliyunTts] model=${model} voice=${mappedVoice} textLen=${segment.text.length}`)

    const body: any = {
      model,
      input: { text: segment.text },
      parameters: { format: 'mp3' },
    }

    if (model.startsWith('cosyvoice') || mappedVoice) {
      body.input.voice = mappedVoice
    }

    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`[AliyunTts] HTTP ${res.status}: ${errText.substring(0, 200)}`)
    }

    const data = await res.json()
    const audioUrl = data?.output?.audio?.url || data?.output?.audio_url || data?.url || ''
    if (!audioUrl) {
      throw new Error(`[AliyunTts] 响应中没有音频 URL: ${JSON.stringify(data).substring(0, 200)}`)
    }

    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      throw new Error(`[AliyunTts] 音频下载失败: ${audioRes.status}`)
    }

    const buffer = Buffer.from(await audioRes.arrayBuffer())
    const duration = this.estimateDuration(segment.text)

    return { segmentId: segment.id, buffer, duration }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey
  }

  private detectModel(voice: string, defaultModel: string): string {
    // 短剧音色（lingxi, longwan, longxia 等自定义音色名）→ cosyvoice-v3.5-plus
    if (!voice.startsWith('zh_') && !['Cherry', 'Stella', 'Ethan', 'narrator'].includes(voice)) {
      return 'cosyvoice-v3.5-plus'
    }
    // narrator 映射为 lingxi + cosyvoice 模式
    if (voice === 'narrator' || voice === 'default') {
      return 'cosyvoice-v3.5-plus'
    }
    return defaultModel
  }

  async setDefaultVoice(voice: string): Promise<void> {
    this.defaultVoice = voice
  }

  private estimateDuration(text: string): number {
    return Math.round(text.length * 0.05 * 100) / 100
  }
}
