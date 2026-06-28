/**
 * governance/governance-controller.ts — 全局治理控制器
 *
 * 系统最高决策层，所有 optimizer 的决策必须经过此仲裁器审批。
 * 功能：
 * - 审批/拒绝/延迟优化提议
 * - 执行系统级策略
 * - 控制优化幅度防止振荡
 * - 提供降级模式切换
 */

import { OptimizationProposal, ProposalDecision } from './optimization-budget.js'
import { checkSystemPolicy } from './system-policy.js'
import { checkChangeRateLimit, recordChange } from './change-rate-limiter.js'
import { getSystemHealthScore } from './system-health.js'
import { auditLog } from './audit-log.js'

export type SystemAutonomyMode = 'FULL_AUTONOMY' | 'CONTROLLED_AUTONOMY' | 'DEGRADED_SAFE_MODE'

interface GovernanceState {
  mode: SystemAutonomyMode
  modeChangedAt: number
  freezeUntil: number  // 优化冻结截止时间
  proposalsApproved: number
  proposalsRejected: number
  proposalsDelayed: number
  rollbackTriggered: number
}

const state: GovernanceState = {
  mode: 'CONTROLLED_AUTONOMY',
  modeChangedAt: Date.now(),
  freezeUntil: 0,
  proposalsApproved: 0,
  proposalsRejected: 0,
  proposalsDelayed: 0,
  rollbackTriggered: 0,
}

/**
 * 提交优化提议给治理层审批
 */
export async function reviewProposal(proposal: OptimizationProposal): Promise<{
  decision: ProposalDecision
  reason?: string
  delayMs?: number
}> {
  const health = getSystemHealthScore()

  // 1. 如果系统处于冻结期，全部拒绝
  if (Date.now() < state.freezeUntil) {
    auditLog('governance-controller', 'reject', proposal.action,
      `System frozen until ${new Date(state.freezeUntil).toISOString()}`, proposal)
    state.proposalsRejected++
    return { decision: 'reject', reason: 'System optimization frozen' }
  }

  // 2. 检查变更频率限制
  const rateCheck = checkChangeRateLimit(proposal.action)
  if (!rateCheck.allowed) {
    auditLog('governance-controller', 'delay', proposal.action,
      `Rate limited: ${rateCheck.reason}`, proposal)
    state.proposalsDelayed++
    return { decision: 'delay', reason: rateCheck.reason, delayMs: rateCheck.retryAfterMs }
  }

  // 3. 检查系统策略
  const policyCheck = await checkSystemPolicy(proposal)
  if (!policyCheck.allowed) {
    auditLog('governance-controller', 'reject', proposal.action,
      `Policy violation: ${policyCheck.reason}`, proposal)
    state.proposalsRejected++
    return { decision: 'reject', reason: policyCheck.reason }
  }

  // 4. 根据自治模式做最终决策
  switch (state.mode) {
    case 'DEGRADED_SAFE_MODE':
      // 降级模式：只允许自愈操作
      if (proposal.source !== 'self-healing') {
        state.proposalsRejected++
        return { decision: 'reject', reason: 'System in DEGRADED_SAFE_MODE, only self-healing allowed' }
      }
      // 自愈操作也要限速（每分钟最多1次）
      recordChange('self-healing')
      auditLog('governance-controller', 'approve', proposal.action,
        'Approved (self-healing in safe mode)', proposal)
      state.proposalsApproved++
      return { decision: 'approve' }

    case 'CONTROLLED_AUTONOMY':
      // 受控模式：允许优化但有预算约束
      recordChange(proposal.action)
      auditLog('governance-controller', 'approve', proposal.action,
        'Approved (controlled autonomy)', proposal)
      state.proposalsApproved++
      return { decision: 'approve' }

    case 'FULL_AUTONOMY':
      // 全自主模式：信任 optimizer
      auditLog('governance-controller', 'approve', proposal.action,
        'Approved (full autonomy)', proposal)
      state.proposalsApproved++
      return { decision: 'approve' }
  }
}

/**
 * 检查是否需要切换到降级模式
 */
export function evaluateAutonomyMode(): SystemAutonomyMode {
  const health = getSystemHealthScore()

  if (health.status === 'CRITICAL') {
    if (state.mode !== 'DEGRADED_SAFE_MODE') {
      console.warn(`[Governance] ⛔ Switching to DEGRADED_SAFE_MODE (health score: ${health.score})`)
      state.mode = 'DEGRADED_SAFE_MODE'
      state.modeChangedAt = Date.now()
      auditLog('governance-controller', 'system', 'MODE_CHANGE',
        `Switched to DEGRADED_SAFE_MODE (health: ${health.score})`)
    }
  } else if (health.status === 'DEGRADED') {
    if (state.mode === 'FULL_AUTONOMY') {
      state.mode = 'CONTROLLED_AUTONOMY'
      state.modeChangedAt = Date.now()
      auditLog('governance-controller', 'system', 'MODE_CHANGE',
        `Downgraded to CONTROLLED_AUTONOMY (health: ${health.score})`)
    }
  } else {
    // HEALTHY — 如果之前是降级模式，逐渐恢复
    if (state.mode === 'DEGRADED_SAFE_MODE') {
      const duration = Date.now() - state.modeChangedAt
      if (duration > 300_000) { // 至少保持 5 分钟降级
        state.mode = 'CONTROLLED_AUTONOMY'
        state.modeChangedAt = Date.now()
        console.log('[Governance] ✅ Recovered to CONTROLLED_AUTONOMY')
        auditLog('governance-controller', 'system', 'MODE_CHANGE',
          `Recovered to CONTROLLED_AUTONOMY after ${Math.round(duration / 1000)}s`)
      }
    }
  }

  return state.mode
}

/**
 * 手动设置自治模式
 */
export function setAutonomyMode(mode: SystemAutonomyMode) {
  state.mode = mode
  state.modeChangedAt = Date.now()
  auditLog('governance-controller', 'manual', 'MODE_CHANGE',
    `Manual switch to ${mode}`)
}

/**
 * 冻结优化一段时间
 */
export function freezeOptimization(durationMs: number) {
  state.freezeUntil = Date.now() + durationMs
  auditLog('governance-controller', 'system', 'FREEZE',
    `Optimization frozen for ${durationMs}ms`)
}

/**
 * 获取治理状态
 */
export function getGovernanceState() {
  const health = getSystemHealthScore()
  return {
    mode: state.mode,
    modeChangedAt: new Date(state.modeChangedAt).toISOString(),
    frozen: Date.now() < state.freezeUntil,
    freezeRemaining: Math.max(0, state.freezeUntil - Date.now()),
    modeDuration: Math.round((Date.now() - state.modeChangedAt) / 1000) + 's',
    proposalsApproved: state.proposalsApproved,
    proposalsRejected: state.proposalsRejected,
    proposalsDelayed: state.proposalsDelayed,
    rollbackTriggered: state.rollbackTriggered,
    health: {
      score: health.score,
      status: health.status,
    },
  }
}
