/**
 * Execution Planner — ExecutableCapabilityPlan → 声明式 Execution DAG
 *
 * ═══════════════════════════════════════════════════════════════
 * S3.3: Execution Planner
 *
 *   ExecutableCapabilityPlan（可执行能力计划）
 *   │
 *   └── buildExecutionDAG() ── 纯函数
 *       │
 *       ▼
 *   ExecutionDAG（声明式执行图 — What, not How）
 *
 * 核心原则：
 *   - 输出是声明式 DAG（描述 What，不是 How）
 *   - 不输出执行逻辑（无 retry / timeout / worker / concurrency）
 *   - 节点是 Capability Node（不包含 Provider 名、Worker 名）
 *   - 所有节点和边使用 Stable ID
 *   - 每个节点至少绑定一个 Capability
 *   - 边表示执行依赖（depends-on）
 *
 * ═══════════════════════════════════════════════════════════════
 */

import type { ExecutableCapabilityPlan, ExecutableShotCapability, CapabilityId } from './capability-negotiator.js'

// ─── 类型定义 ──────────────────────────────────────────

/**
 * Execution DAG 节点
 *
 * 注意：type 是 Capability Node 类型（如 'film.character.reference'），
 * 不是 Runtime 类型（如 'render' / 'inference' / 'worker'）。
 */
export interface DAGNode {
  id: string            // Stable ID（dag_node_{timestamp_random}）
  type: string          // Capability ID 或派生类型
  label: string         // 可读标签
  requiredCapabilities: CapabilityId[]
  metadata: {
    sourceShotId: string
    fallbackStrategy: string | null
    isOptional: boolean  // true = 此节点失败不影响整体执行
  }
}

/** DAG 边（执行依赖） */
export interface DAGEdge {
  id: string            // Stable ID（dag_edge_{timestamp_random}）
  source: string        // 前置节点 ID
  target: string        // 后置节点 ID
  type: 'depends-on'    // 当前只有这一种依赖类型
}

/** 声明式 Execution DAG */
export interface ExecutionDAG {
  id: string
  sourcePlanId: string
  nodes: DAGNode[]
  edges: DAGEdge[]
  metadata: {
    createdAt: string
    nodeCount: number
    edgeCount: number
    hasCycles: boolean
    rootNodes: string[]      // 无入度的节点（入口节点）
    leafNodes: string[]      // 无出度的节点（终端节点）
  }
}

// ─── Execution Contract ────────────────────────────────

export interface ExecutionContractViolation {
  type: 'missing-id' | 'no-capability' | 'broken-dependency' | 'cycle' | 'empty-dag'
  nodeId?: string
  edgeId?: string
  message: string
}

export interface ExecutionContractReport {
  valid: boolean
  violations: ExecutionContractViolation[]
}

/**
 * 验证 Execution DAG 是否满足 Execution Contract。
 *
 * Contract 规定：
 * ① DAG 无环
 * ② 每个 Node 有 Stable ID
 * ③ 每个 Node 至少绑定一个 Capability
 * ④ 所有 Dependency 都存在（source/target 节点存在）
 * ⑤ DAG 非空
 */
export function validateExecutionDAG(dag: ExecutionDAG): ExecutionContractReport {
  const violations: ExecutionContractViolation[] = []
  const nodeIds = new Set(dag.nodes.map(n => n.id))

  // ① DAG 非空
  if (dag.nodes.length === 0) {
    violations.push({ type: 'empty-dag', message: 'DAG 为空，没有任何节点' })
    return { valid: false, violations }
  }

  // ② 每个 Node 有 Stable ID
  for (const node of dag.nodes) {
    if (!node.id) {
      violations.push({ type: 'missing-id', message: '节点缺少 ID：' + node.label })
    }
  }

  // ③ 每个 Node 至少绑定一个 Capability
  for (const node of dag.nodes) {
    if (!node.requiredCapabilities || node.requiredCapabilities.length === 0) {
      violations.push({
        type: 'no-capability',
        nodeId: node.id,
        message: '节点 ' + node.id + ' 未绑定任何 Capability',
      })
    }
  }

  // ④ 所有 Dependency 都存在
  for (const edge of dag.edges) {
    if (!edge.id) {
      violations.push({ type: 'missing-id', edgeId: edge.id, message: '边缺少 ID' })
    }
    if (!nodeIds.has(edge.source)) {
      violations.push({
        type: 'broken-dependency',
        edgeId: edge.id,
        message: '边 ' + edge.id + ' 的 source 节点 ' + edge.source + ' 不存在',
      })
    }
    if (!nodeIds.has(edge.target)) {
      violations.push({
        type: 'broken-dependency',
        edgeId: edge.id,
        message: '边 ' + edge.id + ' 的 target 节点 ' + edge.target + ' 不存在',
      })
    }
  }

  // ⑤ DAG 无环（DFS）
  const adjList = new Map<string, string[]>()
  for (const node of dag.nodes) adjList.set(node.id, [])
  for (const edge of dag.edges) {
    adjList.get(edge.source)?.push(edge.target)
  }
  const visited = new Set<string>()
  const inStack = new Set<string>()
  function hasCycle(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    inStack.add(nodeId)
    for (const next of adjList.get(nodeId) || []) {
      if (hasCycle(next)) return true
    }
    inStack.delete(nodeId)
    return false
  }
  for (const node of dag.nodes) {
    visited.clear()
    inStack.clear()
    if (hasCycle(node.id)) {
      violations.push({ type: 'cycle', message: 'DAG 中存在循环依赖' })
      break
    }
  }

  return { valid: violations.length === 0, violations }
}

// ─── 主构建函数 ────────────────────────────────────────

