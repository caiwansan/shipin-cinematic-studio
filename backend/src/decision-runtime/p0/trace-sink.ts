/**
 * trace-sink.ts — Phase P-0 Trace Sink
 *
 * ============================================================
 * 所有现实使用数据只进入 D-3 / D-3.5。
 * 不写回 B 系列，不写回 bridge，不修改任何核心。
 *
 * Trace-Only Learning:
 *   系统只学习"结果统计"，不学习"执行逻辑"
 * ============================================================
 */

import { SystemObservatory, systemObservatory, ExecutionTrace } from '../invocation/d3-observatory.js'
import { NormalizationLayer, normalizationLayer, NormalizedReport, ProjectedScore } from '../invocation/d35-normalization.js'
import { Baseline } from '../invocation/d35-normalization.js'

export interface SinkMetrics {
  stability: number
  fidelity: number
  consistency: number
  trustRate: number
}

export class TraceSink {
  private observatory: SystemObservatory
  private normalization: NormalizationLayer
  private baseline?: Baseline

  constructor(observatory?: SystemObservatory, baseline?: Baseline) {
    this.observatory = observatory ?? systemObservatory
    this.normalization = normalizationLayer
    this.baseline = baseline
  }

  /**
   * record(trace): 记录执行 trace
   *
   * 只写入 D-3 observatory。
   * 不修改任何其他系统状态。
   */
  record(trace: ExecutionTrace): void {
    this.observatory.record(trace)
  }

  /**
   * normalize(trace): 归一化单条 trace
   */
  normalize(trace: ExecutionTrace): SinkMetrics {
    const report = this.normalization.evaluateTrace(trace, this.baseline)
    return {
      stability: report.metrics.stability,
      fidelity: report.metrics.fidelity,
      consistency: report.metrics.consistency,
      trustRate: report.metrics.trustRate,
    }
  }

  /**
   * getSummary(): 获取当前观测摘要
   */
  getSummary(): any {
    return this.observatory.summary()
  }

  /**
   * getTraceCount(): 已记录 trace 数
   */
  getTraceCount(): number {
    return this.observatory.getTraces().length
  }
}
