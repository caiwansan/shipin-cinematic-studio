/**
 * Capability Planner — 从 Graph Runtime 推导电影所需的理想能力集合
 *
 * ═══════════════════════════════════════════════════════════════
 * S3.1: Capability Planner
 *
 *   Graph Runtime（Semantic Graph — 表达关系）
 *   │
 *   └── planFromGraph() ── 纯函数、Provider 不可见
 *       │
 *       ▼
 *   CapabilityPlan（理想能力集合）
 *
 * 核心原则：
 *   - 永远不感知 Provider（不查询任何 Provider 名称或能力）
 *   - 永远回答"电影需要什么"，不问"谁能做"
 *   - 能力级别使用 level 体系，不用 boolean
 *     - full: 该 shot 完整需要此项能力
 *     - partial: 该 shot 需要部分能力支持
 *     - none: 该 shot 不需要
 *   - 输入：Graph Runtime（四视图中的 Dependency View + Event View）
 *   - 输出：CapabilityPlan（每个 shot 一张能力需求表）
 *
 * ═══════════════════════════════════════════════════════════════
 */

import type { GraphRuntime } from './graph-runtime.js'
import { toDependency, toEventGraph, toSceneGraph } from './semantic-graph-builder.js'

// ─── 类型定义 ──────────────────────────────────────────

export type CapabilityLevel = 'full' | 'partial' | 'none'

/**
 * 单一镜头的理想能力需求
 */
export interface ShotCapability {
  shotId: string
  /** 能力名 → 需求级别 */
  needs: Record<string, CapabilityLevel>
  /** 推导理由 */
  rationale: string[]
}

/**
 * Capability Plan — 理想能力集合
 * 由 Capability Planner 输出，Capability Negotiator 消费
 */
export interface CapabilityPlan {
  id: string
  shots: ShotCapability[]
  metadata: {
    totalShots: number
    maxConcurrency: number
    createdAt: string
    sourceGraphId: string
  }
}

// ─── 能力定义表 ────────────────────────────────────────

/**
 * 昆仑镜当前支持的电影制作能力。
 * 这是电影语言的固定能力集，不随 Provider 变化。
 *
 * 未来若 FilmLanguageIR 新增属性，在此表追加即可。
 */
export const FILM_CAPABILITIES: Record<string, string> = {
  character_reference: '角色参考图 — 保持角色外观一致性',
  camera_path: '相机路径 — 镜头运动曲线',
  keyframe: '关键帧 — 动作关键帧序列',
  physics_constraint: '物理约束 — 物体交互与碰撞',
  lip_sync: '口型同步 — 音频驱动口型',
  temporal_consistency: '时序一致性 — 镜头间的视觉连贯性',
  lighting_control: '光照控制 — 场景光照参数',
  style_transfer: '风格迁移 — 视觉风格统一',
  spatial_layout: '空间布局 — 场景空间构图',
}

// ─── 主规划函数 ────────────────────────────────────────

/**
 * 从 Graph Runtime 推导理想 Capability Plan。
 *
 * @param graph - Graph Runtime（Semantic Graph）
 * @returns CapabilityPlan — 每个 shot 需要的理想能力
 */
