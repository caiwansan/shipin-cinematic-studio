import type { RuntimePayload } from './runtime-payload.js'
import { validateRuntimePayload } from './validate-runtime.js'

export function buildRuntimePayload(config: {
  userId: string
  provider: string
  model: string
  taskType: string
  apiKey: string
  baseURL?: string
  region?: string
}): RuntimePayload {
  const runtime: RuntimePayload = {
    userId: config.userId,
    provider: config.provider,
    model: config.model,
    taskType: config.taskType,
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    region: config.region,
  }

  validateRuntimePayload(runtime)

  return runtime
}
