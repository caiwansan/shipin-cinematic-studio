/**
 * bootstrap/runtime-boot.ts — Runtime Boot Pipeline (Phase 4 Simplified)
 *
 * Phase 4, Rule 5: boot layer is not business layer
 * 只保留：init adapters → freeze registry → self-test
 * 移除：verifyProviders/verifyQueue/verifyDatabase（业务检查不属于 boot）
 */

import { initModelAdapters } from '../model-adapters/index.js'
import { verifyAdapterRegistry } from './preflight/adapters.js'
import { runDeterminismTest } from './determinism-test.js'
import { initGovernance } from '../governance/init-governance.js'
import { initKernel } from '../kernel/init-kernel.js'
import { initTruthLayer } from '../truth/init-truth.js'

let booted = false

export async function runtimeBoot() {
  if (booted) {
    console.log('[boot] already booted, skipping')
    return
  }

  console.log('[boot] ========== Runtime Boot Pipeline ==========')

  // Phase 2, Rule 1: 显式初始化 adapter registry
  console.log('[boot] init model adapters...')
  await initModelAdapters()

  // Phase 5, Rule 1: init governance
  console.log('[boot] init governance...')
  await initGovernance()

  // Phase 6, Rule 1: init kernel
  console.log('[boot] init kernel...')
  await initKernel()

  // Phase 7, Rule 1: init truth layer
  console.log('[boot] init truth layer...')
  await initTruthLayer()

  // EGIL: execution graph integrity check (removed — legacy closure deleted)

  // Phase 2, Rule 2: 校验 registry 完整性
  console.log('[boot] verify adapter registry...')
  verifyAdapterRegistry()

  // Phase 2, Rule 7: 确定性测试
  console.log('[boot] run determinism test...')
  await runDeterminismTest()

  // Phase 2, Rule 3 + Phase 4 Rule 5: freeze registry → self-test
  console.log('[boot] freeze adapter registry...')
  const { freezeRegistry } = await import('../model-adapters/registry.js')
  freezeRegistry()

  // Phase 3: Self-Test Suite — 在 freeze 后执行
  console.log('[boot] run runtime self-test...')
  const { runRuntimeSelfTest } = await import('./self-test/runtime-self-test.js')
  await runRuntimeSelfTest()

  // Phase 3.5: Init Provider Registry (FRE v1)
  console.log('[boot] init provider registry...')
  const { initProviders } = await import('../providers/index.js')
  initProviders()

  booted = true
  console.log('[boot] ✅ Runtime deterministic READY')
}

export function isBooted(): boolean {
  return booted
}