export function planFromGraph(graph: GraphRuntime): CapabilityPlan {
  const dep = toDependency(graph)
  const events = toEventGraph(graph)
  const scene = toSceneGraph(graph)

  const shots: ShotCapability[] = []

  // 遍历 Dependency View 的并行分组中的所有节点
  for (const group of dep.parallelGroups) {
    for (const nodeId of group) {
      const node = graph.nodes.get(nodeId)
      if (!node) continue

      // 只对 event 和 character 节点做能力规划
      if (node.type === 'event' || node.type === 'character') {
        shots.push(planShot(nodeId, node, graph))
      }
    }
  }

  // 如果没有事件节点（空图），从场景节点和角色节点推导
  if (shots.length === 0) {
    for (const char of scene.characters) {
      shots.push(planShot(char.id, char, graph))
    }
  }

  return {
    id: `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    shots,
    metadata: {
      totalShots: shots.length,
      maxConcurrency: Math.max(1, ...dep.parallelGroups.map(g => g.length)),
      createdAt: new Date().toISOString(),
      sourceGraphId: graph.metadata.sourceIrId,
    },
  }
}

// ─── 单节点能力推导（纯函数） ─────────────────────────

function planShot(
  nodeId: string,
  node: { id: string; type: string; label: string; data: Record<string, any> },
  graph: GraphRuntime,
): ShotCapability {
  const needs: Record<string, CapabilityLevel> = {}
  const rationale: string[] = []

  // 找出该节点关联的所有边
  const outgoingEdges = graph.edges.filter(e => e.source === nodeId)
  const incomingEdges = graph.edges.filter(e => e.target === nodeId)

  // ── 推导 keyframe 需求 ──────────────────────────────
  // 任何事件节点都需要关键帧
  if (node.type === 'event') {
    needs.keyframe = 'full'
    rationale.push(`事件节点 ${node.label}：动作执行需要关键帧序列`)
  } else if (node.type === 'character') {
    needs.keyframe = 'partial'
    rationale.push(`角色节点 ${node.label}：角色存在可能需要关键帧`)
  }

  // ── 推导 camera_path 需求 ────────────────────────────
  // 如果有 camera 约束边 → 需要相机路径
  const hasCameraConstraint = outgoingEdges.some(e => e.type === 'constrains' && e.data?.type === 'camera')
  if (hasCameraConstraint) {
    needs.camera_path = 'full'
    rationale.push(`存在 camera 约束边：需要相机路径规划`)
  }

  // ── 推导 character_reference 需求 ─────────────────────
  // 角色节点需要参考图
  if (node.type === 'character') {
    needs.character_reference = 'full'
    rationale.push(`角色 ${node.label}：需要角色参考图`)
  }

  // ── 推导 physics_constraint 需求 ─────────────────────
  // 如果有 holds 边 → 需要物理约束
  const hasPhysicsInteraction = outgoingEdges.some(e => e.type === 'holds') || incomingEdges.some(e => e.type === 'holds')
  if (hasPhysicsInteraction) {
    needs.physics_constraint = 'full'
    rationale.push(`存在 holds 交互边：需要物理约束`)
  }

  // ── 推导 lip_sync 需求 ──────────────────────────────
  // 如果 outgoing events 中有对话类型
  // 当前 Graph 没有对话节点，但通过场景检查

  // ── 推导 temporal_consistency 需求 ──────────────────
  // 如果有 follows 边 → 需要时序一致性
  const hasFollows = outgoingEdges.some(e => e.type === 'follows') || incomingEdges.some(e => e.type === 'follows')
  if (hasFollows) {
    needs.temporal_consistency = 'full'
    rationale.push(`存在 follows 关系：镜头间需保持视觉连贯性`)
  }

  // ── 推导 lighting_control 需求 ──────────────────────
  // 检查节点数据中是否有光照信息
  if (node.data?.shotType || node.data?.movement) {
    needs.lighting_control = 'partial'
    rationale.push(`镜头 ${node.label}：涉及画面构图可能需要光照控制`)
  }

  // ── 推导 spatial_layout 需求 ────────────────────────
  // 如果有 stands-in 或 part-of 边 → 需要空间布局
  const hasSpatialRelation = outgoingEdges.some(e =>
    ['stands-in', 'part-of', 'attached-to'].includes(e.type),
  )
  if (hasSpatialRelation) {
    needs.spatial_layout = 'full'
    rationale.push(`存在空间关系边（stands-in / part-of）：需要空间布局规划`)
  }

  // ── 推导 style_transfer 需求 ────────────────────────
  // 如果有交互事件 → 可能需要风格统一
  const hasInteraction = outgoingEdges.some(e => e.type === 'interacts-with')
  if (hasInteraction) {
    needs.style_transfer = 'partial'
    rationale.push(`存在交互事件：可能需要风格统一`)
  }

  // 如果某项能力在所有推导后仍未设值且节点类型匹配，默认设为 none
  for (const cap of Object.keys(FILM_CAPABILITIES)) {
    if (!(cap in needs)) {
      needs[cap] = 'none'
    }
  }

  return {
    shotId: nodeId,
    needs,
    rationale,
  }
}
