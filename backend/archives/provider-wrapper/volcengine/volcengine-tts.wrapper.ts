/**
 * Volcengine TTS Wrapper — Phase 1A
 *
 * Transparent proxy for volcengineTTS.
 * Single export (services version, plain object with synthesize).
 * Low-risk entry point: single file, single method, no lifecycle.
 *
 * No behavior changes. Proxy only + metadata tagging.
 */

import { volcengineTTS } from '../../../services/volcengine-tts.provider.js'
import { createVolcengineProxy } from './volcengine-proxy.factory.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const volcengineTTSWrapped: any = createVolcengineProxy(volcengineTTS, {
  provider: 'volcengine',
  symbol: 'volcengineTTS',
  mode: 'stateless',    // TTS is single HTTP call, no submit/poll
  wrapper: 'v1-proxy',
})
