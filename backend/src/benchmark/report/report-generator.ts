/**
 * benchmark/report/report-generator.ts — Benchmark Report 生成器
 *
 * 将 BII Result + 原始评分数据组装为 BenchmarkReport。
 * Report Schema 遵循 Spec v1.0 Chapter 10.
 *
 * 输出直接可被以下功能消费：
 *   - Health Report
 *   - Optimization Engine
 *   - Verification Engine
 *   - Monitor
 */
import { BIIResult, BenchmarkReport, BenchmarkQuestion, ClaimEvaluation, BIIDimension, BenchmarkRecommendation } from '../types'

export class ReportGenerator {
  private biiFormulaVersion = 'bii-v1.0'

  generate(params: {
    entityId: string
    brandName: string
    brandIndustry?: string
    datasetVersion: string
    promptPackVersion: string
    judgeVersion: string
    provider: string
    model: string
    biiResult: BIIResult
    questionMap: Map<string, BenchmarkQuestion>
    evaluations: Map<string, ClaimEvaluation[]>
    startTime: Date
    endTime: Date
  }): BenchmarkReport {
    const { entityId, brandName, brandIndustry, datasetVersion, promptPackVersion, judgeVersion, provider, model, biiResult, questionMap, evaluations, startTime, endTime } = params
    
    const reportId = `BR-${startTime.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    
    // 构建按维度的数据
    const dimensionMap: BenchmarkReport['dimensions'] = {}
    
    for (const dim of biiResult.dimensions) {
      const dimEvaluations = evaluations.get(dim.dimension) ?? []
      
      dimensionMap[dim.dimension] = {
        score: dim.score,
        weight: dim.weight,
        weightedScore: dim.weightedScore,
        keyFindings: dim.keyFindings,
        deductionReasons: dimEvaluations.filter(e => e.score < 0.5),
      }
    }
    
    // 生成优化建议
    const recommendations = this.generateRecommendations(biiResult, questionMap, evaluations)
    
    return {
      meta: {
        reportId,
        entityId,
        brandName,
        brandIndustry,
        benchmarkVersion: `${datasetVersion}+${promptPackVersion}+${judgeVersion}+${this.biiFormulaVersion}`,
        datasetVersion,
        promptPackVersion,
        judgeVersion,
        biiFormulaVersion: this.biiFormulaVersion,
        provider,
        model,
        runAt: endTime.toISOString(),
        duration: Math.round((endTime.getTime() - startTime.getTime()) / 1000),
      },
      overall: {
        biiScore: biiResult.biiScore,
        biiGrade: biiResult.biiGrade,
        confidence: biiResult.confidence,
      },
      dimensions: dimensionMap,
      recommendations,
    }
  }

  private generateRecommendations(
    biiResult: BIIResult,
    questionMap: Map<string, BenchmarkQuestion>,
    evaluations: Map<string, ClaimEvaluation[]>,
  ): BenchmarkRecommendation[] {
    const recommendations: BenchmarkRecommendation[] = []
    
    // 按维度分，找出得分最低的维度
    const sorted = [...biiResult.dimensions].sort((a, b) => a.score - b.score)
    
    for (const dim of sorted.slice(0, 3)) {
      const lowestEvals = dim.evaluations
        .filter(e => e.score < 0.5)
        .slice(0, 2)
      
      for (const ev of lowestEvals) {
        recommendations.push({
          priority: dim.score < 35 ? 'P0' : dim.score < 55 ? 'P1' : 'P2',
          dimension: dim.dimension,
          category: this.categorizeIssue(dim.dimension),
          what: ev.reason,
          why: `该问题影响 ${DIMENSION_LABELS[dim.dimension]} 维度评分（当前 ${dim.score}/100）`,
          how: `建议在品牌官网和相关渠道补充关于「${ev.claim}」的结构化信息，确保信息覆盖全面、可被 AI 正确识别`,
          expectedImpact: {
            dimension: dim.dimension,
            delta: Math.max(5, Math.round((1 - ev.score) * 10)),
          },
          confidence: 0.7,
        })
      }
    }
    
    return recommendations
  }

  private categorizeIssue(dimension: BIIDimension): string {
    const map: Record<BIIDimension, string> = {
      visibility: 'brand_presence',
      understanding: 'content_depth',
      accuracy: 'information_accuracy',
      citation: 'citation_gap',
      recommendation: 'recommendation_capability',
      comparative_preference: 'competitive_positioning',
      freshness: 'information_freshness',
      consistency: 'consistency',
    }
    return map[dimension] ?? 'other'
  }
}

const DIMENSION_LABELS: Record<BIIDimension, string> = {
  visibility: '品牌可见性',
  understanding: '品牌理解',
  accuracy: '信息准确性',
  citation: '引用能力',
  recommendation: '推荐能力',
  comparative_preference: '竞品偏好',
  freshness: '信息时效性',
  consistency: '一致性',
}
