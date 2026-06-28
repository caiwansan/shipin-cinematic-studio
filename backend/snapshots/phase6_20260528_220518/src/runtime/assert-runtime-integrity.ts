import type { RuntimePayload } from './runtime-payload.js'

export function assertRuntimeIntegrity(runtime: RuntimePayload) {
  const required = [
    'userId',
    'provider',
    'model',
    'taskType',
    'apiKey',
  ]

  for (const key of required) {
    const value = runtime[key as keyof RuntimePayload]

    if (!value) {
      throw new Error(
        `[runtime-integrity] missing ${key}`
      )
    }
  }
}
