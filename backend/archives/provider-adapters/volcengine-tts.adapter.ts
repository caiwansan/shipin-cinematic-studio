/**
 * Volcengine TTS Adapter — Phase E2
 *
 * Wraps volcengineTTS.synthesize() into the ModelPluginAdapter contract.
 *
 * Note: volcengine TTS is currently routed through the Phase 1A wrapper
 * (bindVolcengineTTSMethods). Future migration: adapter takes over directly.
 */

import type { ModelPluginAdapter, NormalizedRequest, NormalizedResponse, Candidate, Capability } from '../provider-registry/types.js'
import { bindVolcengineTTSMethods } from '../provider-wrapper/volcengine/volcengine-method-bindings.js'

const volcengineTTS = { synthesize: bindVolcengineTTSMethods.synthesize }

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
  'zh_male_elder': 'zh_male_elder',
  'zh_female_elder': 'zh_female_elder',
  'zh_male_narration': 'zh_male_narration',
  'zh_female_narration': 'zh_female_narration',
}

function resolveVoice(voiceName: string): string {
  return PRESET_VOICES[voiceName] || voiceName
}

// ─── Adapter ────────────────────────────────────────

export class VolcengineTTSAdapter implements ModelPluginAdapter {
  readonly provider = 'volcengine'
  readonly capability: Capability = 'tts'

  models(): Candidate[] {
    return [
      {
        provider: 'volcengine',
        model: 'volcengine-tts-v1',
        capability: 'tts',
        cost: 0.1,
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

    if (!text) {
      throw new Error('[VolcengineTTS] No text provided for synthesis')
    }

    console.log(`[VolcengineTTS] voice=${voiceName}, textLen=${text.length}, speed=${speed}`)

    const result = await volcengineTTS.synthesize({
      text,
      voiceId: resolveVoice(voiceName),
      speed,
      pitch: 1.0,
      emotion: 'neutral',
    })

    return {
      content: result.audioUrl,
      model: 'volcengine-tts-v1',
      latencyMs: result.duration * 1000,
      raw: { duration: result.duration },
    }
  }

  async healthCheck(): Promise<boolean> {
    return !!process.env.VOLCENGINE_API_KEY
  }

  label(): string {
    return '火山引擎 TTS'
  }
}
