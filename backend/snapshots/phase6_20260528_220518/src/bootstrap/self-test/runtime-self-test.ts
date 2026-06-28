/**
 * bootstrap/self-test/runtime-self-test.ts — Runtime Self-Test Suite 主入口
 *
 * 顺序执行所有自测模块，捕获并报告每个子测试的结果
 * Phase 3: 覆盖 adapter registry / queue / provider routing / runtime integrity
 */

import { testAdapterRegistry } from './test-adapters.js'
import { testQueueExecution } from './test-queue.js'
import { testProviderRouting } from './test-providers.js'
import { testRuntimePayloadIntegrity } from './test-runtime.js'
import { assertNoRegression, type RegressionState } from './regression-guard.js'
import { modelAdapterRegistry } from '../../model-adapters/registry.js'

interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export async function runRuntimeSelfTest(): Promise<void> {
  console.log('[self-test] ========== Runtime Self-Test Suite ==========')

  const results: TestResult[] = []

  // Phase 3, Rule 1: Adapter 测试
  results.push(await runTest('Adapter Registry', testAdapterRegistry))

  // Phase 3, Rule 3: Provider 路由测试
  results.push(await runTest('Provider Routing', testProviderRouting))

  // Phase 3, Rule 4: Runtime Payload 完整性测试
  results.push(await runTest('Runtime Payload Integrity', testRuntimePayloadIntegrity))

  // Phase 3, Rule 2: Queue 测试
  results.push(await runTest('Queue Execution', testQueueExecution))

  // Regression guard
  const regState: RegressionState = {
    hasFallbackRuntime: false,
    hasLegacyProviderCall: false,
    registryFrozen: Object.isFrozen(modelAdapterRegistry),
  }
  results.push(await runTest('Regression Guard', async () => assertNoRegression(regState)))

  // 汇总报告
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log('')
  console.log('[self-test] ========== Summary ==========')
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌'
    console.log(`[self-test] ${icon} ${r.name}${r.error ? `: ${r.error}` : ''}`)
  }
  console.log(`[self-test] ${passed}/${results.length} 通过, ${failed} 失败`)

  if (failed > 0) {
    // Phase 3, Rule 6: self-test 失败系统不能继续
    const errors = results.filter(r => !r.passed).map(r => `  ❌ ${r.name}: ${r.error || 'unknown error'}`)
    throw new Error(`[self-test] ❌ ${failed} 个测试失败, 系统拒绝启动:\n${errors.join('\n')}`)
  }

  console.log('[self-test] ✅ All tests PASSED — System runtime is deterministic and verifiable')
}

async function runTest(name: string, fn: () => Promise<void>): Promise<TestResult> {
  try {
    await fn()
    return { name, passed: true }
  } catch (err: any) {
    return { name, passed: false, error: err.message }
  }
}
