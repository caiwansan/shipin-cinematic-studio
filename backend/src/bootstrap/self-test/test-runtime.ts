/**
 * bootstrap/self-test/test-runtime.ts — Runtime Payload Integrity Test
 *
 * 验证 RuntimePayload 断言函数能正确检测合法/非法 payload
 * Phase 3, Rule 4: runtime 回归必须 fail
 */

import { assertRuntimeIntegrity } from '../../runtime/assert-runtime-integrity.js'
import { createMockRuntime } from './mock-runtime.js'

export async function testRuntimePayloadIntegrity(): Promise<void> {
  const runtime = createMockRuntime('image')

  try {
    assertRuntimeIntegrity(runtime)
    console.log('[self-test]   ✅ assertRuntimeIntegrity: 合法 runtime 通过')
  } catch (e: any) {
    throw new Error(`[self-test] ❌ 合法 runtime 被拒绝: ${e.message}`)
  }

  // 测试非法 runtime
  const invalidCases: [string, any][] = [
    ['空对象', {}],
    ['缺少 userId', { provider: 'aliyun', model: 'test', taskType: 'image', apiKey: 'key' }],
    ['缺少 apiKey', { userId: 'u1', provider: 'aliyun', model: 'test', taskType: 'image' }],
    ['缺少 provider', { userId: 'u1', model: 'test', taskType: 'image', apiKey: 'key' }],
  ]

  for (const [label, payload] of invalidCases) {
    try {
      assertRuntimeIntegrity(payload as any)
      throw new Error(`[self-test] ❌ ${label}: 应抛出异常但未抛`)
    } catch {
      console.log(`[self-test]   ✅ assertRuntimeIntegrity: ${label} 被正确拒绝`)
    }
  }

  console.log('[self-test]   ✅ RuntimePayload 完整性验证通过')
}
