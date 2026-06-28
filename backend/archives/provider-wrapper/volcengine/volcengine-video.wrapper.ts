/**
 * Volcengine Video Wrapper — Phase 1A
 *
 * Transparent proxy for volcengineVideo.
 * Single export (services version, plain object with submit/poll/waitForCompletion).
 *
 * No behavior changes. Proxy only + metadata tagging.
 */

import { volcengineVideo } from '../../../services/volcengine-video.provider.js'
import { createVolcengineProxy } from './volcengine-proxy.factory.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const volcengineVideoWrapped: any = createVolcengineProxy(volcengineVideo, {
  provider: 'volcengine',
  symbol: 'volcengineVideo',
  mode: 'job',      // video is always job model (submit + poll)
  wrapper: 'v1-proxy',
})
