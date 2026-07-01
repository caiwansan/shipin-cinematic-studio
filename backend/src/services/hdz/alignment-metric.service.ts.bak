/**
 * services/hdz/alignment-metric.service.ts — Phase X.3 Alignment Score Engine
 *
 * Writer → WorldModel 对齐评分系统。
 * 衡量 Writer 对世界的理解程度，而不是文本质量。
 *
 * 三维评分：
 *   existence_coverage    — Writer 感知了多少场景涉及的实体
 *   transition_correctness — Writer 的 state_delta 有多少合法变更
 *   entity_recall          — SceneGraph 中的实体被 Writer 调用了几成
 *
 * 综合：overall_score = 0.4 * existence_coverage + 0.4 * transition_correctness + 0.2 * entity_recall
 */

import { prisma } from '../../utils/index.js'
import type { StateDelta, EntityState } from './world-state.service.js'
import { getEntityState } from './world-state.service.js'
import type { SceneGraph } from './scene-compiler.service.js'

// ─── 类型定义 ───

export interface AlignmentScore {
  existence_coverage: number     // 0–1, Writer delta 覆盖了多少场景实体
  transition_correctness: number // 0–1, delta 变更中合法比例
  entity_recall: number          // 0–1, Writer 实际调用了场景中多少实体
  overall_score: number          // 0–1, 加权综合
  details: {
    scene_entity_count: number
    writer_entity_count: number
    valid_delta_count: number
    invalid_delta_count: number
    missing_entities: string[]
    illegal_transitions: string[]
  }
}

export interface WriterShadowMeta {
  entity_coverage: number
  transition_score: number
  recall_ratio: number
  parse_confidence: number       // 0–1, 对 Writer 输出结构化解析的信心度
}

export interface AlignmentRecord {
  chapterId: string
  projectId: string
  chapterNo: number
  score: AlignmentScore
  shadowStateDelta: StateDelta[]
  timestamp: string
}

// ─── Alignment Score Engine ───

class AlignmentMetricService {
  /**
   * 计算一次 Writer 输出的对齐评分
   *
   * @param sceneEntities  SceneGraph 中涉及的实体 entity_id 列表
   * @param writerDelta    Writer 输出的 state_delta（可能为空/无效）
   * @param worldSnapshot  当前世界状态快照（用于校验合法性）
   */
  calculateAlignmentScore(
    sceneEntities: string[],
    writerDelta: StateDelta[],
    worldSnapshot: Map<string, EntityState>,
  ): AlignmentScore {
    const deltaEntityIds = new Set(writerDelta.map(d => d.entityId))

    // ── 1. existence_coverage — Writer 的 delta 覆盖了多少场景实体 ──
    const sceneSet = new Set(sceneEntities)
    const covered = sceneEntities.filter(eid => deltaEntityIds.has(eid))
    const existenceCoverage = sceneEntities.length > 0
      ? covered.length / sceneEntities.length
      : 1  // 没有场景实体则视为覆盖完全

    // ── 2. transition_correctness — 合法变更的比例 ──
    let validCount = 0
    let invalidCount = 0
    const missingEntities: string[] = []
    const illegalTransitions: string[] = []

    for (const delta of writerDelta) {
      // 检查实体是否在场景中存在
      if (!sceneSet.has(delta.entityId)) {
        // Writer 引用了场景外的实体，不罚分但不计为有效
        // （允许 Writer 感知场景外事物是有益的行为）
        continue
      }

      // 检查禁止转换
      const state = worldSnapshot.get(delta.entityId)
      if (state) {
        // 已死不可复生
        if (delta.statusFlagChanges?.isAlive === true && state.statusFlags?.isAlive === false) {
          invalidCount++
          illegalTransitions.push(`${delta.entityId}: 已死角色被复生`)
          continue
        }
        // 失物不可凭空消失（如果 inventoryRemove 里的物品不在库存中）
        if (delta.inventoryRemove && delta.inventoryRemove.length > 0) {
          const inv: string[] = state.inventory || []
          for (const item of delta.inventoryRemove) {
            if (!inv.includes(item)) {
              illegalTransitions.push(`${delta.entityId}: 移除不在库存中的物品 ${item}`)
            }
          }
        }
      }

      // 检查 entity 是否在场景中
      if (!sceneSet.has(delta.entityId)) {
        missingEntities.push(delta.entityId)
      }

      validCount++
    }

    const totalChecked = validCount + invalidCount
    const transitionCorrectness = totalChecked > 0
      ? validCount / totalChecked
      : 1  // 没有 delta 则无法判定，默认高分（因为未犯错）

    // ── 3. entity_recall — Writer 实际调用了场景中多少实体 ──
    const calledEntityIds = new Set<string>()
    for (const delta of writerDelta) {
      if (sceneSet.has(delta.entityId)) {
        calledEntityIds.add(delta.entityId)
      }
    }
    const recall = sceneEntities.length > 0
      ? calledEntityIds.size / sceneEntities.length
      : 1

    // ── 综合 ──
    const overallScore = 0.4 * existenceCoverage + 0.4 * transitionCorrectness + 0.2 * recall

    return {
      existence_coverage: Math.round(existenceCoverage * 1000) / 1000,
      transition_correctness: Math.round(transitionCorrectness * 1000) / 1000,
      entity_recall: Math.round(recall * 1000) / 1000,
      overall_score: Math.round(overallScore * 1000) / 1000,
      details: {
        scene_entity_count: sceneEntities.length,
        writer_entity_count: deltaEntityIds.size,
        valid_delta_count: validCount,
        invalid_delta_count: invalidCount,
        missing_entities: missingEntities,
        illegal_transitions: illegalTransitions,
      },
    }
  }

