import type { ApiResponse } from '../contracts/api/base.js';
/**
 * EPVH — Verification Routes
 *
 *  - POST /api/v2/verification/scan         — 运行全量验证（静态+适配器）
 *  - GET  /api/v2/verification/status       — 当前验证状态
 *  - GET  /api/v2/verification/traces       — 运行时追踪数据
 *  - POST /api/v2/verification/report       — 生成完整违规报告
 */

import { FastifyInstance } from 'fastify'
import { staticPathScanner } from '../core/verification/execution-plane/static-path-scanner.js'
import { runtimeCallTracer } from '../core/verification/execution-plane/runtime-call-tracer.js'
import { adapterCoverageMapper } from '../core/verification/execution-plane/adapter-coverage-mapper.js'
import { violationReporter } from '../core/verification/execution-plane/violation-reporter.js'

export default async function verificationRoutes(app: FastifyInstance) {
  // 运行静态扫描
  app.post('/api/v2/verification/scan', async () => {
    const scanReport = staticPathScanner.scan()
    const coverageReport = adapterCoverageMapper.build()

    return {
      success: true,
      data: {
        staticScan: {
          totalFiles: scanReport.totalFilesScanned,
          findings: {
            critical: scanReport.findings.filter(f => f.severity === 'CRITICAL').length,
            warning: scanReport.findings.filter(f => f.severity === 'WARNING').length,
            info: scanReport.findings.filter(f => f.severity === 'INFO').length,
          },
          bypassPaths: scanReport.findings.filter(f => f.severity === 'CRITICAL').map(f => ({
            path: f.path,
            line: f.line,
            detail: f.detail,
          })),
        },
        adapterCoverage: {
          overall: coverageReport.overallAdapted ? '✅' : '❌',
          adapted: `${coverageReport.adaptedCount}/${coverageReport.totalCount}`,
          gaps: coverageReport.gaps,
        },
      },
    }
  })

  // 验证状态
  app.get('/api/v2/verification/status', async () => {
    const scanReport = staticPathScanner.scan()
    const coverageReport = adapterCoverageMapper.build()
    const traceStats = runtimeCallTracer.getStats()

    const criticalBypasses = scanReport.findings.filter(f => f.severity === 'CRITICAL').length

    return {
      success: true,
      data: {
        integrityScore: criticalBypasses === 0 ? 100 : Math.max(0, 100 - criticalBypasses * 25),
        staticBypassCount: criticalBypasses,
        adapterCoverage: `${coverageReport.adaptedCount}/${coverageReport.totalCount}`,
        runtimeTraces: traceStats.totalTraces,
        runtimeBypasses: traceStats.totalBypasses,
        isSingleExecutionPlane: criticalBypasses === 0 && coverageReport.overallAdapted,
      },
    }
  })

  // 运行时追踪
  app.get('/api/v2/verification/traces', async () => {
    const traces = runtimeCallTracer.getTraces()
    return {
      success: true,
      data: {
        stats: runtimeCallTracer.getStats(),
        recentTraces: traces.slice(-50).reverse(),
      },
    }
  })

  // 完整报告
  app.post('/api/v2/verification/report', async () => {
    const scanReport = staticPathScanner.scan()
    const coverageReport = adapterCoverageMapper.build()
    const traces = runtimeCallTracer.getTraces()
    const report = violationReporter.generate(scanReport, coverageReport, traces)

    return { success: true, data: report } satisfies ApiResponse<unknown>;

  })
}
