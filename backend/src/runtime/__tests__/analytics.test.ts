/**
 * Capability Analytics — 测试
 *
 * P1.3.4: 验证 Coverage（静态）+ Benchmark（动态）汇聚 + Health 自动分级 + Trend 预留
 */

import { describe, test, expect } from 'vitest'
import { buildAnalytics, computeSummary, buildSnapshot } from '../../../benchmarks/analytics/index.js'
import { exportJSON, exportMarkdown } from '../../../benchmarks/analytics/AnalyticsReport.js'
import { exportSnapshot, computeTrends } from '../../../benchmarks/analytics/AnalyticsExporter.js'
import { computeHealth, computeCoverageStatus } from '../../../benchmarks/analytics/AnalyticsTypes.js'
import { CapabilityRegistry } from '../../../benchmarks/capabilities/registry.js'

describe('Health 自动判断', () => {
  test('coverage=0 则 critical', () => {
    expect(computeHealth(0, null)).toBe('critical')
    expect(computeHealth(0, 50)).toBe('critical')
    expect(computeHealth(0, 100)).toBe('critical')
  })

  test('coverage>0, resolution<80 则 weak', () => {
    expect(computeHealth(50, 79)).toBe('weak')
    expect(computeHealth(100, 50)).toBe('weak')
  })

  test('coverage>0, resolution>=80 则 healthy', () => {
    expect(computeHealth(50, 80)).toBe('healthy')
    expect(computeHealth(100, 99)).toBe('healthy')
  })

  test('coverage>0, resolution=null 默认 healthy', () => {
    expect(computeHealth(20, null)).toBe('healthy')
  })
})

describe('CoverageStatus 判断', () => {
  test('primary>0 为 covered', () => {
    expect(computeCoverageStatus(1, 0)).toBe('covered')
    expect(computeCoverageStatus(2, 5)).toBe('covered')
  })

  test('primary=0, secondary>0 为 partial', () => {
    expect(computeCoverageStatus(0, 1)).toBe('partial')
  })

  test('primary=0, secondary=0 为 uncovered', () => {
    expect(computeCoverageStatus(0, 0)).toBe('uncovered')
  })
})

describe('buildAnalytics', () => {
  test('返回所有能力，数量匹配 Registry', () => {
    const analytics = buildAnalytics()
    expect(analytics.length).toBe(CapabilityRegistry.all.length)
  })

  test('每个能力有 health 状态', () => {
    const analytics = buildAnalytics()
    for (const a of analytics) {
      expect(['healthy', 'weak', 'critical']).toContain(a.health)
    }
  })

  test('含能力基本信息', () => {
    const analytics = buildAnalytics()
    const sample = analytics.find(a => a.capability === 'CHARACTER_REFERENCE')
    expect(sample).toBeDefined()
    expect(sample!.name).toBeTruthy()
    expect(sample!.group).toBeDefined()
    expect(sample!.stage).toBeDefined()
    expect(sample!.difficulty).toBeDefined()
  })

  test('execution 相关字段预留为 null', () => {
    const analytics = buildAnalytics()
    const sample = analytics[0]
    expect(sample.executions).toBeNull()
    expect(sample.successRate).toBeNull()
    expect(sample.averageScore).toBeNull()
    expect(sample.resolutionRate).toBeNull()
    expect(sample.confidence).toBeNull()
    expect(sample.confidenceVariance).toBeNull()
    expect(sample.plannerHitRate).toBeNull()
    expect(sample.averageLatency).toBeNull()
    expect(sample.averageTokens).toBeNull()
  })
})

describe('computeSummary', () => {
  test('总计数与 Registry 一致', () => {
    const analytics = buildAnalytics()
    const summary = computeSummary(analytics)
    expect(summary.total).toBe(CapabilityRegistry.all.length)
  })

  test('各健康状态合计等于总数', () => {
    const analytics = buildAnalytics()
    const summary = computeSummary(analytics)
    expect(summary.healthy + summary.weak + summary.critical).toBe(summary.total)
  })
})

describe('buildSnapshot', () => {
  test('包含所有字段', () => {
    const snapshot = buildSnapshot()
    expect(snapshot.generated).toBeTruthy()
    expect(snapshot.analytics.length).toBeGreaterThan(0)
    expect(snapshot.summary.total).toBeGreaterThan(0)
    expect(snapshot.trends).toEqual([])
  })

  test('exportJSON 输出有效 JSON', () => {
    const snapshot = buildSnapshot()
    const json = exportJSON(snapshot)
    const parsed = JSON.parse(json)
    expect(parsed.summary).toBeDefined()
    expect(parsed.analytics.length).toBeGreaterThan(0)
  })

  test('exportMarkdown 输出完整 Markdown', () => {
    const snapshot = buildSnapshot()
    const md = exportMarkdown(snapshot)
    expect(md).toContain('Capability Analytics')
    expect(md).toContain('Health Score')
    expect(md).toContain('Detail')
  })
})

describe('Trend 预留', () => {
  test('exportSnapshot 写出 run 快照', () => {
    const snapshot = buildSnapshot()
    const files = exportSnapshot(snapshot)
    expect(files.length).toBe(3)
    expect(files.some(f => f.includes('runs/run_'))).toBe(true)
  })

  test('computeTrends 返回历史数据（可能为空）', () => {
    const trends = computeTrends()
    expect(trends.coverageHistory).toBeDefined()
  })
})
