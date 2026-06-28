import type { RuntimePayload } from './runtime-payload.js'

export function validateRuntimePayload(runtime: RuntimePayload) {
  if (!runtime.userId) {
    throw new Error('[runtime] missing userId')
  }

  if (!runtime.provider) {
    throw new Error('[runtime] missing provider')
  }

  if (!runtime.model) {
    throw new Error('[runtime] missing model')
  }

  if (!runtime.apiKey) {
    throw new Error('[runtime] missing apiKey')
  }

  if (!runtime.taskType) {
    throw new Error('[runtime] missing taskType')
  }
}
