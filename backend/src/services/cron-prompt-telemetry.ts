/**
 * cron-prompt-telemetry.ts — Phase 4-B Prompt 遥测聚合 Cron
 *
 * 每 10 分钟执行一次全量聚合，更新统计表和快照。
 * 挂载在 index.ts 的 onReady 中。
 *
 * @phase-4b
 */

import { runFullAggregation } from '../runtime/prompt/PromptTelemetryAggregator.js'

let _interval: ReturnType<typeof setInterval> | null = null

const CRON_INTERVAL_MS = 10 * 60 * 1000  // 10 分钟

export function startTelemetryCron(): void {
  if (_interval) return
  console.log('[PromptTelemetryCron] 🔄 Starting telemetry aggregation (every 10 min)')

  // 启动时立即执行一次
  runFullAggregation().catch(err => {
    console.warn('[PromptTelemetryCron] ⚠️ Initial aggregation failed:', err.message)
  })

  _interval = setInterval(() => {
    runFullAggregation().catch(err => {
      console.warn('[PromptTelemetryCron] ⚠️ Aggregation failed:', err.message)
    })
  }, CRON_INTERVAL_MS)
}

export function stopTelemetryCron(): void {
  if (_interval) {
    clearInterval(_interval)
    _interval = null
    console.log('[PromptTelemetryCron] ⏹ Telemetry aggregation stopped')
  }
}
