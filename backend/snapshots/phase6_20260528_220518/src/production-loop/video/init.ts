// Video Provider initialization
// Called at server start to register all video providers

import { registerVideoProvider } from './video-provider.js'
import { MockVideoProvider } from './mock.video.js'
import { VolcengineVideoProvider } from './volcengine.video.js'
import { BailianVideoProvider } from './bailian.video.js'

export function initVideoProviders(): void {
  // Always register mock provider (for dev/demo)
  registerVideoProvider(new MockVideoProvider())

  // Register Bailian (阿里百炼) if API key available
  const BAILIAN_KEY = ""  // ⚠️ 已禁用 process.env fallback
  if (BAILIAN_KEY) {
    registerVideoProvider(new BailianVideoProvider())
    console.log(`[video-provider] registered bailian: wan-aigc-video`)
  } else {
    console.log('[video-provider] BAILIAN_API_KEY not set, skipping bailian')
  }

  // Register Volcengine (火山引擎) if API key available
  const VOLC_KEY = ""  // ⚠️ 已禁用 process.env fallback
  if (VOLC_KEY) {
    const volc = new VolcengineVideoProvider()
    registerVideoProvider(volc)
    console.log(`[video-provider] registered volcengine: ${volc.models.join(', ')}`)
  } else {
    console.log('[video-provider] VOLCENGINE_API_KEY not set, skipping volcengine')
  }

  // Register Replicate if API key available
  const REPLICATE_KEY = '' // ⚠️ 已禁用 process.env fallback
  if (REPLICATE_KEY) {
    // Dynamic import to avoid loading if not configured
    import('./replicate.video.js').then(({ ReplicateVideoProvider }) => {
      registerVideoProvider(new ReplicateVideoProvider())
    }).catch(err => {
      console.warn('[video-provider] Failed to load ReplicateVideoProvider:', err.message)
    })
  }
}
