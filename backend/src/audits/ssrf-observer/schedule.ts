/**
 * audits/ssrf-observer/schedule.ts
 *
 * SSRF 观测定时报告 — 每 12h 自动跑一次 calibration report。
 * 在 index.ts 中注册。
 *
 * 用法：
 *   import { scheduleSsrfObservation } from '../audits/ssrf-observer/schedule.js'
 *   scheduleSsrfObservation()
 */

export function scheduleSsrfObservation(intervalMs: number = 12 * 60 * 60 * 1000): void {
  // 只在非生产环境或显式启用时才启动定时任务
  if (process.env.DISABLE_SSRF_OBSERVER === '1') {
    console.log('[SSRF-Observer] ⏸️ 已禁用 (DISABLE_SSRF_OBSERVER=1)')
    return
  }

  const run = async () => {
    try {
      const { generateCalibrationReport } = await import('./calibration-reporter.js')
      const report = generateCalibrationReport()
      console.log(`[SSRF-Observer] 📊 Calibration: ${report.totalEntries} entries (internal=${report.riskDistribution.internal}, cdn=${report.riskDistribution.cdnOSS}, external=${report.riskDistribution.external}, redirects=${report.redirectEntries.length})`)
    } catch (err: any) {
      console.warn(`[SSRF-Observer] ⚠️ 报告生成失败: ${err.message}`)
    }
  }

  // 首次运行延迟 5 分钟
  setTimeout(() => {
    run()
    setInterval(run, intervalMs)
    console.log(`[SSRF-Observer] 👀 Shadow observation 已启动，每 ${intervalMs / 3600000}h 报告一次`)
  }, 5 * 60 * 1000)
}
