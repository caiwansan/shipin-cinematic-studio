/**
 * model-adapters/tts/index.ts
 * TTS 模型适配器集合
 */

export { aliyunTtsAdapter } from './aliyun-tts.adapter.js'
export { volcengineTtsAdapter } from './volcengine-tts.adapter.js'
export { siliconflowTtsAdapter } from './siliconflow-tts.adapter.js'

import { modelAdapterRegistry } from '../registry.js'
import { aliyunTtsAdapter } from './aliyun-tts.adapter.js'
import { volcengineTtsAdapter } from './volcengine-tts.adapter.js'
import { siliconflowTtsAdapter } from './siliconflow-tts.adapter.js'

/** 注册所有 TTS 适配器 */
export function registerTtsAdapters(): void {
  modelAdapterRegistry.register(aliyunTtsAdapter)
  modelAdapterRegistry.register(volcengineTtsAdapter)
  modelAdapterRegistry.register(siliconflowTtsAdapter)
}
