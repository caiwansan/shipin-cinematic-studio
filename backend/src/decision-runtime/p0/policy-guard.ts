/**
 * policy-guard.ts — Phase P-0 Policy Guard（剑匣机关）
 *
 * ============================================================
 * P-0 的"剑匣机关"——决定哪些请求允许进入 Shadow Execution
 *
 * 使用 E-0 Boundary Audit 的 Scope Registry 做合法性检查。
 * 不包含任何业务逻辑，只做类别判断。
 * ============================================================
 */

import { ScopeRegistry, ScopeClassification } from '../invocation/e0-boundary-audit.js'

export interface GuardResult {
  allowed: boolean
  classification?: ScopeClassification
  reason?: string
}

export class E0PolicyGuard {
  private scopeRegistry: ScopeRegistry

  constructor(scopeRegistry: ScopeRegistry) {
    this.scopeRegistry = scopeRegistry
  }

  /**
   * check(query): 检查 query 是否允许进入执行
   *
   * 规则：
   *   - 禁止域 → 拒绝
   *   - 允许域 → 通过
   *   - 未分类 → 依 unspecifiedBehavior 决定
   */
  check(query: string): GuardResult {
    const classification = this.scopeRegistry.classify(query)

    if (classification.allowed) {
      return {
        allowed: true,
        classification,
      }
    }

    return {
      allowed: false,
      classification,
      reason: classification.reason ?? 'QUERY_NOT_IN_ALLOWED_DOMAIN',
    }
  }
}
