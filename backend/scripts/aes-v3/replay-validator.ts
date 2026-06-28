/**
 * scripts/aes-v3/replay-validator.ts — 重放确定性验证
 *
 * 职责：验证两次连续重跑三层架构的核心功能是否产生相同结果。
 * 作用于 replay-engine 的输出（不是 traces 本身）。
 *
 * 这是 AES 内唯一执行层级的检查——它在 postbuild 运行，
 * 不参与运行时路径。
 */

import crypto from 'crypto'

export interface ReplayRunResult {
  steps: Array<{
    nodeId: string
    type: string
    status: string
    output?: any
    error?: string
  }>
}

/**
 * 验证两次 replay 运行的结构一致性。
 * 注意：只比较 nodeId 序列和 status，不比较 output（output 可能因时间不同而异）。
 */
export function assertReplayDeterminism(runA: ReplayRunResult, runB: ReplayRunResult): boolean {
  const normalize = (r: ReplayRunResult) =>
    r.steps.map(s => ({ nodeId: s.nodeId, type: s.type, status: s.status }))

  const a = normalize(runA)
  const b = normalize(runB)

  const hashA = crypto.createHash('sha256').update(JSON.stringify(a)).digest('hex')
  const hashB = crypto.createHash('sha256').update(JSON.stringify(b)).digest('hex')

  if (hashA !== hashB) {
    console.error('❌ [AES-v3] Replay 非确定性检测:')
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) {
        console.error(`   步骤 ${i}: ${JSON.stringify(a[i])} vs ${JSON.stringify(b[i])}`)
      }
    }
    return false
  }

  console.log('[AES-v3] ✅ Replay deterministic')
  return true
}
