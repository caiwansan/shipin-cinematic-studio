/**
 * Volcengine Wrapper Barrel — Phase 1A
 *
 * Re-export all wrapped symbols for transparent import replacement.
 * Callers change only their import path, nothing else.
 *
 * BEFORE:
 *   import { volcengineImage } from '../services/volcengine-image.provider'
 * AFTER:
 *   import { volcengineImage } from '@/core/provider-wrapper/volcengine'
 */

export {
  volcengineImage,
  volcengineImageStateless,
} from './volcengine-image.wrapper.js'

export {
  volcengineVideoWrapped,
} from './volcengine-video.wrapper.js'

export {
  volcengineTTSWrapped,
} from './volcengine-tts.wrapper.js'

export {
  bindVolcengineImageMethods,
  bindVolcengineImageStatelessMethods,
  bindVolcengineVideoMethods,
  bindVolcengineTTSMethods,
} from './volcengine-method-bindings.js'

export { createVolcengineProxy } from './volcengine-proxy.factory.js'
export type { ProxyMeta, WithMeta } from './volcengine-proxy.factory.js'
