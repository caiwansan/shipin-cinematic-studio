/**
 * bootstrap/worker-guard.ts — Worker Boot Guard
 *
 * Phase 2, Rule 6: worker 不能在 boot 完成前执行
 */

import { runtimeBoot, isBooted } from './runtime-boot.js'

let guardPassed = false

export async function ensureBooted(): Promise<void> {
  if (guardPassed) return

  if (!isBooted()) {
    console.log('[guard] Worker 启动前执行 runtime boot...')
    await runtimeBoot()
  }

  guardPassed = true
  console.log('[guard] ✅ Boot complete — worker 可以开始消费')
}
