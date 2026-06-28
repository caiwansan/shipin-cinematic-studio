/**
 * story/scene-graph.ts — Phase 2 场景图核心类型
 *
 * Story Graph 是外部输入契约（External Input Contract）。
 * 系统是 rendered，不是 narrative owner。
 *
 * 宪法：
 *   1. Story Graph 由上游/前端构造，系统被动消费
 *   2. 结构是纯数据（pure data），不含推断逻辑
 *   3. 场景间关系是 optional 的（前端可以不传）
 *   4. 不调 LLM，不自动扩展
 */

// ─── SceneNode ─────────────────────────────────────────────────

export interface SceneNode {
  /** 场景唯一标识 */
  id: string

  /** 场景类型：叙事阶段 */
  type: 'intro' | 'conflict' | 'escalation' | 'resolution' | 'custom'

  /** 场景描述（用于辅助推断，可选） */
  description?: string

  /** 参考 shot graph（可选 — 如不传则从 description 推断） */
  shotGraph?: unknown

  /** 场景间关系（可选 — 前端可以不传关系） */
  relations?: {
    /** 此场景由哪个场景触发 */
    causedBy?: string
    /** 此场景升级/恶化哪个场景 */
    escalates?: string
    /** 此场景解决哪个场景 */
    resolves?: string
  }
}

// ─── StoryGraph ──────────────────────────────────────────────

/**
 * 完整故事图
 *
 * scenes 顺序决定叙事流程。
 * 每个 SceneNode 独立描述一个场景。
 */
export interface StoryGraph {
  /** 场景列表（顺序 = 叙事顺序） */
  scenes: SceneNode[]

  /** 可选：全局故事标题/描述 */
  title?: string
  description?: string
}

// ─── SceneGraph ──────────────────────────────────────────────

/**
 * 展开后的场景图（编译后结构）
 * 包含场景索引和关系映射
 */
export interface CompileSceneGraph {
  scenes: SceneNode[]
  /** sceneId → SceneNode 快速索引 */
  index: Record<string, SceneNode>
  /** 场景间关系图 (sceneId → relation types) */
  relationGraph: Record<string, string[]>
  /** 叙事顺序（sceneId 数组） */
  sequence: string[]
}

// ─── expandSceneGraph ──────────────────────────────────────

/**
 * 将原始 StoryGraph 展开为可消费的 CompileSceneGraph
 *
 * 不做 LLM 推断，仅做结构索引化
 * - 建立 sceneId 索引
 * - 解析 relations
 * - 确认 sequence
 */
export function expandSceneGraph(story: StoryGraph): CompileSceneGraph {
  const index: Record<string, SceneNode> = {}
  const relationGraph: Record<string, string[]> = {}
  const sequence: string[] = []

  for (const scene of story.scenes) {
    index[scene.id] = scene
    sequence.push(scene.id)

    // 解析关系
    const rels: string[] = []
    if (scene.relations?.causedBy) rels.push(`causedBy:${scene.relations.causedBy}`)
    if (scene.relations?.escalates) rels.push(`escalates:${scene.relations.escalates}`)
    if (scene.relations?.resolves) rels.push(`resolves:${scene.relations.resolves}`)
    relationGraph[scene.id] = rels
  }

  return { scenes: story.scenes, index, relationGraph, sequence }
}

export default { expandSceneGraph }
