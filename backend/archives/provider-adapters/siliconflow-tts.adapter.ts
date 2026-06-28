/**
 * SiliconFlow TTS Adapter — Phase E2
 *
 * Wraps siliconflowTTS.synthesize() into the ModelPluginAdapter contract.
 * Human-friendly voice names → provider-specific voice IDs translated internally.
 */

import type { ModelPluginAdapter, NormalizedRequest, NormalizedResponse, Candidate, Capability } from '../provider-registry/types.js'
import { siliconflowTTS } from '../../services/siliconflow-tts.provider.js'

// ─── Voice Normalization ────────────────────────────

const PRESET_VOICES: Record<string, string> = {
  'zh_male_deep': 'zh_male_deep',
  'zh_male_warm': 'zh_male_warm',
  'zh_male_calm': 'zh_male_calm',
  'zh_male_cheerful': 'zh_male_cheerful',
  'zh_female_calm': 'zh_female_calm',
  'zh_female_passion': 'zh_female_passion',
  'zh_female_gentle': 'zh_female_gentle',
  'zh_female_cheerful': 'zh_female_cheerful',
}

function resolveVoice(voiceName: string): string {
  return PRESET_VOICES[voiceName] || voiceName
}

// ─── Adapter ────────────────────────────────────────

export class SiliconflowTTSAdapter implements ModelPluginAdapter {
  readonly provider = 'siliconflow'
  readonly capability: Capability = 'tts'

  models(): Candidate[] {
    return [
      {
        provider: 'siliconflow',
        model: 'FunAudioLLM/CosyVoice2-0.5B',
        capability: 'tts',
        cost: 0.15,
        latency: 1500,
        quality: 0.8,
        reliability: 0.85,
      },
    ]
  }

  async execute(request: NormalizedRequest, _candidate: Candidate): Promise<NormalizedResponse> {
    const text = request.prompt || (request.params?.text as string) || ''
    const voiceName = (request.params?.voiceId as string) || (request.params?.voice as string) || 'zh_male_deep'
    const speed = Number(request.params?.speed) || 1.0
    const format = (request.params?.format as string) || 'mp3'

    if (!text) {
      throw new Error('[SiliconflowTTS] No text provided for synthesis')
    }

    console.log(`[SiliconflowTTS] voice=${voiceName}, textLen=${text.length}, speed=${speed}`)

    const result = await siliconflowTTS.synthesize({
      text,
      voice: resolveVoice(voiceName),
      speed,
      gain: 0,
      format,
    })

    return {
      content: result.audioUrl,
      model: 'FunAudioLLM/CosyVoice2-0.5B',
      latencyMs: result.duration * 1000,
      raw: { duration: result.duration, format: result.format },
    }
  }

  async healthCheck(): Promise<boolean> {
    return !!process.env.SILICONFLOW_API_KEY
  }

  label(): string {
    return '硅基流动 TTS'
  }
}
