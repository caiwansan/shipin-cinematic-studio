// causal-hardening/kernel-patch.ts — 注入脚本（供 kernel.ts 导入）

import { preApplyGate, KernelViolation } from './intercept/pre-apply-gate.js'
import { RouteLock } from './intercept/route-lock.js'
import { mutationFirewall } from './intercept/mutation-firewall.js'
import { CausalHardEnforcer } from './enforcement/hard-enforcer.js'
import { CausalConstraintEngine } from '../causal-constraints/constraint-engine.js'

export { KernelViolation }
export { preApplyGate, RouteLock, mutationFirewall }
export { CausalHardEnforcer }

/**
 * 一次性注入所有 v1.3 Hardening Gates
 * 由 kernel.ts 在 command() 开始时调用
 */
export function causalHardGate(command: {
  source: string
  target: string
  type: string
  payload: {
    projectId: string
    entityId?: string
    parentEventId?: string
    reason?: string
  }
}, enforcer?: CausalHardEnforcer) {
  // 1. Pre-Apply Gate
  preApplyGate(command)

  // 2. Route Lock
  RouteLock.validate(command.target)

  // 3. Mutation Firewall
  mutationFirewall(command.payload)

  // 4. Causal Hard Enforcer
  if (enforcer) {
    enforcer.enforce({
      id: command.payload.entityId || 'cmd',
      source: command.source,
      target: command.target,
      type: command.type,
      payload: command.payload,
    })
  }
}
