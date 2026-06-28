#!/usr/bin/env tsx
/**
 * Phase 7A-6 — Real Execution Benchmark Validation
 */

import { WorkloadGenerator } from '../../src/tests/benchmark/workloads/workload-generator.js'
import { NaiveDagExecutor, StaticPolicyRunner, NoMutationRunner } from '../../src/tests/benchmark/baselines/baseline-executors.js'
import { LatencyMetrics, CostMetricsCalculator, EfficiencyScoreCalculator } from '../../src/tests/benchmark/metrics/metrics.js'
import { PolicyDriftTracker, MutationFrequencyAnalyzer, SemanticDriftChecker } from '../../src/tests/benchmark/drift/drift-analysis.js'
import { HoursRunner } from '../../src/tests/benchmark/long-run/hours-runner.js'
import { BaselinesComparison, RegressionDetector } from '../../src/tests/benchmark/comparison/benchmark-comparator.js'
import { BenchmarkSuite, DEFAULT_BENCHMARK_CONFIG, HEAVY_BENCHMARK_CONFIG } from '../../src/tests/benchmark/runner/benchmark-suite.js'
import { createDefaultPolicy } from '../../src/kernel/optimization-policy/policy-state.js'
import type { OptimizationPolicy } from '../../src/kernel/optimization-policy/types.js'

