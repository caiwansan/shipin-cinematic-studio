/**
 * Pipeline Metrics 测试
 *
 * A4.5 P2: 验证 Metrics Schema + Collector + SPS + Pipeline Report
 */

import { describe, test, expect } from 'vitest'
import { MetricsCollector, computeSPS } from '../../runtime/pipeline-metrics.js'
import type { PipelineStage } from '../../runtime/pipeline-metrics.js'

describe('MetricsCollector', () => {
  test('start/finish 记录正确时长', () => {
    const collector = new MetricsCollector('test_pipeline', 'proj_001', 'user_001')
    const finish = collector.start('Compiler')
    finish({ diagnostics: { warnings: 0, errors: 0 } })

    const report = collector.buildReport()
    expect(report.stages.length).toBe(1)
    expect(report.stages[0].stage).toBe('Compiler')
    expect(report.stages[0].duration).toBeGreaterThanOrEqual(0)
    expect(report.stages[0].startTime).toBeLessThanOrEqual(report.stages[0].endTime)
  })

  test('多个 Stage 正确累积', () => {
    const collector = new MetricsCollector('test_pipeline', 'proj_001', 'user_001')
    const finish1 = collector.start('Normalizer')
    finish1({ inputSize: 100, diagnostics: { warnings: 1, errors: 0 } })

    const finish2 = collector.start('Compiler')
    finish2({ outputSize: 200, diagnostics: { warnings: 0, errors: 0 } })

    const report = collector.buildReport()
    expect(report.stages.length).toBe(2)
    expect(report.summary.totalWarnings).toBe(1)
    expect(report.summary.totalErrors).toBe(0)
    expect(report.stages[0].stage).toBe('Normalizer')
    expect(report.stages[0].inputSize).toBe(100)
    expect(report.stages[1].stage).toBe('Compiler')
    expect(report.stages[1].outputSize).toBe(200)
  })

  test('自动关闭未结束的 Stage', () => {
    const collector = new MetricsCollector('test', 'p', 'u')
    collector.start('Compiler') // 不 finish
    const finish2 = collector.start('GraphBuilder') // 自动 close Compiler
    finish2({ diagnostics: { warnings: 0, errors: 0 } })

    const report = collector.buildReport()
    expect(report.stages.length).toBe(2)
  })

  test('buildReport 输出完整结构', () => {
    const collector = new MetricsCollector('pipeline_x', 'proj_001', 'user_xyz')
    const finish = collector.start('Compiler')
    finish({ diagnostics: { warnings: 0, errors: 0 } })

    const report = collector.buildReport()
    expect(report.pipelineId).toBe('pipeline_x')
    expect(report.projectId).toBe('proj_001')
    expect(report.userId).toBe('user_xyz')
    expect(report.timestamp).toBeTruthy()
    expect(report.summary).toBeDefined()
    // 默认值
    expect(report.capabilityCoverage).toEqual({})
    expect(report.sps.overallRetentionRate).toBe(0)
    expect(report.architecture.driftStats.ssotViolations).toBe(0)
  })

  test('自定义 overrides 传递给 buildReport', () => {
    const collector = new MetricsCollector('p', 'p', 'u')
    collector.start('Compiler')({ diagnostics: { warnings: 0, errors: 0 } })

    const report = collector.buildReport({
      capabilityCoverage: { 'film.camera.path': { requested: 10, negotiated: 10, executed: 8, succeeded: 7 } },
      sps: { perCapability: {}, overallRetentionRate: 0.85 },
      stability: { compilerDeterminism: { runs: 100, hashConsistent: 99, hashConsistencyRate: 0.99, lastHash: 'abc' } },
      architecture: { driftStats: { ssotViolations: 0, kernelLeaks: 0, mutations: 0, businessAdapterLeaks: 0 } },
    })
    expect(report.capabilityCoverage['film.camera.path'].requested).toBe(10)
    expect(report.sps.overallRetentionRate).toBe(0.85)
    expect(report.stability.compilerDeterminism.hashConsistencyRate).toBe(0.99)
    expect(report.summary.sps).toBe(0.85)
    expect(report.summary.driftCount).toBe(0)
  })

  test('纯函数：不泄漏内部状态', () => {
    const c1 = new MetricsCollector('a', 'p', 'u')
    c1.start('Compiler')({ diagnostics: { warnings: 0, errors: 0 } })
    const r1 = c1.buildReport()
    const r2 = c1.buildReport()
    // 两次调用应产生相同结构
    expect(r1.stages.length).toBe(r2.stages.length)
  })
})

describe('Semantic Preservation Score (SPS)', () => {
  test('完全保留', () => {
    const sps = computeSPS(
      { 'film.camera.path': 'full', 'film.keyframe': 'full' },
      { 'film.camera.path': 'full', 'film.keyframe': 'full' },
    )
    expect(sps.overallRetentionRate).toBe(1)
    expect(sps.perCapability['film.camera.path'].retentionRate).toBe(1)
  })

  test('部分降级', () => {
    const sps = computeSPS(
      { 'film.camera.path': 'full', 'film.keyframe': 'full' },
      { 'film.camera.path': 'partial', 'film.keyframe': 'full' },
    )
    expect(sps.overallRetentionRate).toBeCloseTo(0.75, 2)  // (1+2)/(2+2) = 3/4
    expect(sps.perCapability['film.camera.path'].retentionRate).toBe(0.5)
  })

  test('完全丢失', () => {
    const sps = computeSPS(
      { 'film.camera.path': 'full' },
      { 'film.camera.path': 'none' },
    )
    expect(sps.overallRetentionRate).toBe(0)
  })

  test('未知能力按 none 处理', () => {
    const sps = computeSPS(
      { 'film.camera.path': 'full' },
      {},  // 无执行结果
    )
    expect(sps.overallRetentionRate).toBe(0)
  })
})

describe('Pipeline Report', () => {
  test('汇总数字正确', () => {
    const collector = new MetricsCollector('p', 'p', 'u')
    collector.start('Compiler')({ diagnostics: { warnings: 2, errors: 1 } })
    collector.start('GraphBuilder')({ diagnostics: { warnings: 0, errors: 0 } })
    collector.start('CapabilityPlanner')({ diagnostics: { warnings: 1, errors: 0 } })

    const report = collector.buildReport()
    expect(report.summary.totalWarnings).toBe(3)
    expect(report.summary.totalErrors).toBe(1)
    expect(report.stages.length).toBe(3)
  })
})
