/**
 * Worker Pool — 独立进程
 *
 * 职责：处理 production 任务队列
 * 关键点：不 import simulation 层代码
 *
 * 启动：node dist/workers/pool.js
 * PM2：pm2 start dist/workers/pool.js --name worker-pool -i 2
 */

import { startMockWorker } from '../services/mock-worker.js'
import { emitEvent } from '../services/observability.service.js'
import { initializeRuntimeSafety, timerRegistry, pushGlobalEvent } from '../services/lifecycle-manager.js'

const HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_INTERVAL || 10000)

async function main() {
  process.title = 'worker-pool'

  initializeRuntimeSafety()

  // 启动 Mock Worker
  await startMockWorker()

  console.log(`[Worker Pool] Started, PID: ${process.pid}`)
  pushGlobalEvent('worker.pool.started', { pid: process.pid })

  // 心跳
  timerRegistry.setInterval(() => {
    console.log(`[Worker Pool] Heartbeat: PID=${process.pid} uptime=${process.uptime().toFixed(0)}s`)
  }, HEARTBEAT_INTERVAL_MS)

  // 保持进程运行
  process.on('SIGTERM', () => {
    console.log('[Worker Pool] SIGTERM — shutting down')
    timerRegistry.clearAll()
    process.exit(0)
  })
}

main().catch(err => {
  console.error('[Worker Pool] Fatal:', err)
  process.exit(1)
})