  /**
   * 从 Writer 的原始输出文本中尝试提取结构化的 shadow_state_delta
   * 使用启发式规则（后续可升级为 LLM 解析）
   *
   * @returns { delta, confidence }  delta 可能是空数组，confidence 0–1
   */
  extractDeltaFromText(chapterText: string, sceneEntities: string[]): { delta: StateDelta[]; confidence: number } {
    const delta: StateDelta[] = []
    let confidence = 0

    // 尝试检测 Writer 是否输出了 state_delta JSON
    const deltaMatch = chapterText.match(/```(?:json)?\s*(\{[\s\S]*?"state_delta"[\s\S]*?\})/)
    if (deltaMatch) {
      try {
        const parsed = JSON.parse(deltaMatch[1])
        if (parsed.state_delta && Array.isArray(parsed.state_delta)) {
          for (const d of parsed.state_delta) {
            if (d.entityId) {
              delta.push({
                entityId: d.entityId,
                health: d.health,
                location: d.location,
                inventoryAdd: d.inventoryAdd,
                inventoryRemove: d.inventoryRemove,
                relationshipChanges: d.relationshipChanges,
                statusFlagChanges: d.statusFlagChanges,
              })
            }
          }
          if (delta.length > 0) confidence = 0.9
        }
      } catch {
        // JSON 解析失败
      }
    }

    // 如果没有结构化 delta，尝试从正文中提取事件
    if (delta.length === 0) {
      // 简单启发式：提取所有角色名，如果某角色在正文中出现次数变化
      // 暂不实现复杂 NLP，标记低自信度
      confidence = 0.1
    }

    return { delta, confidence }
  }

  /**
   * 构建 WriterShadowMeta（供 writer 在 task 中记录）
   */
  buildShadowMeta(score: AlignmentScore, confidence: number): WriterShadowMeta {
    return {
      entity_coverage: score.existence_coverage,
      transition_score: score.transition_correctness,
      recall_ratio: score.entity_recall,
      parse_confidence: confidence,
    }
  }

  /**
   * 持久化对齐评分记录
   */
  async persistAlignmentRecord(
    projectId: string,
    chapterId: string,
    chapterNo: number,
    score: AlignmentScore,
    delta: StateDelta[],
  ): Promise<void> {
    await prisma.writerAlignmentMetric.create({
      data: {
        projectId,
        chapterId,
        scoreJson: score as any,
        shadowStateDelta: delta as any,
      },
    }).catch(e => {
      console.warn(`[AlignmentMetric] persist failed for ch${chapterNo}:`, e?.message)
    })
  }

  /**
   * 获取项目在某个区间内的对齐评分汇总
   */
  async getAlignmentSummary(projectId: string, startChapter?: number, endChapter?: number): Promise<{
    totalChapters: number
    avgScore: number
    scores: Array<{ chapterNo: number; overall: number; time: string }>
  }> {
    const records = await prisma.writerAlignmentMetric.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }) as any[]

    const scores = records
      .map(r => {
        const sj = typeof r.scoreJson === 'string' ? JSON.parse(r.scoreJson) : r.scoreJson
        return { chapterNo: r.chapterId ? parseInt(r.chapterId.replace(/\D/g, '')) || 0 : 0, overall: sj?.overall_score || 0, time: r.createdAt?.toISOString() || '' }
      })
      .filter(s => {
        if (startChapter && s.chapterNo < startChapter) return false
        if (endChapter && s.chapterNo > endChapter) return false
        return true
      })

    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b.overall, 0) / scores.length
      : 0

    return {
      totalChapters: scores.length,
      avgScore: Math.round(avgScore * 1000) / 1000,
      scores,
    }
  }
}

export const alignmentMetricService = new AlignmentMetricService()
