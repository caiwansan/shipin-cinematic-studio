// ============================================================
// anchor-sync-layer.ts
//
// 职责：Phase 4.1 — Anchor Synchronization Layer
//   不是新 stage，不是 validator 增强
//   是 ExecutionContext 级别的世界预处理层
//
// 3 层结构：
//   1. World Snapshot Builder  — 收集各 domain 的原始世界描述
//   2. Constraint Projection  — 翻译成 validator 可用的约束
//   3. Conflict Pre-resolver  — D1 之前消解已知矛盾
//
// 设计原则：
//   - Deterministic：同 input → 同 world snapshot
//   - Directional：character → scene → storyboard（单向）
//   - Non-overwriting：不覆盖原 domain data，只生成 constraint view
//   - 改的是"世界"，不是"裁判"
// ============================================================

import type { ExecutionContext, SyncConstraints } from './pipeline/types.js'

// ─── 领域上下文类型 ────────────────────────────────────

export interface CharacterContext {
  name: string
  visualTone: string        // e.g. "冷峻/强光/高对比"
  identityDetails: string[]
}

export interface SceneContext {
  description: string
  composition: string       // e.g. "前景吧台/背景调酒架"
  lightingInfo: string      // e.g. "柔光/暗环境/暖色"
}

export interface StoryboardContext {
  intent: string            // e.g. "紧张对峙/慢镜头"
  shotSequence: string[]    // e.g. ["特写", "中景", "宽景"]
}

// ─── 世界快照 ──────────────────────────────────────────

export interface WorldSnapshot {
  character?: CharacterContext
  scene?: SceneContext
  storyboard?: StoryboardContext
  timestamp: number
}

export interface ResolvedConflict {
  type: string
  domains: string[]
  resolution: 'weighted_blend' | 'scene_override' | 'character_override' | 'conservative'
  resolved: boolean
}

// ─── AnchorSync Layer ───────────────────────────────────

export class AnchorSyncLayer {

  // ── ① World Snapshot Builder ──
  static buildWorldSnapshot(ctx: ExecutionContext): WorldSnapshot {
    const snapshot: WorldSnapshot = { timestamp: Date.now() }

    // 从 ExecutionContext 中读取已有 domain 信息
    // 未来来源：Scene Bible / Character Identity Lock / Storyboard Manifest
    if (ctx.identityLockId) {
      snapshot.character = {
        name: ctx.identityLockId.replace(/^char:/, ''),
        visualTone: '',
        identityDetails: ['identity-lock-active'],
      }
    }

    if (ctx.sceneBibleId) {
      snapshot.scene = {
        description: '',
        composition: '',
        lightingInfo: '',
      }
    }

    return snapshot
  }

  // ── ② Constraint Projection Engine ──
  static projectConstraints(snapshot: WorldSnapshot): SyncConstraints {
    const constraints: SyncConstraints = {}

    // Character → Lighting/Identity
    if (snapshot.character) {
      constraints.lighting = {
        preferred: snapshot.character.visualTone || 'neutral',
        conflictSources: ['character'],
        conflictSignals: [],
      }
      constraints.identity = {
        characterName: snapshot.character.name,
        visualExpectations: snapshot.character.identityDetails,
      }
    }

    // Scene → Spatial + Lighting override hint
    if (snapshot.scene) {
      constraints.spatial = {
        layout: snapshot.scene.composition || 'unknown',
        source: 'scene',
      }
      // Scene lighting 作为辅助参考（不覆盖 character lighting）
      if (snapshot.scene.lightingInfo) {
        if (!constraints.lighting) {
          constraints.lighting = {
            preferred: snapshot.scene.lightingInfo,
            conflictSources: ['scene'],
            conflictSignals: [],
          }
        } else {
          constraints.lighting.conflictSources.push('scene')
          // 检测 lighting 不一致
          if (constraints.lighting.preferred !== snapshot.scene.lightingInfo) {
            constraints.lighting.conflictSignals.push(
              `character expects "${constraints.lighting.preferred}", scene says "${snapshot.scene.lightingInfo}"`
            )
          }
        }
      }
    }

    return constraints
  }

  // ── ③ Conflict Pre-resolver ──
  static preResolve(constraints: SyncConstraints): ResolvedConflict[] {
    const resolved: ResolvedConflict[] = []

    if (constraints.lighting && constraints.lighting.conflictSignals.length > 0) {
      // lighting 冲突：方向 character → scene → storyboard
      // 当前策略：weighted_blend（不覆盖任何一方，标记冲突已识别）
      resolved.push({
        type: 'lighting_conflict',
        domains: constraints.lighting.conflictSources,
        resolution: 'weighted_blend',
        resolved: true,
      })
    }

    return resolved
  }

  // ── 完整处理管道 ──
  static process(ctx: ExecutionContext): {
    snapshot: WorldSnapshot
    constraints: SyncConstraints
    resolvedConflicts: ResolvedConflict[]
  } {
    const snapshot = this.buildWorldSnapshot(ctx)
    const constraints = this.projectConstraints(snapshot)
    const resolvedConflicts = this.preResolve(constraints)

    return { snapshot, constraints, resolvedConflicts }
  }
}
