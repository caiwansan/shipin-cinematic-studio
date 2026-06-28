/**
 * model-adapters/images/index.ts
 * 图片模型适配器集合
 */

export { wanImageAdapter } from './wan-image.adapter.js'
export { qwenImageAdapter } from './qwen-image.adapter.js'
export { seedreamImageAdapter } from './seedream-image.adapter.js'
export { siliconflowImageAdapter } from './siliconflow-image.adapter.js'
export { dalleImageAdapter } from './dalle-image.adapter.js'

import { modelAdapterRegistry } from '../registry.js'
import { wanImageAdapter } from './wan-image.adapter.js'
import { qwenImageAdapter } from './qwen-image.adapter.js'
import { seedreamImageAdapter } from './seedream-image.adapter.js'
import { siliconflowImageAdapter } from './siliconflow-image.adapter.js'
import { dalleImageAdapter } from './dalle-image.adapter.js'

/** 注册所有图片适配器 */
export function registerImageAdapters(): void {
  modelAdapterRegistry.register(wanImageAdapter)
  modelAdapterRegistry.register(qwenImageAdapter)
  modelAdapterRegistry.register(seedreamImageAdapter)
  modelAdapterRegistry.register(siliconflowImageAdapter)
  modelAdapterRegistry.register(dalleImageAdapter)
}
