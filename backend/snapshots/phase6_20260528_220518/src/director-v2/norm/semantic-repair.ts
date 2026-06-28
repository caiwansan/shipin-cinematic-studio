/**
 * semantic-repair.ts — 语义修复层
 *
 * 职责：在 LLM 输出经过 Schema 验证和归一化后，进行语义级别的修复。
 *
 * 这层是 Normalizer 的补充：
 *   Normalizer: 结构归一化（JSON提取/类型强制/默认值）
 *   Repair:     语义归一化（缺失值的智能推断/不一致的修正）
 *
 * 设计原则：
 * - 不引入新事实（只用 LLM 已有或规则库可推断的）
 * - 所有修复必须可审计
 * - 宁可丢字段，不要编造
 */

import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Repair Action
// ============================================================

export interface RepairAction {
  field: string
  type: RepairType
  description: string
  confidence: number  // 0-1，修复的可信度
}

export type RepairType =
  | 'infer_from_context'     // 从上下文推断（如 tone→lighting）
  | 'fill_with_rules'        // 规则库补齐
  | 'fix_inconsistency'      // 修复矛盾字段
  | 'normalize_enum'         // 枚举值归一化
  | 'remove_contradiction'   // 移除相互矛盾的声明

// ============================================================
// Repair Result
// ============================================================

export interface RepairResult {
  constitution: StoryConstitution
  actions: RepairAction[]
  confidence: number  // 修复后的总置信度
}

// ============================================================
// Semantic Repair Engine
// ============================================================

/**
 * 基础的 Tone → Lighting 映射规则
 */
const TONE_TO_LIGHTING: Record<string, string> = {
  'dark': 'low_key',
  'bright': 'high_key',
  'moody': 'chiaroscuro',
  'warm': 'soft_diffused',
  'cold': 'hard_edged',
  'tense': 'dramatic',
  'romantic': 'soft_diffused',
  'horror': 'low_key',
  'dreamy': 'soft_diffused',
  'harsh': 'hard_edged',
}

/**
 * 情绪 → 灯光映射
 */
const EMOTION_TO_LIGHTING: Record<string, string> = {
  '紧张': 'dramatic',
  '恐惧': 'low_key',
  '悲伤': 'natural',
  '快乐': 'high_key',
  '愤怒': 'dramatic',
  '浪漫': 'rim_light',
  '孤独': 'low_key',
  '希望': 'natural',
  '惊讶': 'high_key',
}

export class SemanticRepairEngine {
  /**
   * 运行语义修复
   */
  repair(constitution: StoryConstitution): RepairResult {
    const actions: RepairAction[] = []

    // 1. 修复灯光教义：如果 baseApproach 是默认值但 tone 暗示了特定灯光
    if (
      constitution.visualDoctrine.lightingDoctrine.baseApproach === 'natural' &&
      constitution.emotionalTrajectory.dominantEmotion
    ) {
      const suggested = EMOTION_TO_LIGHTING[constitution.emotionalTrajectory.dominantEmotion]
      if (suggested) {
        actions.push({
          field: 'visualDoctrine.lightingDoctrine.baseApproach',
          type: 'infer_from_context',
          description: `从主导情绪"${constitution.emotionalTrajectory.dominantEmotion}"推断灯光风格为${suggested}`,
          confidence: 0.6,
        })
      }
    }

    // 2. 修复核心主题：如果为空但有情感弧
    if (
      constitution.coreTheme === '未解析' &&
      constitution.emotionalTrajectory.dominantEmotion
    ) {
      actions.push({
        field: 'coreTheme',
        type: 'fill_with_rules',
        description: '核心主题为空但情感弧存在，标记为待人工确认',
        confidence: 0.3,
      })
    }

    // 3. 检查节奏教义的一致性
    if (constitution.pacingDoctrine.beatMap.length > 0) {
      const beats = constitution.pacingDoctrine.beatMap
      const phases = beats.map(b => b.phase)
      const hasClimax = phases.includes('climax')
      const hasSetup = phases.includes('setup')

      if (!hasClimax && beats.length > 0) {
        actions.push({
          field: 'pacingDoctrine.beatMap',
          type: 'fix_inconsistency',
          description: '节奏节拍缺少高潮阶段（climax），建议人工审查',
          confidence: 0.4,
        })
      }

      if (!hasSetup && beats.length > 0) {
        actions.push({
          field: 'pacingDoctrine.beatMap',
          type: 'fix_inconsistency',
          description: '节奏节拍缺少起始阶段（setup），建议人工审查',
          confidence: 0.4,
        })
      }
    }

    // 4. 检查角色 law 的一致性
    for (const law of constitution.characterLaws) {
      if (law.role === 'protagonist' && law.emotionToVisual.length === 0) {
        actions.push({
          field: `characterLaws.${law.characterId}.emotionToVisual`,
          type: 'fill_with_rules',
          description: `主角 ${law.name} 缺少情绪→视觉映射，可能影响情绪表现一致性`,
          confidence: 0.5,
        })
      }
    }

    // 计算修复后的置信度
    const avgConfidence = actions.length > 0
      ? actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length
      : 1.0

    const overallConfidence = Math.round(
      constitution.confidence * 0.7 + avgConfidence * 0.3 * (actions.length > 0 ? 1 : 0),
    )

    return {
      constitution,
      actions,
      confidence: Math.max(0, Math.min(1, overallConfidence)),
    }
  }
}

/** 全局单例 */
export const semanticRepairEngine = new SemanticRepairEngine()
