/**
 * benchmark/judge/claim-evaluator.ts — Claim 评估器
 *
 * 职责：对比 Actual Response 中的 Claims 与 Expected Claims，
 *       逐条评分，生成 Reason。
 *
 * Judge Independence: 不依赖 Provider 或 Dataset 实现细节，
 *                      只处理 Claim 级别的语义匹配。
 */
import { BenchmarkQuestion, ExpectedClaim, ClaimEvaluation, ScoringRuleType, EntityRef } from '../types'

export class ClaimEvaluator {
  private judgeVersion = 'jd-v1.0'

  /**
   * Resolve entity name from context for placeholder replacement.
   * Priority: entity.brandName > entity.entityId (as fallback display name)
   */
  private resolveEntityName(context?: { entity?: EntityRef; brand?: string }): string {
    if (context?.entity?.brandName) return context.entity.brandName
    if (context?.brand) return context.brand
    if (context?.entity?.entityId) {
      // Extract display name from entityId (remove prefix)
      const parts = context.entity.entityId.split(':')
      return parts[parts.length - 1] || context.entity.entityId
    }
    return ''
  }

  /**
   * 对一道题的所有 Expected Claims 进行评分
   */
  evaluate(question: BenchmarkQuestion, responseContent: string, context?: { entity?: EntityRef; brand?: string }): ClaimEvaluation[] {
    const evaluations: ClaimEvaluation[] = []
    const lowerContent = responseContent.toLowerCase()
    const entityName = this.resolveEntityName(context)
    
    for (const expected of question.expectedClaims) {
      // Replace {entity} and {brand} placeholder in claim text for matching
      let resolvedClaim = expected.claim
      if (entityName) {
        resolvedClaim = resolvedClaim.replace(/\{entity\}/g, entityName).replace(/\{brand\}/g, entityName)
      }

      const result = this.evaluateClaim({
        ...expected,
        claim: resolvedClaim,
      }, lowerContent, responseContent, question.evaluation.scoringRule)
      evaluations.push(result)
    }
    
    return evaluations
  }

  private evaluateClaim(
    expected: ExpectedClaim,
    lowerContent: string,
    originalContent: string,
    rule: ScoringRuleType,
  ): ClaimEvaluation {
    const lowerClaim = expected.claim.toLowerCase()
    let score: number
    let reason: string
    
    switch (rule) {
      case 'exact':
        score = lowerContent.includes(lowerClaim) ? 1.0 : 0
        reason = score === 1.0
          ? `AI 正确提及了：「${expected.claim}」`
          : `AI 未提及预期内容：「${expected.claim}」`
        break
        
      case 'semantic':
        // 简单语义匹配：子串匹配 + 关键词覆盖
        const words = lowerClaim.split(/[\s,，、]+/).filter(w => w.length > 1)
        const matchRatio = words.filter(w => lowerContent.includes(w)).length / words.length
        score = matchRatio >= 0.6 ? 1.0 : matchRatio >= 0.3 ? 0.5 : 0
        reason = score === 1.0
          ? `AI 的回答语义上覆盖了：「${expected.claim}」`
          : score === 0.5
            ? `AI 部分提到了相关内容，但不够完整：「${expected.claim}」`
            : `AI 的回答未涵盖：「${expected.claim}」`
        break
        
      case 'evidence_required':
        // 需要同时匹配 Claim + 证据
        const claimFound = lowerContent.includes(lowerClaim)
        const evidenceFound = expected.evidence?.some(e =>
          lowerContent.includes(e.description.toLowerCase())
        ) ?? false
        if (claimFound && evidenceFound) {
          score = 1.0
          reason = `AI 提及了「${expected.claim}」并引用了相关来源`
        } else if (claimFound) {
          score = 0.5
          reason = `AI 提及了「${expected.claim}」但未引用具体来源`
        } else {
          score = 0
          reason = `AI 未提及「${expected.claim}」`
        }
        break
        
      case 'comparative':
        // 从回复中判断倾向性
        const positive = expected.claim
        // 简单的正负向判断
        const isPositive = lowerContent.includes(lowerClaim)
        score = isPositive ? 1.0 : 0
        reason = isPositive
          ? `AI 的回答倾向于：「${expected.claim}」`
          : `AI 未表现出「${expected.claim}」的倾向`
        break
        
      default:
        score = 0
        reason = `未知评分规则: ${rule}`
    }
    
    return {
      questionId: '',
      claim: expected.claim,
      expected: expected.claim,
      actual: score >= 0.5 ? originalContent.slice(0, 200) : null,
      score,
      reason,
      impact: `${expected.type === 'fact' ? '事实性' : '观点性'}陈述，${expected.required ? '必须' : '建议'}提及`,
    }
  }
}
