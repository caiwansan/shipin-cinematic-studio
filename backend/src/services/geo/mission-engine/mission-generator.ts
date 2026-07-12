// ─────────────────────────────────────────────────
// Mission Generator — Decision Graph → Mission List
// P0 — FROZEN
// ─────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid'
import type { Issue, IssueGraph } from '../decision-intelligence/types'
import type { Mission, MissionDifficulty } from './types'

export class MissionGenerator {
  // Issue kindId → Mission template mapping
  private static MISSION_MAP: Record<string, {
    title: string
    description: string
    why: string
    impact: { dimension: string; gain: number; unit: string }[]
    estimatedTime: string
    difficulty: MissionDifficulty
    action: { label: string; type: 'navigate' | 'open_drawer'; destination: string }
    verification: { type: string; param?: string }
  }> = {
    missing_schema: {
      title: '补充 Schema 标记',
      description: '为品牌添加结构化 Schema 标记，让 AI 系统能正确解析品牌信息。',
      why: 'Schema 是 AI 理解品牌的"说明书"，缺少它将导致大多数 AI 系统无法识别品牌。',
      impact: [
        { dimension: 'AI 引用率', gain: 22, unit: '%' },
        { dimension: 'Rich Result', gain: 15, unit: '%' }
      ],
      estimatedTime: '2 分钟',
      difficulty: 'easy',
      action: { label: '立即补充 Schema', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'schema_exists' }
    },
    incomplete_schema: {
      title: '完善 Schema 信息',
      description: '当前 Schema 缺少关键字段（名称、描述、Logo），补充这些信息能提升 AI 理解质量。',
      why: '不完整的 Schema 会导致 AI 只能部分理解品牌，影响所有下游 AI 检索和引用。',
      impact: [
        { dimension: 'AI 引用率', gain: 18, unit: '%' },
        { dimension: '品牌识别度', gain: 12, unit: '%' }
      ],
      estimatedTime: '5 分钟',
      difficulty: 'easy',
      action: { label: '完善 Schema', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'schema_exists' }
    },
    low_coverage: {
      title: '扩展知识覆盖',
      description: 'AI 目前缺乏足够的品牌知识，需要添加更多知识对象来覆盖品牌核心信息。',
      why: '知识覆盖度直接决定 AI 在回答用户提问时是否会引用品牌信息。覆盖度越高，被引用概率越大。',
      impact: [
        { dimension: 'AI 检索率', gain: 25, unit: '%' },
        { dimension: 'AI 引用率', gain: 20, unit: '%' }
      ],
      estimatedTime: '10 分钟',
      difficulty: 'medium',
      action: { label: '创建知识对象', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'claim_exists' }
    },
    factual_conflict: {
      title: '解决信息冲突',
      description: '多个来源的品牌信息存在不一致，需要统一并核实。',
      why: '信息冲突会降低 AI 的信任评分，导致 AI 倾向于引用其他更一致的品牌。',
      impact: [
        { dimension: 'AI 信任度', gain: 30, unit: '%' },
        { dimension: '推荐意愿', gain: 20, unit: '%' }
      ],
      estimatedTime: '15 分钟',
      difficulty: 'hard',
      action: { label: '核实信息', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'manual' }
    },
    outdated_content: {
      title: '更新过时内容',
      description: '部分品牌信息已过时，需要更新以保持与最新品牌信息一致。',
      why: 'AI 系统倾向于引用最新的信息，过时内容会导致 AI 引用过时或不准确的品牌描述。',
      impact: [
        { dimension: 'AI 引用率', gain: 15, unit: '%' }
      ],
      estimatedTime: '10 分钟',
      difficulty: 'medium',
      action: { label: '更新内容', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'manual' }
    },
    authority_gap: {
      title: '补充权威来源',
      description: '品牌缺乏高价值的外部引用来源，需要添加权威的第三方参考。',
      why: 'AI 优先引用有权威来源支持的信息。缺少权威来源会大幅降低被 AI 引用的概率。',
      impact: [
        { dimension: 'AI 信任度', gain: 30, unit: '%' },
        { dimension: '推荐意愿', gain: 25, unit: '%' }
      ],
      estimatedTime: '20 分钟',
      difficulty: 'hard',
      action: { label: '添加引用来源', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'evidence_exists' }
    },
    visibility_drop: {
      title: '检查 Visibility 下降原因',
      description: '近期品牌在 AI 系统中的可见度明显下降，需要全面检查并修复。',
      why: 'Visibility 下降通常意味着 AI 系统在更新知识库时丢失或降低了品牌权重。',
      impact: [
        { dimension: 'AI 可见度', gain: 20, unit: '%' }
      ],
      estimatedTime: '30 分钟',
      difficulty: 'hard',
      action: { label: '查看详情', type: 'navigate', destination: '/workspace/geo/dashboard' },
      verification: { type: 'manual' }
    },
    citation_missing: {
      title: '补充引用来源',
      description: '品牌信息缺少外部引用来源，AI 难以验证信息的准确性。',
      why: '有引用来源的信息更容易被 AI 系统采纳和引用，缺乏引用会降低可信度。',
      impact: [
        { dimension: 'AI 引用率', gain: 18, unit: '%' }
      ],
      estimatedTime: '10 分钟',
      difficulty: 'medium',
      action: { label: '添加引用', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'evidence_exists' }
    },
    schema_error: {
      title: '修复 Schema 格式错误',
      description: '当前 Schema 存在格式错误，无法被标准解析器正确识别。',
      why: '格式错误的 Schema 等同于没有 Schema，AI 完全无法解析品牌信息。',
      impact: [
        { dimension: 'AI 解析率', gain: 35, unit: '%' }
      ],
      estimatedTime: '5 分钟',
      difficulty: 'easy',
      action: { label: '修复 Schema', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'schema_exists' }
    },
    content_duplicate: {
      title: '合并重复内容',
      description: '存在重复的品牌信息，需要合并以提供一致的品牌描述。',
      why: '重复内容会降低 AI 系统对品牌的专业度评价，影响整体信任评分。',
      impact: [
        { dimension: 'AI 信任度', gain: 10, unit: '%' }
      ],
      estimatedTime: '15 分钟',
      difficulty: 'easy',
      action: { label: '管理内容', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'manual' }
    },
    branding_inconsistency: {
      title: '统一品牌表述',
      description: '品牌名称或描述在不同来源中存在不一致，需要统一。',
      why: '品牌表述不一致会降低 AI 系统的识别准确度，影响品牌在所有 AI 场景的表现。',
      impact: [
        { dimension: '品牌识别度', gain: 15, unit: '%' }
      ],
      estimatedTime: '5 分钟',
      difficulty: 'easy',
      action: { label: '统一表述', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'manual' }
    },
    // 空数据（没有 Knowledge Object）
    data_gap: {
      title: '创建首个知识对象',
      description: '品牌尚未创建任何知识对象，AI 系统无法了解品牌基本信息。',
      why: '没有知识对象意味着 AI 对品牌一无所知，这是品牌 AI 可见度为零的根本原因。',
      impact: [
        { dimension: 'AI 可见度', gain: 40, unit: '%' },
        { dimension: 'AI 引用率', gain: 35, unit: '%' }
      ],
      estimatedTime: '5 分钟',
      difficulty: 'easy',
      action: { label: '创建知识对象', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'claim_exists' }
    },
    low_claim_count: {
      title: '添加品牌主张',
      description: '品牌的核心理念和主张尚未被记录，AI 无法理解品牌的核心价值。',
      why: 'AI 需要明确的品牌主张才能在回答中主动推荐品牌。缺少主张 = 缺少被推荐的理由。',
      impact: [
        { dimension: 'AI 推荐率', gain: 25, unit: '%' }
      ],
      estimatedTime: '10 分钟',
      difficulty: 'medium',
      action: { label: '添加品牌主张', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'claim_exists' }
    },
    untested_claims: {
      title: '验证品牌主张',
      description: '部分品牌主张尚未通过验证，需要核实其准确性。',
      why: '未验证的主张缺乏可信度，AI 系统不会引用无来源验证的主张。',
      impact: [
        { dimension: 'AI 信任度', gain: 20, unit: '%' }
      ],
      estimatedTime: '15 分钟',
      difficulty: 'medium',
      action: { label: '验证主张', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'manual' }
    },
    orphan_entities: {
      title: '建立知识关联',
      description: '品牌实体之间存在孤立，需要建立它们之间的关系网络。',
      why: '关联的知识网络能让 AI 更全面理解品牌，提高被引用的深度和质量。',
      impact: [
        { dimension: 'AI 理解深度', gain: 20, unit: '%' }
      ],
      estimatedTime: '10 分钟',
      difficulty: 'medium',
      action: { label: '建立关联', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'manual' }
    }
  }

