/**
 * Volcengine Method Bindings — Phase 1A
 *
 * Stable function identity for higher-order function injection patterns.
 * Required because routes/images.ts uses lambda capture:
 *   gen: (p) => volcengineImage.generate(p)
 *
 * If the original object reference changes (import path rewrite),
 * these lambdas still hold the old function reference.
 * This layer provides method-bound proxies to prevent that.
 *
 * Does NOT change behavior. Only stabilizes function reference identity.
 */

import { volcengineImage, volcengineImageStateless } from './volcengine-image.wrapper.js'
import { volcengineVideoWrapped } from './volcengine-video.wrapper.js'
import { volcengineTTSWrapped } from './volcengine-tts.wrapper.js'

// Method bindings for lambda injection patterns
// These are stable function references that survive import path changes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bindVolcengineImageMethods: any = {
  generate: volcengineImage.generate.bind(volcengineImage),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bindVolcengineImageStatelessMethods: any = {
  generate: volcengineImageStateless.generate.bind(volcengineImageStateless),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bindVolcengineVideoMethods: any = {
  submit: volcengineVideoWrapped.submit.bind(volcengineVideoWrapped),
  poll: volcengineVideoWrapped.poll.bind(volcengineVideoWrapped),
  waitForCompletion: volcengineVideoWrapped.waitForCompletion.bind(volcengineVideoWrapped),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bindVolcengineTTSMethods: any = {
  synthesize: volcengineTTSWrapped.synthesize.bind(volcengineTTSWrapped),
}
