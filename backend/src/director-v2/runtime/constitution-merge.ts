/**
 * constitution-merge.ts — Constitutional Merge Arbitration
 *
 * Dual-Lane Runtime 的核心合并策略。
 *
 * 原则：
 *   skeleton = source of truth (structure, identity, genre)
 *   enrichment = non-destructive augmentation only
 *
 * 禁止：
 *   - enrichment overwrite theme
 *   - enrichment overwrite genre/environmentType
 *   - enrichment overwrite character laws
 *   - enrichment overwrite tone boundaries
 *
 * 允许：
 *   - enrichment ADD new segments to emotionalTrajectory
 *   - enrichment ADD details to visualDoctrine
 *   - enrichment ADD beatMap entries
 *   - enrichment ADD emotionToVisual mappings
 *   - enrichment ADD visualLock details
 *   - enrichment ADD physicsAnomalies
 */

import type { StoryConstitution } from '../schema/story-constitution.js'

// ============================================================
// Types
// ============================================================

export type MergeAction =
  | { type: 'keep_skeleton'; field: string; reason: string }
  | { type: 'accept_enrichment'; field: string; path: string }
  | { type: 'reject_enrichment'; field: string; reason: string }
  | { type: 'merged'; field: string; description: string }

export interface MergeResult {
  constitution: StoryConstitution
  actions: MergeAction[]
  enrichedSource: 'skeleton' | 'enrichment' | 'mixed'
  skeletonProtectedKeys: string[]
}

// ============================================================
// Protected Keys (skeleton 不可被 enrichment 覆盖)
// ============================================================

/** 这些字段 skeleton 是绝对权威，enrichment 不能覆盖 */
const ABSOLUTE_PROTECTED: string[] = [
  'coreTheme',
  'source',
  'schemaVersion',
  'constitutionVersion',
  'projectId',
  'createdAt',
  'traceId',
]

/** 这些字段内的子字段 skeleton 是权威（enrichment 只能添加不能覆盖） */
const STRUCTURAL_PROTECTED: string[] = [
  'characterLaws',
  'worldPhysics.environmentType',
  'worldPhysics.timePeriod',
  'worldPhysics.scale',
  'toneBoundaries',
  'cinematicIdentity.visualConsistencyLevel',
  'cinematicIdentity.primaryInfluences',
  'pacingDoctrine.structureType',
  'pacingDoctrine.pacingCurve',
  'emotionalTrajectory.dominantEmotion',
  'emotionalTrajectory.arcType',
  'emotionalTrajectory.resolutionTone',
]

// ============================================================
// Merge Arbitration Engine
// ============================================================

