/**
 * Aliyun TTS Adapter — Phase E2
 *
 * Wraps aliyunTTS.synthesize() into the ModelPluginAdapter contract.
 * Human-friendly voice names → aliyun voice IDs translated internally.
 *
 * Uses chain: qwen3-tts-flash (sync, preferred) → cosyvoice-v3.5-plus (async fallback).
 * Both are transparent to the dispatcher.
 */

import type { ModelPluginAdapter, NormalizedRequest, NormalizedResponse, Candidate, Capability } from '../provider-registry/types.js'
import { aliyunTTS } from '../../services/aliyun-tts.provider.js'

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

export class AliyunTTSAdapter implements ModelPluginAdapter {
  readonly provider = 'aliyun'
  readonly capability: Capability = 'tts'

  models(): Candidate[] {
    return [
      {
        provider: 'aliyun',
        model: 'qwen3-tts-flash',
        capability: 'tts',
        cost: 0.12,
        latency: 2000,
        quality: 0.85,
        reliability: 0.9,
      },
      {
        provider: 'aliyun',
        model: 'cosyvoice-v3.5-plus',
        capability: 'tts',
        cost: 0.2,
        latency: 5000,
        quality: 0.9,
        reliability: 0.88,
      },
    ]
  }

  async execute(request: NormalizedRequest, _candidate: Candidate): Promise<NormalizedResponse> {
    const text = request.prompt || (request.params?.text as string) || ''
    const voiceName = (request.params?.voiceId as string) || (request.params?.voice as string) || 'zh_male_deep'
    const speed = Number(request.params?.speed) || 1.0
    const format = (request.params?.format as string) || 'mp3'

    if (!text) {
      throw new Error('[AliyunTTS] No text provided for synthesis')
    }

    console.log(`[AliyunTTS] voice=${voiceName}, textLen=${text.length}, speed=${speed}`)

    const result = await aliyunTTS.synthesize({
      text,
      voice: resolveVoice(voiceName),
      speed,
      gain: 0,
      format,
    })

    return {
      content: result.audioUrl,
      model: 'qwen3-tts-flash',
      latencyMs: result.duration * 1000,
      raw: { duration: result.duration, format: result.format },
    }
  }

  async healthCheck(): Promise<boolean> {
    return !!(process.env.ALIYUN_API_KEY || process.env.ALIYUN_API_KEY)
  }

  label(): string {
    return '阿里云 TTS'
  }
}
