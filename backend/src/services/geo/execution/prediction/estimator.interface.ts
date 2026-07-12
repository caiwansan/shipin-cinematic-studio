// ============================================================
// RC3-3 — IEstimator 接口
// ============================================================
// 估算器策略接口，支持不同的估算实现：
// - StaticEstimator（基于注册数据）
// - 未来：HistoryEstimator（基于历史数据）

import type { EstimationResult, PredictionContext } from './prediction.types'

export interface IEstimator {
  /** 估算器名称 */
  name: string
  /** 执行估算 */
  estimate(context: PredictionContext): Promise<EstimationResult>
}
