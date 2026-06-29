// P3.2 — Execution Mode Resolver (Sprint 1)
// ============================================================
// 根据 project context 自动判断推荐执行模式
//
// 输入:
//   - 用户 tier
//   - step 数量
//   - 是否有 previous failure
//   - 项目状态
//
// 输出:
//   - 推荐模式
//   - 可选模式列表
// ============================================================

import type { ExecutionMode, ExecutionPolicy } from './executionPolicy'
import { getDefaultPolicy } from './executionPolicy'
import { ExecutionStateManager } from '~/utils/executionStateManager'
import type { CapabilityId } from '~/utils/geoCapability'

export interface ModeRecommendation {
  recommended: ExecutionMode
  available: ExecutionMode[]
  reasoning: string
}

const TIER_ORDER: Record<string, number> = {
  FREE: 0,
  VIP_1: 1,
  VIP_2: 2,
  ADMIN: 99,
}

/**
 * 根据 tier 返回可用模式
 */
export function getAvailableModes(tier: string): ExecutionMode[] {
  const level = TIER_ORDER[tier] ?? 0
  const modes: ExecutionMode[] = ['auto']
  if (level >= TIER_ORDER['VIP_1']) modes.push('step')
  if (level >= TIER_ORDER['VIP_2']) modes.push('debug')
  return modes
}

/**
 * 推荐最优模式
 */
export function recommendMode(
  tier: string,
  projectId: string,
  stepIds: CapabilityId[]
): ModeRecommendation {
  const stateMgr = ExecutionStateManager.getInstance()
  const available = getAvailableModes(tier)

  // 默认推荐 'auto'
  let recommended: ExecutionMode = 'auto'
  const reasons: string[] = []

  // 检查是否有失败的 steps
  const hasFailure = stepIds.some(id => {
    const ctx = stateMgr.getState(projectId, id)
    return ctx.state === 'FAILED' || ctx.state === 'DRIFTED'
  })

  if (hasFailure && available.includes('step')) {
    recommended = 'step'
    reasons.push('存在失败/不一致 steps，推荐逐步确认')
  }

  // 检查 steps 数量
  if (stepIds.length >= 3 && available.includes('step')) {
    if (recommended === 'auto') {
      // 如果用户没有失败历史，但步骤多，给 step 可选项但不强制
      reasons.push('步骤较多，可选择逐步推进')
    }
  }

  // VIP_2+ 且之前失败过，推荐 debug
  if (hasFailure && available.includes('debug')) {
    recommended = 'debug'
    reasons.push('存在失败记录，推荐调试模式以查看中间结果')
  }

  return {
    recommended,
    available,
    reasoning: reasons.join('；') || '自动执行模式',
  }
}

/**
 * 根据 policy + context 确定当前状态的 log level
 */
export function resolveLogLevel(policy: ExecutionPolicy): 'minimal' | 'normal' | 'verbose' {
  if (policy.mode === 'debug') return 'verbose'
  if (policy.mode === 'step') return 'normal'
  return policy.logLevel
}

/**
 * 检查 step 模式下是否应该暂停
 */
export function shouldPauseAfterStep(
  policy: ExecutionPolicy,
  stepIndex: number,
  totalSteps: number
): boolean {
  if (policy.mode === 'auto') return false
  if (policy.mode === 'debug') return true  // debug 模式每步都暂停
  // step 模式：除了最后一步都暂停
  return stepIndex < totalSteps - 1
}
