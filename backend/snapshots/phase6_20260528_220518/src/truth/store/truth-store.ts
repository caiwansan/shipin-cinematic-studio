/**
 * truth/store/truth-store.ts — Truth 存储层
 *
 * Phase 7, Rule 1: truth 与 execution 分离存储
 * memory store，生产环境应接入数据库
 */

import type { TruthEntry } from '../truth-model.js'

const truthDB = new Map<string, TruthEntry>()
const MAX_TRUTHS = 500

export function storeTruth(taskId: string, entry: TruthEntry): void {
  truthDB.set(taskId, entry)

  // 限制内存
  if (truthDB.size > MAX_TRUTHS) {
    const firstKey = truthDB.keys().next().value
    if (firstKey) truthDB.delete(firstKey)
  }

  console.log(`[truth/store] ✅ stored: taskId=${taskId}, ` +
    `provider=${entry.winner.provider}, score=${aggregateScore(entry.score).toFixed(3)}`)
}

export function getTruth(taskId: string): TruthEntry | undefined {
  return truthDB.get(taskId)
}

export function getAllTruths(): TruthEntry[] {
  return Array.from(truthDB.values()).reverse().slice(0, 100)
}

function aggregateScore(score: TruthEntry['score']): number {
  const w = { completeness: 0.3, correctness: 0.3, stability: 0.2, costEfficiency: 0.2 }
  return score.completeness * w.completeness +
    score.correctness * w.correctness +
    score.stability * w.stability +
    score.costEfficiency * w.costEfficiency
}
