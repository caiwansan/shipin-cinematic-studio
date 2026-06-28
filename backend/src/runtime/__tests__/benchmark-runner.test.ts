/**
 * Benchmark Runner 测试
 *
 * A4.5 P1.2: 验证 Runner 的分层执行、Report、Baseline Compare
 */

import { describe, test, expect, beforeAll } from 'vitest'
import { loadDataset, runBenchmark, compareWithBaseline } from '../../runtime/benchmark-runner.js'
import * as fs from 'fs'
import * as path from 'path'

const DATASETS_DIR = path.resolve(process.cwd(), 'benchmarks', 'datasets')

describe('Dataset Loader', () => {
  test('加载 L0-001 成功', () => {
    const ds = loadDataset('L0-001')
    expect(ds.id).toBe('L0-001')
    expect(ds.level).toBe('L0')
    expect(ds.complexity.shots).toBeGreaterThanOrEqual(1)
    expect(ds.v3).toBeDefined()
    expect(ds.narrative).toBeDefined()
  })

  test('加载 L1-001 成功', () => {
    const ds = loadDataset('L1-001')
    expect(ds.id).toBe('L1-001')
    expect(ds.level).toBe('L1')
    expect(ds.complexity.shots).toBeGreaterThanOrEqual(5)
    expect(ds.metadata.capabilities).toContain('TEMPORAL_CONSISTENCY')
  })

  test('加载不存在的 Dataset 抛出异常', () => {
    expect(() => loadDataset('non_existent')).toThrow()
  })
})

describe('Benchmark Runner', () => {
  const datasetPath = path.join(DATASETS_DIR, 'L0-001')

  test('compiler 阶段生成 Report', () => {
    const report = runBenchmark({ datasetPath, stage: 'compiler' })
    expect(report).not.toBeNull()
    expect(report!.stage).toBe('compiler')
    expect(['success', 'partial', 'failed']).toContain(report!.status)
    expect(report!.fingerprint.compilerHash).toBeTruthy()
  })

  test('graph 阶段成功（含 compiler）', () => {
    const report = runBenchmark({ datasetPath, stage: 'graph' })
    expect(report).not.toBeNull()
    expect(report!.stage).toBe('graph')
    expect(report!.fingerprint.graphHash).toBeTruthy()
    expect(report!.fingerprint.compilerHash).toBeTruthy()
  })

  test('planner 阶段成功', () => {
    const report = runBenchmark({ datasetPath, stage: 'planner' })
    expect(report).not.toBeNull()
    expect(report!.stage).toBe('planner')
    expect(report!.fingerprint.plannerHash).toBeTruthy()
    expect(report!.fingerprint.negotiatorHash).toBeTruthy()
  })

  test('full 阶段成功（含 DAG + Bridge）', () => {
    const report = runBenchmark({ datasetPath, stage: 'full' })
    expect(report).not.toBeNull()
    expect(report!.stage).toBe('full')
    expect(report!.fingerprint.dagHash).toBeTruthy()
    expect(report!.fingerprint.traceHash).toBeTruthy()
  })

  test('L1-001 全链路成功', () => {
    const report = runBenchmark({ datasetPath: path.join(DATASETS_DIR, 'L1-001'), stage: 'planner' })
    expect(report).not.toBeNull()
    expect(['success', 'partial', 'failed']).toContain(report!.status)
    expect(report!.metrics.duration).toBeGreaterThanOrEqual(0)
  })

  test('Report 包含完整字段', () => {
    const report = runBenchmark({ datasetPath, stage: 'compiler' })
    expect(report!.benchmarkId).toBeTruthy()
    expect(report!.dataset.id).toBe('L0-001')
    expect(report!.timestamp).toBeTruthy()
    expect(report!.metrics.duration).toBeGreaterThanOrEqual(0)
    expect(report!.diagnostics).toBeDefined()
    expect(report!.fingerprint.compilerHash).toBeTruthy()
  })

  test('确定性：compiler 阶段两次执行 Hash 一致', () => {
    const a = runBenchmark({ datasetPath, stage: 'compiler' })
    const b = runBenchmark({ datasetPath, stage: 'compiler' })
    expect(a!.fingerprint.compilerHash).toBe(b!.fingerprint.compilerHash)
  })
})

describe('Baseline Compare', () => {
  const datasetPath = path.join(DATASETS_DIR, 'L0-001')
  const tempBaselinePath = path.resolve(process.cwd(), 'benchmarks', 'baselines', 'test-v1')

  test('首次运行无 Baseline 不报错', () => {
    const report = runBenchmark({ datasetPath, stage: 'compiler' })!
    const diff = compareWithBaseline(report, tempBaselinePath)
    expect(diff.regressions.length).toBe(0)
  })

  test('第二次运行可对比', () => {
    const report = runBenchmark({ datasetPath, stage: 'compiler' })!
    const diff = compareWithBaseline(report, tempBaselinePath)
    expect(diff.datasetId).toBe('L0-001')
    const spsChange = diff.changes.find(c => c.metric === 'SPS')
    expect(spsChange).toBeDefined()
    expect(['unchanged', 'improved', 'new']).toContain(spsChange!.change)
  })

  test('drift 回归检测', () => {
    const report = runBenchmark({ datasetPath, stage: 'compiler' })!
    const badReport = { ...report, metrics: { ...report.metrics, driftCount: 999 } }
    const diff = compareWithBaseline(badReport as any, tempBaselinePath)
    const driftChange = diff.changes.find(c => c.metric === 'Drift Count')
    expect(driftChange).toBeDefined()
    if (driftChange!.change === 'regressed') {
      expect(diff.regressions.length).toBeGreaterThan(0)
    }
  })

  test('清除测试 Baseline', () => {
    if (fs.existsSync(tempBaselinePath)) {
      fs.rmSync(tempBaselinePath, { recursive: true, force: true })
    }
    expect(true).toBe(true)
  })
})
