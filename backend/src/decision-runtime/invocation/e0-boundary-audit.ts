/**
 * e0-boundary-audit.ts — Phase E-0 System Boundary Audit
 *
 * ============================================================
 * 这不是能力扩展。
 * 不是 pipeline。
 * 不是 layer。
 *
 * 这是：
 *   系统第一次定义"自己不该被用来做什么"
 * ============================================================
 *
 * 三个核心问题：
 *   1. System Scope — 系统管什么，不管什么
 *   2. Semantic Boundary — proof universe 能/不能解释什么
 *   3. Evaluation Legitimacy — 什么测试是"有效测试"
 */

import type { TruthValue } from '../proofs/b45/proposition.js'

// ============================================================
// 1. System Scope — 系统范畴定义
// ============================================================

export interface AllowedDomain {
  /** 域标识 */
  id: string
  /** 域名称 */
  name: string
  /** 域描述 */
  description: string
  /** 允许的 query pattern */
  allowedPatterns: string[]
  /** 实例问题 */
  exampleQueries: string[]
}

export interface ForbiddenDomain {
  id: string
  name: string
  description: string
  /** 禁入原因 */
  reason: string
  /** 示例 */
  exampleQueries: string[]
}

export interface ScopeDefinition {
  systemName: string
  systemVersion: string
  createdAt: number
  /** 系统自述——一句话说清系统是干什么的 */
  systemIdentity: string
  /** 允许域 */
  allowedDomains: AllowedDomain[]
  /** 禁止域 */
  forbiddenDomains: ForbiddenDomain[]
  /** 未分类问题的行为 */
  unspecifiedBehavior: 'reject' | 'warn' | 'best_effort'
  /** 范围签名（唯一标识 Scope 定义） */
  scopeSignature: string
}

export class ScopeRegistry {
  private definition: ScopeDefinition

  constructor(def: ScopeDefinition) {
    this.definition = def
  }

  getDefinition(): Readonly<ScopeDefinition> {
    return this.definition
  }

  /**
   * classify(query): 判断 query 属于哪个域
   */
  classify(query: string): ScopeClassification {
    const lower = query.toLowerCase()

    // 检查禁止域
    for (const domain of this.definition.forbiddenDomains) {
      const match = domain.allowedPatterns.some(p => this.matchPattern(lower, p))
      if (match) {
        return {
          domainId: domain.id,
          domainName: domain.name,
          allowed: false,
          reason: domain.reason,
        }
      }
    }

    // 检查允许域
    for (const domain of this.definition.allowedDomains) {
      const match = domain.allowedPatterns.some(p => this.matchPattern(lower, p))
      if (match) {
        return {
          domainId: domain.id,
          domainName: domain.name,
          allowed: true,
        }
      }
    }

    // 未分类
    return {
      domainId: 'unspecified',
      domainName: 'Unspecified Domain',
      allowed: this.definition.unspecifiedBehavior === 'best_effort',
      reason: this.definition.unspecifiedBehavior === 'reject'
        ? 'Query does not match any allowed domain'
        : undefined,
    }
  }

  private matchPattern(lowerQuery: string, pattern: string): boolean {
    const p = pattern.toLowerCase()
    if (p.startsWith('/') && p.endsWith('/')) {
      // 正则模式
      try {
        const re = new RegExp(p.slice(1, -1))
        return re.test(lowerQuery)
      } catch {
        return false
      }
    }
    // 简单关键词
    return lowerQuery.includes(p)
  }
}

export interface ScopeClassification {
  domainId: string
  domainName: string
  allowed: boolean
  reason?: string
}

// ============================================================
// 2. Semantic Boundary — 语义边界
// ============================================================

export interface SemanticBoundary {
  /** 系统能解释的 proof 类型 */
  explainableProofs: ProofInterpretability[]
  /** 系统不能解释的 proof 类型 */
  unexplainableProofs: string[]
  /** 真值的语义范围 */
  truthScope: TruthScope
}

export interface ProofInterpretability {
  category: string
  interpretable: boolean
  description: string
}

export interface TruthScope {
  /** 系统可以分配的真值 */
  validTruthValues: TruthValue[]
  /** 系统不能输出的真值 */
  invalidTruthMeanings: string[]
  /** 真值的信任上限 */
  maxConfidence: number
}

export class BoundaryRegistry {
  constructor(public readonly boundary: SemanticBoundary) {}

  /**
   * canExplain(proofCategory): 是否能解释某类 proof
   */
  canExplain(proofCategory: string): boolean {
    const entry = this.boundary.explainableProofs.find(p => p.category === proofCategory)
    return entry ? entry.interpretable : false
  }

  /**
   * isValidTruth(truth): 真值是否在范围内
   */
  isValidTruth(truth: string): truth is TruthValue {
    return this.boundary.truthScope.validTruthValues.includes(truth as TruthValue)
  }
}

// ============================================================
// 3. Evaluation Legitimacy — 评估合法性
// ============================================================

export interface EvaluationRule {
  /** 规则 ID */
  ruleId: string
  /** 规则描述 */
  description: string
  /** 规则类别 */
  category: 'validity' | 'purity' | 'reproducibility' | 'scope'
  /** 如果违反，是否无效 */
  invalidatesEvaluation: boolean
}