  /**
   * Generate Missions from an IssueGraph.
   * Uses the new `kindId` field on Issue to find the right template.
   */
  static generate(graph: IssueGraph, brandId: string, brandName: string): Mission[] {
    const missions: Mission[] = []
    const rootCauseSet = new Set(graph.rootCauses)

    for (const issue of graph.nodes) {
      // Try kindId first, fall back to kind
      const template = this.MISSION_MAP[issue.kindId || issue.kind]
      if (!template) continue

      // 计算优先级分数：severity * confidence * rootCause权重
      const isRootCause = rootCauseSet.has(issue.id)
      const score = Math.round(issue.severity * issue.confidence * 100 * (isRootCause ? 1.5 : 1.0))

      missions.push({
        id: `${brandId}-mission-${issue.id.slice(-8)}`,
        brandId,
        title: template.title,
        description: template.description,
        why: template.why,
        impact: template.impact,
        estimatedTime: template.estimatedTime,
        difficulty: template.difficulty,
        action: { ...template.action },
        verification: { ...template.verification },
        status: 'pending',
        sourceIssueKind: issue.kindId || issue.kind,
        score,
        createdAt: new Date().toISOString(),
        order: isRootCause ? 0 : 1,  // 根因排前面
      })
    }

    // 按 order 排序，同 order 按 score 降序
    missions.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return b.score - a.score
    })

    return missions
  }

  /**
   * 空数据状态：品牌没有数据时，生成数据准备任务
   */
  static generateEmptyMissions(brandId: string): Mission[] {
    return [{
      id: `${brandId}-mission-data-gap`,
      brandId,
      title: '创建首个知识对象',
      description: '品牌尚未创建任何知识对象，AI 系统无法了解品牌基本信息。',
      why: '没有知识对象意味着 AI 对品牌一无所知，这是品牌 AI 可见度为零的根本原因。',
      impact: [
        { dimension: 'AI 可见度', gain: 40, unit: '%' },
        { dimension: 'AI 引用率', gain: 35, unit: '%' }
      ],
      estimatedTime: '5 分钟',
      difficulty: 'easy',
      action: { label: '创建知识对象', type: 'navigate', destination: '/workspace/geo/knowledge' },
      verification: { type: 'claim_exists' },
      status: 'pending',
      sourceIssueKind: 'data_gap',
      score: 100,
      createdAt: new Date().toISOString(),
      order: 0,
    }]
  }
}
