/**
 * Runtime Adapters — 所有 provider 调用的唯一入口
 * 禁止绕过此层直接调 provider SDK
 */
export { ImageAdapter } from './image/ImageAdapter.js'
export { VideoAdapter } from './video/VideoAdapter.js'
export { TTSAdapter } from './tts/TTSAdapter.js'
export { ModelAdapterRegistry } from './ModelAdapterRegistry.js'
