/**
 * scoring.agent.ts — Phase AG-2.1 确定性 ScoringAgent
 *
 * ═══════════════════════════════════════════════════════════════
 * 只做: UniversalEvidence[] + ReasoningFrame → EvaluationScoreCard
 * 禁止: LLM / 随机 / 凭感觉
 *
 * 约束:
 *   ❌ 禁止读取 url（避免域名 bias）
 *   ✅ 只读 title + snippet
 *   ❌ 禁止 enrichment
 *
 * 当前：按证据数量 + 关键词匹配占位分
 * AG-2.4 以后接入 evidence graph 评分
 *
 * @phase decision-runtime / ag-2.1
 */

import type { ContractCandidate, ContractEvidence } from '../../cognition/agent-contract.js'
import type { UniversalEvidence } from './universal-evidence.js'
import type { ReasoningFrame } from '../../cognition/reasoning-frame.js'
import type { EvaluationScoreCard } from '../../cognition/evaluation-schema.js'
import { Confidence, ScoreLevel } from '../../cognition/evaluation-schema.js'
import { buildScoreCard } from '../core/deterministic-transform.js'

export class ScoringAgent {
  score(candidate: ContractCandidate, evidence: UniversalEvidence[], frame: ReasoningFrame): EvaluationScoreCard {
    const weightMap: Record<string, number> = {}
    for (const ax of frame.evaluationAxes) {
      weightMap[ax.name] = ax.weight
    }

    // 只取 title + snippet 做关键词匹配（禁止读 url）
    const allText = evidence
      .filter(ev => candidate.evidenceIds.includes(ev.url || ''))
      .map(ev => `${ev.title} ${ev.snippet}`.toLowerCase())

    const axes = frame.evaluationAxes.map(ax => {
      const keywords = this.axisKeywords(ax.name)
      const matchedCount = allText.filter(t => keywords.some(k => t.includes(k))).length
      const totalCount = allText.length

      // 关键词匹配率 → 分数
      const ratio = totalCount > 0 ? matchedCount / totalCount : 0
      const score = Math.round(ratio * 100)
      const level = this.scoreToLevel(score)

      return {
        axisName: ax.name,
        score,
        level,
        confidence: totalCount > 5 ? Confidence.HIGH : totalCount > 2 ? Confidence.MEDIUM : Confidence.LOW,
        rationale: totalCount > 0
          ? `基于 ${totalCount} 条证据，关键词匹配 ${matchedCount} 条 (${(ratio * 100).toFixed(0)}%)`
          : '暂无相关证据',
        evidenceSources: [],
      }
    })

    return buildScoreCard(candidate.id, candidate.name, axes, weightMap)
  }

  private axisKeywords(axisName: string): string[] {
    const map: Record<string, string[]> = {
      credibility: ['信誉', '资质', '认证', '正规', '注册', '可信', '可靠', '信用', 'trust', 'credible', 'certified'],
      reputation: ['口碑', '声誉', '知名', '品牌', '著名', '老字号', 'reputation', 'famous', 'popular', 'well-known'],
      service_quality: ['服务', '态度', '售后', '客服', '体验', '满意', 'service', 'quality', 'support', 'professional'],
      risk: ['风险', '纠纷', '投诉', '诉讼', '欺诈', '跑路', '罚款', '处罚', '倒闭', 'risk', 'complaint', 'lawsuit', 'fraud'],
      value_for_money: ['价格', '性价比', '收费', '费用', '便宜', '贵', '划算', 'value', 'price', 'cost', 'affordable', 'worth'],
      expertise: ['专业', '经验', '多年', '资深', '团队', '专家', 'expert', 'professional', 'experienced', 'skilled'],
      success_rate: ['成功', '胜率', '案例', '成功率', 'success', 'win rate', 'case'],
      equipment: ['设备', '设施', '仪器', '先进', 'equipment', 'facility', 'advanced'],
      teaching_quality: ['教学', '老师', '课程', '师资', '教育', 'teaching', 'teacher', 'curriculum'],
      employment_rate: ['就业', '招聘', '工作', '就业率', 'employment', 'job', 'hire'],
      location: ['位置', '地址', '交通', '地铁', '公交', 'location', 'address', 'transport', 'subway'],
      hygiene: ['卫生', '清洁', '干净', '消毒', 'hygiene', 'clean', 'sanitary', 'disinfect'],
      support_quality: ['支持', '培训', '指导', '扶持', 'support', 'training', 'guidance'],
      roi_potential: ['回报', '利润', '收益', '盈利', '收入', 'roi', 'return', 'profit', 'revenue'],
      empathy: ['理解', '耐心', '关怀', '沟通', '倾听', 'empathy', 'understanding', 'patient', 'caring'],
      appreciation_potential: ['升值', '增值', '增长', '潜力', '发展', 'appreciation', 'growth', 'potential'],
      accessibility: ['方便', '便利', '便捷', '交通', 'access', 'convenient', 'easy'],
      capacity: ['规模', '容量', '接待', '产能', 'capacity', 'scale', 'volume'],
      delivery_reliability: ['准时', '按时', '交付', '工期', '可靠', 'delivery', 'on-time', 'reliable'],
    }
    return map[axisName] || [axisName]
  }

  private scoreToLevel(score: number): ScoreLevel {
    if (score >= 90) return 'excellent' as ScoreLevel
    if (score >= 75) return 'good' as ScoreLevel
    if (score >= 60) return 'fair' as ScoreLevel
    if (score >= 40) return 'poor' as ScoreLevel
    return 'very_poor' as ScoreLevel
  }
}

export const scoringAgent = new ScoringAgent()
