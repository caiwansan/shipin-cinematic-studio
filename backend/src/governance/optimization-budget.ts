/**
 * governance/optimization-budget.ts — 优化预算系统
 *
 * 限制每个周期内 optimizer 可以做的变更幅度，
 * 防止系统振荡（oscillation）。
 */

export interface OptimizationProposal {
  action: string
  source: 'router-learning' | 'cost-optimizer' | 'load-predictor' | 'self-healing' | 'experiments'
  target: string
  priority: number
  expectedImpact: {
    costChange?: number     // 预估成本变化百分比
    latencyChange?: number  // 预估延迟变化百分比
    scoreChange?: number    // 预估评分变化
    risk: 'low' | 'medium' | 'high'
  }
  params: Record<string, any>
}

export type ProposalDecision = 'approve' | 'reject' | 'delay'

interface BudgetWindow {
  startTime: number
  duration: number
  routerChanges: number
  providerScoreChanges: number
  queuePolicyChanges: number
}

const windows: BudgetWindow[] = []
const WINDOW_DURATION_MS = 600_000  // 10分钟窗口

// 预算上限
const BUDGET_LIMITS = {
  maxRouterChangesPerWindow: 3,         // 10分钟最多3次路由变更
  maxProviderScoreChange: 0.05,        // 单次评分变化不超过5%
  maxCostStrategyChangesPerMin: 1,     // 每分钟最多1次成本策略变更
  minQueuePolicyIntervalMs: 300_000,   // 队列策略变更间隔至少5分钟
}

let lastCostStrategyChange = 0
let lastQueuePolicyChange = 0

/**
 * 检查是否在预算内
 */
export function checkBudget(proposal: OptimizationProposal): {
  withinBudget: boolean
  reason?: string
} {
  const now = Date.now()
  const window = getCurrentWindow()

  switch (proposal.action) {
    case 'router_update':
      if (window.routerChanges >= BUDGET_LIMITS.maxRouterChangesPerWindow) {
        return {
          withinBudget: false,
          reason: `Router change budget exhausted (${window.routerChanges}/${BUDGET_LIMITS.maxRouterChangesPerWindow} per 10min)`,
        }
      }
      // 检查评分变化幅度
      if (Math.abs(proposal.expectedImpact.scoreChange || 0) > BUDGET_LIMITS.maxProviderScoreChange) {
        return {
          withinBudget: false,
          reason: `Provider score change ${(proposal.expectedImpact.scoreChange! * 100).toFixed(0)}% exceeds 5% limit`,
        }
      }
      break

    case 'cost_strategy_update':
      if (now - lastCostStrategyChange < 60_000) {
        return {
          withinBudget: false,
          reason: `Cost strategy changed ${Math.round((now - lastCostStrategyChange) / 1000)}s ago, min 60s interval`,
        }
      }
      break

    case 'queue_policy_update':
      if (now - lastQueuePolicyChange < BUDGET_LIMITS.minQueuePolicyIntervalMs) {
        return {
          withinBudget: false,
          reason: `Queue policy changed ${Math.round((now - lastQueuePolicyChange) / 1000)}s ago, min 5min interval`,
        }
      }
      break
  }

  return { withinBudget: true }
}

/**
 * 记录预算消耗
 */
export function consumeBudget(action: string) {
  const window = getCurrentWindow()
  switch (action) {
    case 'router_update':
      window.routerChanges++
      break
    case 'cost_strategy_update':
      lastCostStrategyChange = Date.now()
      break
    case 'queue_policy_update':
      lastQueuePolicyChange = Date.now()
      break
  }
}

/**
 * 获取当前时间窗口
 */
function getCurrentWindow(): BudgetWindow {
  const now = Date.now()
  const active = windows.find(w => now - w.startTime < w.duration)
  if (active) return active

  const newWindow: BudgetWindow = {
    startTime: now,
    duration: WINDOW_DURATION_MS,
    routerChanges: 0,
    providerScoreChanges: 0,
    queuePolicyChanges: 0,
  }
  windows.push(newWindow)

  // 清理旧窗口
  while (windows.length > 5) windows.shift()

  return newWindow
}

/**
 * 获取预算统计
 */
export function getBudgetStats() {
  return {
    limits: BUDGET_LIMITS,
    currentWindow: getCurrentWindow(),
    lastCostStrategyChange: lastCostStrategyChange ? new Date(lastCostStrategyChange).toISOString() : null,
    lastQueuePolicyChange: lastQueuePolicyChange ? new Date(lastQueuePolicyChange).toISOString() : null,
  }
}
