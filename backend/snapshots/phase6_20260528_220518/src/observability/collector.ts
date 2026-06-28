/**
 * Snapshot Collector v2 — 统一采集管道 (Redis-backed)
 *
 * 每 1s 采集：从 Backpressure 的 Redis 状态读取 + 本地 memory
 * 写入 system_metrics 表 + Redis MetricCache
 *
 * 解决 PM2 cluster 下的状态一致性问题：
 *   - running state → Redis (CollectorState)
 *   - samples written → Redis (atomic incr)
 *   - 所有 api-server 进程读取同一份状态
 */

import { emitEvent } from '../services/observability.service.js'
import { persistMetric } from './timeseries.js'
import { CollectorState, MetricCache, BackpressureState } from '../utils/redis-state.js'
import { saveReplayFrame, classifyFrameLabel } from '../replay/replay-engine.js'
import type { DriftPoint } from '../simulation/drift-analyzer.js'

let samplingTimer: ReturnType<typeof setInterval> | null = null
let frameCounter = 0

/**
 * 启动采集管道（每秒一次）
 */
export async function startSnapshotCollector(): Promise<void> {
  const alreadyRunning = await CollectorState.isRunning()
  if (alreadyRunning) return

  await CollectorState.setRunning(true)

  samplingTimer = setInterval(async () => {
    try {
      // 从 Redis 读取背压状态（跨进程一致）
      const bp = await BackpressureState.snapshot()

      const snapshot: DriftPoint = {
        timestamp: Date.now(),
        queueLength: bp.queueLength,
        queuePressure: bp.queuePressure,
        workerThroughput: bp.workerThroughput || 0,
        workerCompleted: Math.round(bp.workerThroughput * (bp.queueLength + 1)),
        memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
        pidRate: bp.currentRate,
        ses: bp.ses,
      }

      // 持久化到 PostgreSQL
      await persistMetric(snapshot)

      // 持久化到 Redis MetricCache（实时查询用）
      await MetricCache.push({
        timestamp: snapshot.timestamp,
        queueLength: snapshot.queueLength,
        queuePressure: snapshot.queuePressure,
        memoryMb: snapshot.memoryMb,
        ses: snapshot.ses,
        currentRate: snapshot.pidRate,
      })

      // 更新计数器
      await CollectorState.incrSamples()
      await CollectorState.setLastSampleTime(snapshot.timestamp)

      // SSE 广播
      emitEvent('system.metric', {
        timestamp: snapshot.timestamp,
        queueLength: snapshot.queueLength,
        queuePressure: snapshot.queuePressure,
        memoryMb: snapshot.memoryMb,
        ses: snapshot.ses,
      })

      // 每隔 10 秒保存一个回放关键帧
      frameCounter++
      if (frameCounter >= 10) {
        frameCounter = 0
        const label = classifyFrameLabel({
          queuePressure: snapshot.queuePressure,
          ses: snapshot.ses,
          workerThroughput: snapshot.workerThroughput,
          queueLength: snapshot.queueLength,
        })

        // 异步写入，不阻塞采集
        saveReplayFrame({
          timestamp: snapshot.timestamp,
          queueLength: snapshot.queueLength,
          queuePressure: snapshot.queuePressure,
          workerThroughput: snapshot.workerThroughput,
          workerEfficiency: snapshot.workerThroughput,
          memoryMb: snapshot.memoryMb,
          pidPressure: snapshot.pidRate,
          generatorRate: snapshot.pidRate,
          ses: snapshot.ses,
          costPerMin: 0,
          totalCost: 0,
          label,
        }).catch(() => { /* 帧写入失败不阻塞 */ })
      }
    } catch (err) {
      // 采集失败不抛异常，保护主线程
    }
  }, 1000)
}

/**
 * 停止采集管道
 */
export async function stopSnapshotCollector(): Promise<void> {
  if (samplingTimer) {
    clearInterval(samplingTimer)
    samplingTimer = null
  }
  await CollectorState.setRunning(false)
}

/**
 * 获取采集器状态（Redis-backed，跨进程一致）
 */
export async function getCollectorStatus(): Promise<{
  running: boolean
  samplesWritten: number
  lastSampleTime: number | null
}> {
  const running = await CollectorState.isRunning()
  const samples = await CollectorState.getSamplesWritten()
  const lastTs = await CollectorState.getLastSampleTime()
  return { running, samplesWritten: samples, lastSampleTime: lastTs }
}
