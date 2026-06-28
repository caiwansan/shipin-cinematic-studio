/**
 * Volcengine Image Wrapper — Phase 1A
 *
 * Dual-model compatibility wrapper for volcengineImage:
 * - services version: job model (plain object)
 * - production-loop version: stateless model (class instance)
 *
 * No behavior changes. Proxy only + metadata tagging.
 */

import { volcengineImage as servicesImage } from '../../../services/volcengine-image.provider.js'
import { volcengineImage as productionImage } from '../../../production-loop/video/volcengine.image.js'
import { createVolcengineProxy, type WithMeta } from './volcengine-proxy.factory.js'

// Wrap both implementations independently
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const volcengineImage: any = createVolcengineProxy(servicesImage, {
  provider: 'volcengine',
  symbol: 'volcengineImage',
  mode: 'job',
  wrapper: 'v1-proxy',
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const volcengineImageStateless: any = createVolcengineProxy(productionImage, {
  provider: 'volcengine',
  symbol: 'volcengineImage',
  mode: 'stateless',
  wrapper: 'v1-proxy',
})
