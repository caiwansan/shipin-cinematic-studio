/**
 * Long Run API — 长期稳定性测试控制端点
 */

import { FastifyInstance } from 'fastify'
import { LongRunRunner, LongRunConfig } from './long-run-runner.js'
import { getBackpressureStatus } from './backpressure-controller.js'

let runner: LongRunRunner | null = null

export async function registerLongRunRoutes(app: FastifyInstance) {
  // 启动长期测试
  app.post('/api/sim-isolation/longrun/start', async (request) => {
    const body = request.body as Partial<LongRunConfig> | undefined

    if (runner?.getStatus().running) {
      return { error: 'Long run test already in progress' }
    }

    runner = new LongRunRunner({
      durationSec: body?.durationSec ?? 600,
      pattern: body?.pattern ?? 'wave',
      workerCount: body?.workerCount ?? 5,
      workerProcessTimeMs: body?.workerProcessTimeMs ?? 200,
      workerFailRate: body?.workerFailRate ?? 0.1,
      backpressureConfig: {
        highWaterMark: body?.backpressureConfig?.highWaterMark ?? 100,
        lowWaterMark: body?.backpressureConfig?.lowWaterMark ?? 20,
        maxRate: body?.backpressureConfig?.maxRate ?? 15,
        initialRate: body?.backpressureConfig?.initialRate ?? 10,
        emergencyThreshold: body?.backpressureConfig?.emergencyThreshold ?? 500,
      },
    })

    // 不要 await —— 启动后异步运行
    runner.start().catch(err => {
      console.error('[LongRun] Runner error:', err)
    })

    return { status: 'started', durationSec: body?.durationSec ?? 600, config: runner.getStatus() }
  })

  // 长测试状态
  app.get('/api/sim-isolation/longrun/status', async () => {
    if (!runner) {
      return { running: false, message: 'No test started' }
    }
    const status = runner.getStatus()
    return status
  })

  // 停止长测试
  app.post('/api/sim-isolation/longrun/stop', async () => {
    if (!runner) {
      return { error: 'No test started' }
    }
    const report = await runner.stop()
    runner = null
    return { stopped: true, report }
  })

  // 获取最新报告
  app.get('/api/sim-isolation/longrun/report', async () => {
    if (!runner) {
      return { error: 'No test started' }
    }
    return runner.getStatus()
  })
}