export interface EvaluationLegitimacy {
  /** 规则集 */
  rules: EvaluationRule[]
  /** 有效性检查函数 */
  validate: (testPlan: string) => LegitimacyResult
}

export interface LegitimacyResult {
  /** 是否有效 */
  valid: boolean
  /** 违反的规则 */
  violations: string[]
}

/**
 * 创建标准评估合法性检验器
 */
export function createEvaluationLegitimacy(): EvaluationLegitimacy {
  const rules: EvaluationRule[] = [
    // 有效性规则
    {
      ruleId: 'VALID-001',
      description: 'Test query must belong to an allowed domain',
      category: 'validity',
      invalidatesEvaluation: true,
    },
    {
      ruleId: 'VALID-002',
      description: 'Expected decision must be a valid truth value (true|false|unknown)',
      category: 'validity',
      invalidatesEvaluation: true,
    },

    // 纯度规则
    {
      ruleId: 'PURITY-001',
      description: 'Test must not modify frozen proof universe',
      category: 'purity',
      invalidatesEvaluation: true,
    },
    {
      ruleId: 'PURITY-002',
      description: 'Test must not bypass Bridge interface',
      category: 'purity',
      invalidatesEvaluation: true,
    },

    // 可复现规则
    {
      ruleId: 'REPRO-001',
      description: 'Test result must be deterministically reproducible',
      category: 'reproducibility',
      invalidatesEvaluation: true,
    },
    {
      ruleId: 'REPRO-002',
      description: 'Test must specify query, not random',
      category: 'reproducibility',
      invalidatesEvaluation: false,
    },

    // 范围规则
    {
      ruleId: 'SCOPE-001',
      description: 'Evaluation must not include forbidden domain queries',
      category: 'scope',
      invalidatesEvaluation: true,
    },
    {
      ruleId: 'SCOPE-002',
      description: 'System identity must be declared before evaluation',
      category: 'scope',
      invalidatesEvaluation: true,
    },
  ]

  return {
    rules,
    validate: (testPlan: string): LegitimacyResult => {
      const lower = testPlan.toLowerCase()
      const violations: string[] = []

      for (const rule of rules) {
        let violated = false
        switch (rule.ruleId) {
          case 'PURITY-001':
            if (lower.includes('modify') || lower.includes('change') || lower.includes('rewrite')) {
              violated = true
            }
            break
          case 'PURITY-002':
            if (lower.includes('bypass') || lower.includes('direct')) {
              violated = true
            }
            break
          case 'SCOPE-001':
            if (lower.includes('forbidden') || lower.includes('illegal') || lower.includes('private')) {
              violated = true
            }
            break
          case 'VALID-001':
            if (lower.includes('random') && !lower.includes('domain')) {
              violated = true
            }
            break
          default:
            break
        }

        if (violated && rule.invalidatesEvaluation) {
          violations.push(rule.ruleId)
        }
      }

      return {
        valid: violations.length === 0,
        violations,
      }
    },
  }
}

// ============================================================
// 4. System Boundary Audit — 系统边界审计
// ============================================================

export interface AuditReport {
  /** 系统身份 */
  systemIdentity: string
  /** 范围审计 */
  scope: {
    allowedDomainCount: number
    forbiddenDomainCount: number
    unspecifiedBehavior: string
  }
  /** 语义边界审计 */
  semantic: {
    explainableProofCount: number
    validTruthValues: TruthValue[]
    maxConfidence: number
  }
  /** 评估合法性审计 */
  evaluation: {
    ruleCount: number
    allRulesValid: boolean
  }
  /** 边界完整性 */
  boundaryIntegrity: 'complete' | 'incomplete' | 'unknown'
  /** 审计时间 */
  auditedAt: number
}

export class BoundaryAuditor {
  /**
   * audit(scope, boundary, legitimacy): 执行完整边界审计
   */
  audit(
    scope: ScopeRegistry,
    boundary: BoundaryRegistry,
    legitimacy: EvaluationLegitimacy
  ): AuditReport {
    const scopeDef = scope.getDefinition()
    const allRulesValid = legitimacy.rules.every(r => r.description.length > 0)

    return {
      systemIdentity: scopeDef.systemIdentity,
      scope: {
        allowedDomainCount: scopeDef.allowedDomains.length,
        forbiddenDomainCount: scopeDef.forbiddenDomains.length,
        unspecifiedBehavior: scopeDef.unspecifiedBehavior,
      },
      semantic: {
        explainableProofCount: boundary.boundary.explainableProofs.filter(p => p.interpretable).length,
        validTruthValues: boundary.boundary.truthScope.validTruthValues,
        maxConfidence: boundary.boundary.truthScope.maxConfidence,
      },
      evaluation: {
        ruleCount: legitimacy.rules.length,
        allRulesValid,
      },
      boundaryIntegrity: scopeDef.forbiddenDomains.length > 0 && allRulesValid
        ? 'complete'
        : 'incomplete',
      auditedAt: Date.now(),
    }
  }
}

/**
 * 标准边界审计器
 */
export const boundaryAuditor = new BoundaryAuditor()
