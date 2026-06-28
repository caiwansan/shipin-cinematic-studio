/**
 * model-adapters/video/index.ts
 * 视频模型适配器集合
 */

export { aliyunVideoAdapter } from './aliyun-video.adapter.js'
export { volcengineVideoAdapter } from './volcengine-video.adapter.js'

import { modelAdapterRegistry } from '../registry.js'
import { aliyunVideoAdapter } from './aliyun-video.adapter.js'
import { volcengineVideoAdapter } from './volcengine-video.adapter.js'

/** 注册所有视频适配器 */
export function registerVideoAdapters(): void {
  modelAdapterRegistry.register(aliyunVideoAdapter)
  modelAdapterRegistry.register(volcengineVideoAdapter)
}
