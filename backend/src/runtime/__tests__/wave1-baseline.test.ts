/**
 * Wave 1 Baseline — 输出 Summary
 * 验证 Coverage / Analytics / Health
 */

import { describe, test, expect } from 'vitest'
import { scanAllDatasets } from '../../../benchmarks/coverage/CoverageScanner.js'
import { CapabilityRegistry } from '../../../benchmarks/capabilities/registry.js'
import { analyzeGaps } from '../../../benchmarks/coverage/GapAnalyzer.js'
import { buildAnalytics, computeSummary } from '../../../benchmarks/analytics/index.js'

describe('Wave 1 Baseline', () => {
  test('Capability Coverage ≥ 12 (Wave 1 目标)', () => {
    const entries = scanAllDatasets()
    const covered = entries.filter(e => !e.gap)
    expect(covered.length).toBeGreaterThanOrEqual(12)
  })

  test('Wave 1 五项能力全部覆盖', () => {
    const entries = scanAllDatasets()
    const coveredIds = entries.filter(e => !e.gap).map(e => e.capability)
    const wave1 = ['CAMERA_PATH', 'CAMERA_MOTION', 'OBJECT_PERSISTENCE', 'SPATIAL_RELATIONSHIP', 'TEMPORAL_CONSISTENCY']
    for (const w1 of wave1) {
      expect(coveredIds).toContain(w1)
    }
  })

  test('每个 Wave 1 能力至少有一个 primary Dataset', () => {
    const entries = scanAllDatasets()
    const wave1 = ['CAMERA_PATH', 'CAMERA_MOTION', 'OBJECT_PERSISTENCE', 'SPATIAL_RELATIONSHIP', 'TEMPORAL_CONSISTENCY']
    for (const w1 of wave1) {
      const entry = entries.find(e => e.capability === w1)!
      expect(entry.primaryDatasets.length).toBeGreaterThanOrEqual(1)
    }
  })

  test('Health 信息可生成', () => {
    const analytics = buildAnalytics()
    const summary = computeSummary(analytics)
    expect(summary.total).toBe(CapabilityRegistry.all.length)
    expect(summary.healthScore).toBeGreaterThanOrEqual(0)
  })

  test('P0 Gaps 持续下降（相对 Baseline）', () => {
    const entries = scanAllDatasets()
    const gapReport = analyzeGaps(entries)
    const p0Count = gapReport.suggestions.filter(g => g.level === 'P0').length
    // Baseline: 24 P0. After Wave 1: should be fewer
    expect(p0Count).toBeLessThan(24)
  })
})