/**
 * 从 ExecutableCapabilityPlan 构建声明式 Execution DAG。
 *
 * @param plan - CapabilityNegotiator 输出的可执行能力计划
 * @returns ExecutionDAG + 契约验证报告
 */
export function buildExecutionDAG(plan: ExecutableCapabilityPlan): {
  dag: ExecutionDAG
  contract: ExecutionContractReport
} {
  const nodes: DAGNode[] = []
  const edges: DAGEdge[] = []

  // 第一阶段：为每个 shot 创建能力节点
  const shotNodeMapping = new Map<string, {
    keyframeId: string
    charRefId: string
    shotId: string
  }>()

  for (const shot of plan.shots) {
    const mapping: { keyframeId?: string; charRefId?: string; shotId?: string } = {}

    for (const cap of shot.capabilities) {
      const nodeId = generateNodeId()

      // 按能力类型创建节点
      switch (cap.capabilityId) {
        case 'film.character.reference':
          if (cap.resolved !== 'none') {
            const node = createCapabilityNode(nodeId, cap.capabilityId, shot.shotId, {
              label: '角色参考：' + shot.shotId,
              fallback: cap.fallback?.strategy || null,
              isOptional: cap.resolved === 'partial',
            })
            nodes.push(node)
            mapping.charRefId = nodeId
          }
          break

        case 'film.keyframe':
          if (cap.resolved !== 'none') {
            const node = createCapabilityNode(nodeId, cap.capabilityId, shot.shotId, {
              label: '关键帧：' + shot.shotId,
              fallback: cap.fallback?.strategy || null,
              isOptional: cap.resolved === 'partial',
            })
            nodes.push(node)
            mapping.keyframeId = nodeId
          }
          break

        case 'film.camera.path':
          if (cap.resolved !== 'none') {
            nodes.push(createCapabilityNode(nodeId, cap.capabilityId, shot.shotId, {
              label: '相机路径：' + shot.shotId,
              fallback: cap.fallback?.strategy || null,
              isOptional: true,
            }))
          }
          break

        case 'film.render.shot':
          if (cap.resolved !== 'none') {
            nodes.push(createCapabilityNode(nodeId, cap.capabilityId, shot.shotId, {
              label: '渲染镜头：' + shot.shotId,
              fallback: cap.fallback?.strategy || null,
              isOptional: false,
            }))
            mapping.shotId = nodeId
          }
          break

        default:
          // 其他能力按原样创建
          if (cap.resolved !== 'none') {
            nodes.push(createCapabilityNode(nodeId, cap.capabilityId, shot.shotId, {
              label: cap.capabilityId + '：' + shot.shotId,
              fallback: cap.fallback?.strategy || null,
              isOptional: cap.resolved === 'partial',
            }))
          }
      }
    }

    shotNodeMapping.set(shot.shotId, mapping as { keyframeId: string; charRefId: string; shotId: string })

    // 同一 shot 内的依赖：charRef → keyframe → shot
    const m = mapping as { keyframeId?: string; charRefId?: string; shotId?: string }
    if (m.charRefId && m.keyframeId) {
      edges.push(createDepEdge(m.charRefId, m.keyframeId))
    }
    if (m.charRefId && !m.keyframeId && m.shotId) {
      edges.push(createDepEdge(m.charRefId, m.shotId))
    }
    if (m.keyframeId && m.shotId) {
      edges.push(createDepEdge(m.keyframeId, m.shotId))
    }
  }

  // 第二阶段：shot 之间按顺序建立依赖
  const shotIds = [...shotNodeMapping.keys()]
  for (let i = 0; i < shotIds.length - 1; i++) {
    const current = shotNodeMapping.get(shotIds[i])
    const next = shotNodeMapping.get(shotIds[i + 1])
    const currentShotNode = current && (current as any).shotId
    const nextShotNode = next && (next as any).shotId
    if (currentShotNode && nextShotNode) {
      edges.push(createDepEdge(currentShotNode, nextShotNode))
    }
  }

  // 计算根节点和叶节点
  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()
  for (const node of nodes) {
    inDegree.set(node.id, 0)
    outDegree.set(node.id, 0)
  }
  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1)
  }
  const rootNodes = [...inDegree.entries()].filter(([_, d]) => d === 0).map(([id]) => id)
  const leafNodes = [...outDegree.entries()].filter(([_, d]) => d === 0).map(([id]) => id)

  // 计算是否有环（先创建基础结构，再验证）
  const dag: ExecutionDAG = {
    id: `dag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    sourcePlanId: plan.id,
    nodes,
    edges,
    metadata: {
      createdAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      hasCycles: false, // 由 Contract 验证确定
      rootNodes,
      leafNodes,
    },
  }

  const contract = validateExecutionDAG(dag)
  dag.metadata.hasCycles = contract.violations.some(v => v.type === 'cycle')

  return { dag, contract }
}

// ─── 辅助函数 ──────────────────────────────────────────

function generateNodeId(): string {
  return `dag_node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function generateEdgeId(): string {
  return `dag_edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function createCapabilityNode(
  id: string,
  capabilityId: string,
  sourceShotId: string,
  options: { label: string; fallback: string | null; isOptional: boolean },
): DAGNode {
  return {
    id,
    type: capabilityId,
    label: options.label,
    requiredCapabilities: [capabilityId as CapabilityId],
    metadata: {
      sourceShotId,
      fallbackStrategy: options.fallback,
      isOptional: options.isOptional,
    },
  }
}

function createDepEdge(source: string, target: string): DAGEdge {
  return {
    id: generateEdgeId(),
    source,
    target,
    type: 'depends-on',
  }
}