export class ConstitutionMergeEngine {
  /**
   * 执行 merge arbitration
   * skeleton 是权威基准，enrichment 提供非破坏性增强。
   */
  merge(
    skeleton: Record<string, unknown>,
    enriched: StoryConstitution,
    options?: {
      /** 允许 enrichment 覆盖特定字段 */
      allowOverrides?: string[]
      /** 严格模式：不信任 enrichment 中的任何覆盖 */
      strictMode?: boolean
    },
  ): MergeResult {
    const actions: MergeAction[] = []
    const skeletonProtectedKeys: string[] = []
    const allowOverrides = new Set(options?.allowOverrides || [])
    const strictMode = options?.strictMode ?? false

    // Clone enriched as base (modify in-place)
    const result: Record<string, unknown> = JSON.parse(JSON.stringify(enriched))

    // ===== Phase 1: Absolute Protected Fields =====
    for (const key of ABSOLUTE_PROTECTED) {
      if (skeleton[key] !== undefined && skeleton[key] !== null) {
        // 检查 enrichment 是否尝试覆盖
        const enrichedVal = JSON.stringify(result[key])
        const skeletonVal = JSON.stringify(skeleton[key])

        if (enrichedVal !== skeletonVal) {
          if (allowOverrides.has(key)) {
            actions.push({
              type: 'accept_enrichment',
              field: key,
              path: `${key}`,
            })
          } else {
            result[key] = skeleton[key]
            actions.push({
              type: 'keep_skeleton',
              field: key,
              reason: 'absolute protected field',
            })
            skeletonProtectedKeys.push(key)
          }
        }
      }
    }

    // ===== Phase 2: Structural Protected Fields =====
    for (const path of STRUCTURAL_PROTECTED) {
      const parts = path.split('.')
      const rootKey = parts[0]

      const skeletonVal = getDeepValue(skeleton, parts)
      const enrichedVal = getDeepValue(result as Record<string, unknown>, parts)

      if (skeletonVal !== undefined && skeletonVal !== null && skeletonVal !== enrichedVal) {
        if (allowOverrides.has(path) || allowOverrides.has(rootKey)) {
          actions.push({
            type: 'accept_enrichment',
            field: path,
            path,
          })
        } else {
          // 恢复 skeleton 值
          setDeepValue(result as Record<string, unknown>, parts, skeletonVal)
          actions.push({
            type: 'keep_skeleton',
            field: path,
            reason: 'structural protected field',
          })
          skeletonProtectedKeys.push(path)
        }
      }
    }

    // ===== Phase 3: Character Laws Merge =====
    // skeleton 的角色列表是权威，enrichment 不能删除或改变角色名
    if (Array.isArray(skeleton.characterLaws) && Array.isArray(result.characterLaws)) {
      const skelChars = skeleton.characterLaws as Array<Record<string, unknown>>
      const enrichChars = result.characterLaws as Array<Record<string, unknown>>

      // 用 characterId 匹配
      const skelMap = new Map<string, Record<string, unknown>>()
      for (const c of skelChars) {
        const id = String(c.characterId || c.name || '')
        skelMap.set(id, c)
      }

      // 保留 enrichment 添加的角色，但覆盖骨架中已有的角色的基础字段
      const mergedChars: Record<string, unknown>[] = []
      const processedIds = new Set<string>()

      for (const ec of enrichChars) {
        const id = String(ec.characterId || ec.name || '')
        processedIds.add(id)

        const sc = skelMap.get(id)
        if (sc) {
          // 骨架角色基础字段优先，enrichment 可以添加细节
          mergedChars.push({
            ...ec,
            characterId: sc.characterId,
            name: sc.name,
            role: sc.role,
          })
          actions.push({
            type: 'merged',
            field: `characterLaws.${id}`,
            description: 'skeleton identity + enrichment details',
          })
        } else {
          // enrichment 新增的角色被保留
          mergedChars.push(ec)
          actions.push({
            type: 'accept_enrichment',
            field: `characterLaws.${id}`,
            path: `characterLaws.${id}`,
          })
        }
      }

      // 骨架中有但 enrichment 中没有的角色 → 添加回来
      for (const sc of skelChars) {
        const id = String(sc.characterId || sc.name || '')
        if (!processedIds.has(id)) {
          mergedChars.push(sc)
          actions.push({
            type: 'keep_skeleton',
            field: `characterLaws.${id}`,
            reason: 'missing in enrichment, restored from skeleton',
          })
        }
      }

      result.characterLaws = mergedChars
    }

    // ===== Phase 4: Enrichment-Only Augmentations =====
    // 以下字段 skeleton 不存在时，完全接受 enrichment
    const enrichmentOnlyFields = [
      'visualDoctrine',
      'pacingDoctrine.beatMap',
      'emotionalTrajectory.segments',
      'worldPhysics.physicsAnomalies',
      'cinematicIdentity.signatureElements',
      'cinematicIdentity.eraTags',
      'pacingDoctrine.hookDensity',
      'pacingDoctrine.climaxPlacement',
      'pacingDoctrine.targetHookInterval',
      'pacingDoctrine.targetDuration',
    ]

    for (const field of enrichmentOnlyFields) {
      const parts = field.split('.')
      const enrichedVal = getDeepValue(result as Record<string, unknown>, parts)
      if (enrichedVal !== undefined && enrichedVal !== null) {
        // 确保不为空数组
        if (Array.isArray(enrichedVal) && enrichedVal.length === 0) continue
        if (typeof enrichedVal === 'string' && !enrichedVal.trim()) continue

        const skeletonVal = getDeepValue(skeleton, parts)
        if (skeletonVal === undefined || skeletonVal === null) {
          actions.push({
            type: 'accept_enrichment',
            field,
            path: field,
          })
        }
      }
    }

    // ===== Phase 5: Confidence & Degraded =====
    result.confidence = enriched.confidence
    result.degraded = enriched.degraded

    // Determine enriched source
    const skeletonUsed = actions.some(a => a.type === 'keep_skeleton')
    const enrichedUsed = actions.some(a => a.type === 'accept_enrichment')
    let enrichedSource: 'skeleton' | 'enrichment' | 'mixed'
    if (skeletonUsed && enrichedUsed) enrichedSource = 'mixed'
    else if (skeletonUsed) enrichedSource = 'skeleton'
    else enrichedSource = 'enrichment'

    return {
      constitution: result as unknown as StoryConstitution,
      actions,
      enrichedSource,
      skeletonProtectedKeys,
    }
  }
}

// ============================================================
// Deep Value Utils (path-based get/set)
// ============================================================

function getDeepValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj
  for (const key of path) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function setDeepValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i]
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  current[path[path.length - 1]] = value
}

/** 全局单例 */
export const constitutionMergeEngine = new ConstitutionMergeEngine()
