/**
 * benchmark/registry/benchmark-registry.ts — Benchmark 领域注册中心
 *
 * 组装所有 Benchmark 模块，对外提供统一入口。
 * GEO 的其他模块（Health Report / Optimization / Verification / Monitor）
 * 只需通过此 Registry 访问 Benchmark 能力。
 */
import { ProviderRegistry } from '../provider/registry'
import { DatasetLoader } from '../dataset/loader'
import { ClaimEvaluator } from '../judge/claim-evaluator'
import { DimensionScorer } from '../judge/dimension-scorer'
import { BIICalculator } from '../calculator/bii-calculator'
import { ReportGenerator } from '../report/report-generator'
import { BenchmarkRunner } from '../runner/benchmark-runner'
import {
  BenchmarkJob, BenchmarkProvider, BenchmarkReport,
  BenchmarkQuestion, ClaimEvaluation, BIIDimension,
} from '../types'

export class BenchmarkRegistry {
  readonly providers: ProviderRegistry
  readonly datasets: DatasetLoader
  readonly claimEvaluator: ClaimEvaluator
  readonly dimensionScorer: DimensionScorer
  readonly biiCalculator: BIICalculator
  readonly reportGenerator: ReportGenerator
  readonly runner: BenchmarkRunner

  constructor() {
    this.providers = new ProviderRegistry()
    this.datasets = new DatasetLoader()
    this.claimEvaluator = new ClaimEvaluator()
    this.dimensionScorer = new DimensionScorer()
    this.biiCalculator = new BIICalculator()
    this.reportGenerator = new ReportGenerator()
    this.runner = new BenchmarkRunner(this.providers, this.datasets)
  }

  /**
   * 注册一个 AI Provider
   */
  registerProvider(provider: BenchmarkProvider): void {
    this.providers.register(provider)
  }
}

export { ProviderRegistry } from '../provider/registry'
export { DatasetLoader } from '../dataset/loader'
export { ClaimEvaluator } from '../judge/claim-evaluator'
export { DimensionScorer } from '../judge/dimension-scorer'
export { BIICalculator } from '../calculator/bii-calculator'
export { ReportGenerator } from '../report/report-generator'
export { BenchmarkRunner } from '../runner/benchmark-runner'
export * from '../types'
