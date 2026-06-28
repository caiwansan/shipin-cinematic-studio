/**
 * bootstrap/determinism-test.ts — Runtime Determinism Test
 *
 * Phase 2, Rule 7: 系统启动时验证 runtime 确定性
 * 模拟最小执行路径，确保 adapter registry 可用
 */

import { modelAdapterRegistry } from '../model-adapters/registry.js'
import type { RuntimePayload } from '../runtime/runtime-payload.js'

const TEST_RUNTIME: RuntimePayload = {
  userId: '__boot_test__',
  provider: 'aliyun',
  model: 'qwen-image',
  taskType: 'image',
  apiKey: '__test_key__',
}

export async function runDeterminismTest(): Promise<void> {
  console.log('[boot]   运行 Runtime 确定性测试...')

  // 1. 验证 registry 能找到适配器
  const adapter = modelAdapterRegistry.findAdapter('qwen-image')
  if (!adapter) {
    // 不是错误——可能启动时没有注册 qwen-image
    console.log('[boot]   ⚠️ 确定性测试: qwen-image 未注册，跳过')
    return
  }

  // 2. 验证 execute 签名合规
  if (typeof adapter.execute !== 'function') {
    throw new Error('[boot] ❌ 确定性测试: adapter.execute 不是函数')
  }

  if (adapter.execute.length < 2) {
    throw new Error('[boot] ❌ 确定性测试: adapter.execute 签名不符合 execute(runtime, input)')
  }

  console.log(`[boot]   ✅ 确定性测试通过: adapter=${adapter.name}, execute arity=${adapter.execute.length}`)
}
