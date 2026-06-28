/**
 * Phase C — Provider Adapters barrel export.
 *
 * All adapter constructors are exported for registration at bootstrap.
 * Adapters are NOT auto-registered here — the bootstrap entry point
 * (see bootstrap.ts or index.ts) is responsible for calling:
 *
 *   import { pluginRegistry } from '../core/provider-registry/plugin-registry.js'
 *   import { SiliconflowImageAdapter } from '../core/provider-adapters/siliconflow-image.adapter.js'
 *   pluginRegistry.register(new SiliconflowImageAdapter())
 *
 * This keeps registry lifecycle explicit and testable.
 */

export { SiliconflowImageAdapter } from './siliconflow-image.adapter.js'
export { AliyunImageAdapter } from './aliyun-image.adapter.js'
export { VolcengineImageAdapter } from './volcengine-image.adapter.js'
export { VolcengineVideoAdapter } from './volcengine-video.adapter.js'
export { AliyunVideoAdapter } from './aliyun-video.adapter.js'
export { SiliconflowTTSAdapter } from './siliconflow-tts.adapter.js'
export { AliyunTTSAdapter } from './aliyun-tts.adapter.js'
export { VolcengineTTSAdapter } from './volcengine-tts.adapter.js'

// Phase 3C — LLM Execution Adapter (bridge)
export { LLMExecutionAdapter } from './llm-execution.adapter.js'
