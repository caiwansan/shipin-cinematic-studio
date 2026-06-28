/**
 * truth/consensus-engine.ts — 共识执行层
 *
 * Phase 7, Rule 3: 多 provider 输出必须收敛
 * 在所有可用 provider 上执行后仲裁，返回规范结果
 */

import { arbitrate } from './arbitration-engine.js'
import { storeTruth } from './store/truth-store.js'
import type { ExecutionResult } from './truth-model.js'

/**
 * consensusExecute — 在所有 provider 上执行，仲裁出唯一结果
 *
 * 当前实现为单 provider 执行（实际场景可能有多个 provider 并行）
 */
export async function consensusExecute(
  taskId: string,
  executeOnPrimary: () => Promise<ExecutionResult>,
): Promise<ExecutionResult> {
  // 未来：并行在所有可用 provider 上执行
  // Phase 7, Rule 3: 多 provider 输出收敛
  // const allProviders = getAllProviderConfigs()
  // const results = await Promise.all(allProviders.map(p => executeOnOneProvider(task, p)))

  // 当前：单 provider 执行
  const primaryResult = await executeOnPrimary()

  // 仲裁（单结果时直接评分）
  const arbResult = await arbitrate([primaryResult])

  // 存储 truth
  const entry = {
    taskId,
    winner: arbResult.winner,
    score: arbResult.score,
    allResults: [arbResult.winner],
    timestamp: Date.now(),
  }
  storeTruth(taskId, entry)

  return arbResult.winner
}
