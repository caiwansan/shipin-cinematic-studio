/**
 * memory/character-memory-graph.ts — Phase 7 角色记忆图
 *
 * 存储角色跨场景的情感状态演化、特质变化、角色间关系网络
 *
 * 宪法：
 *   - 必须跨 scene 延续（不可在场景切换时清空）
 *   - 必须可被 Adaptive Kernel 查询
 *   - 不可变成原始日志（结构化图数据）
 *   - 不可依赖 LLM
 *   - 不可修改 IR
 */

// ─── 类型 ─────────────────────────────────────────────────

export interface EmotionalSnapshot {
  sceneId: string
  emotion: string
  valence: number
  arousal: number
  intensity: number
  timestamp: number   // 运行时 tick 编号
}

export interface TraitEvolution {
  sceneId: string
  traitName: string
  previousValue: string
  newValue: string
  trigger: string
}

export interface RelationshipState {
  targetId: string
  affinity: number     // -1 (hostile) 到 1 (close)
  lastInteractionScene: string
  lastValence: number
}

export interface CharacterMemory {
  characterId: string
  characterName: string
  emotionalStates: EmotionalSnapshot[]
  traitsEvolution: TraitEvolution[]
  relationships: Map<string, RelationshipState>
}

// ─── CharacterMemoryGraph ─────────────────────────────────

export class CharacterMemoryGraph {
  private characters = new Map<string, CharacterMemory>()

  /** 注册或获取角色 */
  ensureCharacter(id: string, name: string): CharacterMemory {
    let cm = this.characters.get(id)
    if (!cm) {
      cm = { characterId: id, characterName: name, emotionalStates: [], traitsEvolution: [], relationships: new Map() }
      this.characters.set(id, cm)
    }
    return cm
  }

  /** 记录情感快照 */
  recordEmotion(characterId: string, sceneId: string, emotion: string, valence: number, arousal: number, intensity: number, tick: number): void {
    const cm = this.characters.get(characterId)
    if (!cm) return
    cm.emotionalStates.push({ sceneId, emotion, valence, arousal, intensity, timestamp: tick })
  }

  /** 记录特质变化 */
  recordTrait(characterId: string, sceneId: string, traitName: string, from: string, to: string, trigger: string): void {
    const cm = this.characters.get(characterId)
    if (!cm) return
    cm.traitsEvolution.push({ sceneId, traitName, previousValue: from, newValue: to, trigger })
  }

  /** 更新关系 */
  updateRelationship(characterId: string, targetId: string, sceneId: string, affinity: number, valence: number): void {
    const cm = this.characters.get(characterId)
    if (!cm) return
    cm.relationships.set(targetId, { targetId, affinity, lastInteractionScene: sceneId, lastValence: valence })
  }

  /** 查询聚合情感趋势：最近 N 个快照的平均 valence */
  getEmotionalTrend(characterId: string, count: number = 5): { avgValence: number; avgArousal: number; volatility: number } | null {
    const cm = this.characters.get(characterId)
    if (!cm || cm.emotionalStates.length === 0) return null
    const recent = cm.emotionalStates.slice(-count)
    const avgV = recent.reduce((s, e) => s + e.valence, 0) / recent.length
    const avgA = recent.reduce((s, e) => s + e.arousal, 0) / recent.length
    // volatility = valence 标准差
    const variance = recent.reduce((s, e) => s + (e.valence - avgV) ** 2, 0) / recent.length
    return { avgValence: avgV, avgArousal: avgA, volatility: Math.sqrt(variance) }
  }

  /** 获取角色之间的亲和力 */
  getAffinity(a: string, b: string): number | null {
    const cm = this.characters.get(a)
    if (!cm) return null
    const rel = cm.relationships.get(b)
    return rel?.affinity ?? null
  }

  /** 导出完整快照（用于序列化） */
  snapshot(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [id, cm] of this.characters) {
      out[id] = {
        name: cm.characterName,
        emotionalSnapshotCount: cm.emotionalStates.length,
        avgValence: cm.emotionalStates.length > 0
          ? cm.emotionalStates.reduce((s, e) => s + e.valence, 0) / cm.emotionalStates.length
          : 0,
        relationshipCount: cm.relationships.size,
        traitChanges: cm.traitsEvolution.length,
      }
    }
    return out
  }

  /** 重置 */
  clear(): void {
    this.characters.clear()
  }
}

export default CharacterMemoryGraph
