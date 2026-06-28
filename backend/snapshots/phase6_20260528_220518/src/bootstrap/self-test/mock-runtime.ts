/**
 * bootstrap/self-test/mock-runtime.ts — Mock Runtime Factory
 *
 * 为自测生成带有效签名的 RuntimePayload
 */

import type { RuntimePayload } from '../../runtime/runtime-payload.js'

export function createMockRuntime(taskType: string = 'image', overrides: Partial<RuntimePayload> = {}): RuntimePayload {
  return {
    userId: '__self_test__',
    provider: overrides.provider || 'aliyun',
    model: overrides.model || 'qwen-image',
    taskType,
    apiKey: '__self_test_key__',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    ...overrides,
  }
}

export function createMockRuntimeVideo(overrides: Partial<RuntimePayload> = {}): RuntimePayload {
  return createMockRuntime('video', { model: 'wan2.7-i2v', ...overrides })
}

export function createMockRuntimeLLM(overrides: Partial<RuntimePayload> = {}): RuntimePayload {
  return createMockRuntime('llm', { model: 'qwen-plus', provider: 'volcengine', ...overrides })
}