async function main() {
  let passed = 0
  let failed = 0

  function test(name: string, fn: () => void) {
    try {
      fn()
      passed++
      console.log(`  ✅ ${name}`)
    } catch (e) {
      failed++
      console.log(`  ❌ ${name}: ${(e as Error).message}`)
      process.exitCode = 1
    }
  }

  async function runTest(name: string, fn: () => Promise<void>) {
    try {
      await fn()
      passed++
      console.log(`  ✅ ${name}`)
    } catch (e) {
      failed++
      console.log(`  ❌ ${name}: ${(e as Error).message}`)
      process.exitCode = 1
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg)
  }

  console.log('\n=== Phase 7A-6: Real Execution Benchmark Validation ===\n')

  // ============================================================
  // 1. Workload Generator
  // ============================================================
  {
    console.log('--- 1. Workload Generator ---\n')
    const gen = new WorkloadGenerator()

    const video = gen.generate('VIDEO_PIPELINE', 42, 5)
    test('VIDEO_PIPELINE has nodes and edges', () => {
      assert(video.nodes.length > 0, 'has nodes')
      assert(video.edges.length > 0, 'has edges')
      assert(video.type === 'VIDEO_PIPELINE', 'correct type')
    })

    const llm = gen.generate('LLM_STREAM_GRAPH', 42, 5)
    test('LLM_STREAM_GRAPH has nodes and edges', () => {
      assert(llm.nodes.length > 0, 'has nodes')
      assert(llm.edges.length > 0, 'has edges')
    })

    const asyncGraph = gen.generate('ASYNC_JOB_CLUSTER', 42, 5)
    test('ASYNC_JOB_CLUSTER has nodes and edges', () => {
      assert(asyncGraph.nodes.length > 0, 'has nodes')
      assert(asyncGraph.edges.length > 0, 'has edges')
    })

    const mixed = gen.generate('MIXED_PRODUCTION', 42, 5)
    test('MIXED_PRODUCTION has nodes and edges', () => {
      assert(mixed.nodes.length > 0, 'has nodes')
      assert(mixed.edges.length > 0, 'has edges')
    })

    const all = gen.generateAll(42, 5)
    test('generateAll produces all 4 types', () => {
      assert(all.length === 4, '4 workloads')
      const types = new Set(all.map(w => w.type))
      assert(types.size === 4, '4 distinct types')
    })

    const a = gen.generate('VIDEO_PIPELINE', 42, 5)
    const b = gen.generate('VIDEO_PIPELINE', 42, 5)
    test('workload generation is deterministic', () => {
      assert(JSON.stringify(a) === JSON.stringify(b), 'same seed → same graph')
    })
  }

  // ============================================================
  // 2. Baseline Executors
  // ============================================================
  {
    console.log('--- 2. Baseline Executors ---\n')
    const gen = new WorkloadGenerator()
    const graph = gen.generate('VIDEO_PIPELINE', 42, 5)

    const naive = new NaiveDagExecutor()
    const naiveResult = naive.execute(graph)
    test('NaiveDagExecutor produces result', () => {
      assert(naiveResult.totalLatency > 0, 'has latency')
      assert(naiveResult.totalCost > 0, 'has cost')
      assert(naiveResult.nodeCount === graph.nodes.length, 'node count matches')
    })

    const staticRunner = new StaticPolicyRunner()
    const staticResult = staticRunner.execute(graph)
    test('StaticPolicyRunner produces result', () => {
      assert(staticResult.totalLatency > 0, 'has latency')
      assert(staticResult.nodeCount === graph.nodes.length, 'node count matches')
    })

    test('StaticPolicy has lower latency than naive', () => {
      assert(staticResult.totalLatency < naiveResult.totalLatency, 'static is faster than naive')
    })

    const noMutation = new NoMutationRunner()
    const noMutResult = noMutation.execute(graph)
    test('NoMutationRunner produces result', () => {
      assert(noMutResult.totalLatency > 0, 'has latency')
    })
  }

  // ============================================================
  // 3. Metrics
  // ============================================================
  {
    console.log('--- 3. Metrics ---\n')
    const latencyMetrics = new LatencyMetrics()
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const dist = latencyMetrics.compute(values)
    test('P50 is correct', () => assert(dist.p50 === 55, `expected 55, got ${dist.p50}`))
    test('P95 is correct', () => assert(dist.p95 >= 95, `expected >= 95, got ${dist.p95}`))
    test('P99 is correct', () => assert(dist.p99 >= 99, `expected >= 99, got ${dist.p99}`))

    const costMetrics = new CostMetricsCalculator()
    const costResult = costMetrics.compute([10, 20, 30], [5, 10, 15], 3)
    test('cost metrics compute correctly', () => {
      assert(costResult.totalComputeCost === 60, 'compute cost')
      assert(costResult.totalIoCost === 30, 'io cost')
    })

    const efficiency = new EfficiencyScoreCalculator()
    const score = efficiency.compute(75, 100, 85, 100)
    test('efficiency score computed', () => {
      assert(score.gain === 25, `gain = ${score.gain}`)
      assert(score.normalizedScore === 0.25, `normalized = ${score.normalizedScore}`)
    })
  }

  // ============================================================
  // 4. Drift Analysis
  // ============================================================
  {
    console.log('--- 4. Drift Analysis ---\n')
    const tracker = new PolicyDriftTracker()
    const stableHistory: OptimizationPolicy[] = Array.from({ length: 10 }, () => createDefaultPolicy())
    test('identical policies → no drift', () => {
      const metrics = tracker.track(stableHistory)
      assert(metrics.variance === 0, 'zero variance')
      assert(metrics.stabilityScore === 1, 'perfect stability')
    })

    const driftingHistory: OptimizationPolicy[] = Array.from({ length: 10 }, (_, i) => {
      const p = createDefaultPolicy()
      p.weights.latency = 0.5 + i * 0.1
      return p
    })
    test('drifting policies detected', () => {
      const metrics = tracker.track(driftingHistory)
      assert(metrics.variance > 0, 'has variance')
      assert(metrics.driftRate > 0, 'has drift rate')
    })
    test('drift bounds check works', () => {
      assert(tracker.isWithinBounds(stableHistory), 'stable is within bounds')
    })

    const mutationAnalyzer = new MutationFrequencyAnalyzer()
    const timestamps = Array.from({ length: 60 }, (_, i) => i * 60000)
    const freq = mutationAnalyzer.analyze(timestamps, 60)
    test('mutation frequency computed', () => {
      assert(freq.perMinute > 0, 'has frequency')
      assert(freq.consistencyScore > 0, 'has consistency')
    })

    const semanticChecker = new SemanticDriftChecker()
    const allValid = Array.from({ length: 10 }, (_, i) => ({ time: i, validNodeTypes: true, validPolicy: true, isAcyclic: true }))
    test('semantic drift passes for valid data', () => {
      assert(semanticChecker.check(allValid).invariantsPassed === true, 'all passed')
    })
    const someInvalid = [
      ...allValid.slice(0, 3),
      { time: 3, validNodeTypes: false, validPolicy: true, isAcyclic: true },
      ...allValid.slice(4),
    ]
    test('semantic drift detects failures', () => {
      const result = semanticChecker.check(someInvalid)
      assert(result.invariantsPassed === false, 'detected failures')
      assert(result.failedAtTimestep.length >= 1, 'reports failure timesteps')
    })
  }

  // ============================================================
  // 5. Long Run
  // ============================================================
  {
    console.log('--- 5. Long Run ---\n')
    const gen = new WorkloadGenerator()
    const graphs = gen.generateAll(42, 5)
    const hoursRunner = new HoursRunner()
    await runTest('simulation produces ticks', async () => {
      const shortRun = await hoursRunner.simulate(graphs, 10, 4)
      assert(shortRun.ticks.length > 0, 'has ticks')
      assert(shortRun.totalTicks === 40, '10min * 4 ticks/min = 40 ticks')
    })

    await runTest('simulation with policy history tracks drift', async () => {
      const ph: OptimizationPolicy[] = Array.from({ length: 40 }, (_, i) => {
        const p = createDefaultPolicy()
        p.weights.latency = 0.5 + (i % 10) * 0.02
        return p
      })
      const withPolicy = await hoursRunner.simulate(graphs, 10, 4, ph)
      assert(withPolicy.driftMetrics !== null, 'has drift metrics')
      assert(['improving', 'stable', 'degrading', 'oscillating'].includes(withPolicy.latencyTrend),
        `valid trend: ${withPolicy.latencyTrend}`)
    })

    await runTest('quick stability check works', async () => {
      const quick = await hoursRunner.quickStabilityCheck(graphs)
      assert(typeof quick.stable === 'boolean', 'returns boolean')
      assert(typeof quick.score === 'number', 'returns score')
    })
  }

  // ============================================================
  // 6. Comparison Engine
  // ============================================================
  {
    console.log('--- 6. Comparison Engine ---\n')
    const comparator = new BaselinesComparison()
    const systemResult = { label: 'system', totalLatency: 75, avgLatency: 15, totalCost: 85, nodeCount: 5, edgeCount: 10 }
    const baselines = [
      { label: 'naive', totalLatency: 100, avgLatency: 20, totalCost: 100, nodeCount: 5, edgeCount: 10 },
      { label: 'static', totalLatency: 85, avgLatency: 17, totalCost: 90, nodeCount: 5, edgeCount: 10 },
    ]
    const compResult = comparator.compare(systemResult, baselines)
    test('comparison produces correct results', () => {
      assert(compResult.comparisons.length === 2, '2 baseline comparisons')
      assert(compResult.comparisons[0].latencyImprovement === 25, '25ms improvement vs naive')
    })

    const gaps = comparator.computeGaps(systemResult.totalLatency, systemResult.totalCost, [
      { label: 'naive', latency: 100, cost: 100 },
    ])
    test('efficiency gaps computed', () => {
      assert(gaps[0].isBetter === true, 'system is better')
    })

    const detector = new RegressionDetector()
    test('no regression detected', () => {
      assert(detector.detectRegression(compResult.comparisons[0]).isRegressed === false, 'no regression')
    })
    test('regression detected when system is slower', () => {
      const badComp = { baseline: 'naive', systemLatency: 120, baselineLatency: 100, latencyImprovement: -20, systemCost: 150, baselineCost: 100, costDelta: 50, overheadRatio: 1.2 }
      assert(detector.detectRegression(badComp).isRegressed === true, 'regression detected')
    })
  }

  // ============================================================
  // 7. Full Benchmark Suite
  // ============================================================
  {
    console.log('--- 7. Full Benchmark Suite ---\n')
    const suite = new BenchmarkSuite()

    await runTest('Default benchmark suite completes', async () => {
      const report = await suite.runAll(DEFAULT_BENCHMARK_CONFIG)
      assert(report.verdict !== undefined, 'has verdict')
      assert(report.comparisons.length > 0, 'has comparisons')
      assert(report.summaries.length > 0, 'has summaries')
    })

    await runTest('Heavy benchmark suite completes', async () => {
      const report = await suite.runAll(HEAVY_BENCHMARK_CONFIG)
      assert(report.verdict !== undefined, 'has verdict')
    })

    await runTest('Quick check works', async () => {
      const quick = await suite.quickCheck()
      assert(typeof quick.stable === 'boolean', 'stable boolean')
      assert(['SUPERIOR', 'EQUIVALENT', 'DEGRADED', 'UNSTABLE'].includes(quick.verdict),
        `valid verdict: ${quick.verdict}`)
    })

    await runTest('Report formatting produces readable output', async () => {
      const report = await suite.runAll(DEFAULT_BENCHMARK_CONFIG)
      const formatted = suite.formatReport(report)
      assert(formatted.includes('Benchmark Report'), 'contains title')
      assert(formatted.includes(report.verdict), 'contains verdict')
    })

    await runTest('Default benchmark produces SUPERIOR or EQUIVALENT verdict', async () => {
      const report = await suite.runAll(DEFAULT_BENCHMARK_CONFIG)
      assert(report.verdict === 'SUPERIOR' || report.verdict === 'EQUIVALENT',
        `expected SUPERIOR or EQUIVALENT, got ${report.verdict}`)
    })
  }

  console.log(`\n=== Phase 7A-6: ${passed}/${passed + failed} passed ===\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
