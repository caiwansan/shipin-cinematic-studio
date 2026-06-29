// P3.2 — Execution Control Policy Layer (Sprint 1)
// ============================================================
// 三文件 scaffold:
//   1. executionPolicy.ts    — 执行策略定义
//   2. executionController.ts — 控制器 + 事件总线
//   3. executionModeResolver.ts — 模式解析器
//
// 约束:
//   ❌ 不改 ExecutionStateManager 核心
//   ❌ 不改 backend
//   ❌ 不发 API
//   ✅ 只做前端 policy layer
// ============================================================

export type ExecutionMode = 'auto' | 'step' | 'debug'

export type ExecutionLogLevel = 'minimal' | 'normal' | 'verbose'

export interface ExecutionPolicy {
  mode: ExecutionMode
  allowPause: boolean
  allowStep: boolean
  logLevel: ExecutionLogLevel
  autoResolveAfterMs?: number   // step 模式下超时自动推进（ms）
}

/**
 * 根据 tier 获取默认 policy
 */
export function getDefaultPolicy(tier: string): ExecutionPolicy {
  switch (tier) {
    case 'VIP_2':
    case 'ADMIN':
      return {
        mode: 'auto',
        allowPause: true,
        allowStep: true,
        logLevel: 'normal',
        autoResolveAfterMs: 30000,
      }
    case 'VIP_1':
      return {
        mode: 'auto',
        allowPause: true,
        allowStep: true,
        logLevel: 'normal',
        autoResolveAfterMs: 60000,
      }
    default: // FREE
      return {
        mode: 'auto',
        allowPause: false,
        allowStep: false,
        logLevel: 'minimal',
      }
  }
}

/**
 * 根据 mode 生成 policy
 */
export function createPolicy(mode: ExecutionMode, tier: string): ExecutionPolicy {
  const base = getDefaultPolicy(tier)
  if (mode === 'step') {
    return { ...base, mode: 'step', allowPause: true, allowStep: true }
  }
  if (mode === 'debug') {
    return { ...base, mode: 'debug', allowPause: true, allowStep: true, logLevel: 'verbose' }
  }
  return base
}
