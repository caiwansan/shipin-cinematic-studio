// causal-hardening/intercept/mutation-firewall.ts — 防原型污染 / noop

import { KernelViolation } from './pre-apply-gate'

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (!deepEqual(a[k], b[k])) return false
  }
  return true
}

export function mutationFirewall(payload: any) {
  // 1. 原型污染检测
  if (payload.__proto__ || payload.constructor) {
    throw new KernelViolation('PROTOTYPE_INJECTION_BLOCKED')
  }

  // 2. NOOP mutation 检测：diff 模式的 before === after
  if (payload.diff && payload.before !== undefined && payload.after !== undefined) {
    if (deepEqual(payload.before, payload.after)) {
      throw new KernelViolation('NOOP_MUTATION_BLOCKED')
    }
  }

  // 3. payload 字段数量上限（防巨型 payload）
  const keys = Object.keys(payload).filter(k => !['projectId', 'entityType', 'entityId', 'data', 'diff', 'reason', 'batch', 'parentEventId'].includes(k))
  if (keys.length > 10) {
    throw new KernelViolation(`PAYLOAD_TOO_LARGE: ${keys.length} unexpected keys`)
  }
}
