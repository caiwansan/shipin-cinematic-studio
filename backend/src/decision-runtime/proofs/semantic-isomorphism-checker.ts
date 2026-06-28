/**
 * semantic-isomorphism-checker.ts — Phase B-0 Proof Engine
 *
 * ============================================================
 * Semantic Projection — Trace → Equivalence Class
 * ============================================================
 *
 * 职责：map Trace → Semantic Equivalence Class
 * 不允许：compare raw outputs, 评分逻辑, 统计分析
 *
 * 宪法约束：
 *   1. 不比较原始输出，只映射到等价类
 *   2. 不引入评分逻辑
 *   3. 不引入准确率指标
 *   4. 不引入 heuristic fallback
 *
 * 等价类定义来源：
 *   semantic-equivalence-class-definition.md
 */

import type { DecisionTrace } from '../telemetry/decision-trace.js'

// ============================================================
// 1. 语义等价类 ID 类型
// ============================================================

/** Frame 等价类哈希 */
export type FrameEquivalenceClassId = string

/** Evaluation 等价类哈希（偏序矩阵签名） */
export type EvaluationEquivalenceClassId = string

/** Decision 等价类哈希（因果图签名） */
export type DecisionEquivalenceClassId = string

/** 三层等价类组合 */
export interface SemanticEquivalenceClass {
  frame: FrameEquivalenceClassId
  evaluation: EvaluationEquivalenceClassId
  decision: DecisionEquivalenceClassId
}

// ============================================================
// 2. 语义角色等价组
// ============================================================

/**
 * 语义角色等价组
 *
 * 来源：semantic-equivalence-class-definition.md §1.1
 *
 * "地段" 和 "location" 是同一个语义角色，
 * 等价组内的名称在 Frame 等价性判定中被视为相同。
 */
const SEMANTIC_ROLE_GROUPS: Record<string, string[]> = {
  price: ['price', 'cost', '价格', '单价', 'unit_price', 'pricing'],
  location: ['location', 'location_score', '地段', '区位', 'position', 'area'],
  transportation: ['transportation', 'accessibility', '交通', '通勤', 'transit', 'commute'],
  education: ['education', 'school', '学区', '学校', 'educational'],
  healthcare: ['healthcare', 'hospital', '医疗', '医院', 'medical'],
  quality: ['quality', '品质', '质量', 'grade', 'quality_score'],
  safety: ['safety', 'risk', '安全', '风险', 'security'],
  timeline: ['duration', 'timeline', '时间', '周期', 'time', 'schedule'],
}

/** 反向查询：词 → 等价组 key */
function findRoleGroup(term: string): string {
  for (const [group, members] of Object.entries(SEMANTIC_ROLE_GROUPS)) {
    if (members.some(m => term.toLowerCase().includes(m.toLowerCase()))) {
      return group
    }
  }
  return term // fallback: 使用原词
}

// ============================================================
// 3. Frame Equivalence
// ============================================================

export interface FrameEquivalenceSignature {
  domain: string
  /** 规范化的评价轴签名：{语义角色 → 权重} 按 key 排序 */
  axisSignature: Record<string, number>
  /** 候选实体 key 集合（排序后） */
  candidateKeys: string[]
}

/**
 * 从 Trace 中提取 Frame 等价类签名
 */
export function extractFrameSignature(trace: DecisionTrace): FrameEquivalenceSignature | null {
  // 从 Trace 的事件中寻找 frame 信息
  const frameEvent = trace.events.find(e => e.eventType === 'frame_generated' || e.eventType === 'reasoning_frame_created')
  if (!frameEvent || !frameEvent.payload) return null

  const payload = frameEvent.payload

  // 提取 domain
  const domain = (payload.domain ?? payload.problemDomain ?? 'unknown') as string

  // 提取评价轴（如果在 payload 中）
  const axesPayload = (payload.axes ?? payload.evaluationAxes ?? payload.evaluationAxis ?? []) as Array<Record<string, unknown>>
  const axisSignature: Record<string, number> = {}
  for (const ax of axesPayload) {
    const name = (ax.name ?? ax.axisName ?? 'unknown') as string
    const weight = (ax.weight ?? ax.importance ?? 0) as number
    const roleKey = findRoleGroup(String(name))
    // 如果同一 role group 已有更高权重，保留更高的
    if (axisSignature[roleKey] === undefined || weight > axisSignature[roleKey]) {
      axisSignature[roleKey] = weight
    }
  }

  // 提取候选实体
  const candidates = (payload.candidates ?? payload.options ?? []) as Array<Record<string, unknown>>
  const candidateKeys = candidates.map(c => {
    const id = (c.id ?? c.name ?? c.entityId ?? 'unknown') as string
    const type = (c.type ?? c.entityType ?? 'entity') as string
    return `${domain}_${type}_${id}`
  }).sort()

  return { domain, axisSignature, candidateKeys }
}

/**
 * 生成 Frame 等价类 ID
 *
 * 等价判定：hash(domain + canonical axis + sorted candidate keys)
 */
export function computeFrameEquivalenceClass(trace: DecisionTrace): FrameEquivalenceClassId | null {
  const sig = extractFrameSignature(trace)
  if (!sig) return null

  const canonicalAxis = Object.entries(sig.axisSignature)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.toFixed(4)}`)
    .join(',')

  return simpleHash(`${sig.domain}|${canonicalAxis}|${sig.candidateKeys.join(',')}`)
}

// ============================================================
// 4. Evaluation Equivalence（偏序矩阵）
// ============================================================

export interface EvaluationEquivalenceSignature {
  /** 偏序矩阵：pair → sign(-1, 0, 1) */
  partialOrderMatrix: number[][]
  /** 候选标签（顺序对应矩阵行列） */
  candidateLabels: string[]
}

/**
 * 从 Trace 中提取 Evaluation 偏序矩阵
 */
export function extractEvaluationSignature(trace: DecisionTrace): EvaluationEquivalenceSignature | null {
  const scoreEvent = trace.events.find(e =>
    e.eventType === 'scoring_completed' || e.eventType === 'evaluation_generated'
  )
  if (!scoreEvent || !scoreEvent.payload) return null

  const payload = scoreEvent.payload

  // 优先从 scores 数组提取
  const scores = (payload.scores ?? payload.evaluationScores ?? payload.candidates ?? []) as Array<Record<string, unknown>>
  if (scores.length === 0) return null

  // 提取每个候选的总分
  const labeledScores: Array<{ label: string; totalScore: number }> = scores.map(s => {
    const label = (s.id ?? s.name ?? s.candidateName ?? 'unknown') as string
    const totalScore = (s.totalScore ?? s.score ?? s.total ?? 0) as number
    return { label, totalScore }
  })

  // 按 label 排序以保证确定性
  labeledScores.sort((a, b) => a.label.localeCompare(b.label))

  const candidateLabels = labeledScores.map(s => s.label)
  const n = candidateLabels.length
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0
      } else {
        const diff = labeledScores[i].totalScore - labeledScores[j].totalScore
        // sign: -1 (i<j), 0 (tie), 1 (i>j)
        // 排除浮点噪声：|diff| < δ_min 视为 0
        const δ_min = 0.01
        matrix[i][j] = Math.abs(diff) < δ_min ? 0 : Math.sign(diff)
      }
    }
  }

  return { partialOrderMatrix: matrix, candidateLabels }
}

/**
 * 生成 Evaluation 等价类 ID
 *
 * 等价判定：偏序矩阵逐元素相等
 */
export function computeEvaluationEquivalenceClass(trace: DecisionTrace): EvaluationEquivalenceClassId | null {
  const sig = extractEvaluationSignature(trace)
  if (!sig) return null

  const matrixStr = sig.partialOrderMatrix.map(row => row.join('')).join('|')
  return simpleHash(`${sig.candidateLabels.join(',')}|${matrixStr}`)
}

// ============================================================
// 5. Decision Equivalence（因果图同构）
// ============================================================

export interface CausalGraphNode {
  id: string
  /** 节点类型标签 */
  label: 'primary_factor' | 'secondary_factor' | 'correction_factor' | 'anomaly_factor' | 'decision_node' | 'intervention'
  /** 节点名称 */
  name: string
}

export interface CausalGraphEdge {
  source: string
  target: string
}

export interface CausalGraph {
  nodes: CausalGraphNode[]
  edges: CausalGraphEdge[]
  /** 主结论节点 */
  primaryFactorId?: string
}

export interface DecisionEquivalenceSignature {
  /** 标准化因果图 */
  normalizedGraph: CausalGraph
}

/**
 * 从 Trace 的 report 事件或 recommendation 事件中提取因果图
 */
export function extractDecisionGraph(trace: DecisionTrace): CausalGraph | null {
  // 优先使用 recommendation_computed 事件（A-0.6 新增）
  const recEvent = trace.events.find(e =>
    e.eventType === 'recommendation_computed'
  )

  if (recEvent?.payload) {
    return extractDecisionGraphFromRecommendationEvent(recEvent.payload as Record<string, unknown>)
  }

  const reportEvent = trace.events.find(e =>
    e.eventType === 'report_generated' || e.eventType === 'recommendation_generated'
  )
  if (!reportEvent || !reportEvent.payload) return null

  const payload = reportEvent.payload

  // 提取候选排序
  const candidates = (payload.candidates ?? payload.recommendations ?? payload.options ?? []) as Array<Record<string, unknown>>

  // 提取评估轴
  const axesPayload = (payload.axes ?? payload.evaluationAxes ?? []) as Array<Record<string, unknown>>

  if (candidates.length === 0 && axesPayload.length === 0) {
    // 尝试从 recommendation 字段提取
    const rec = payload.recommendation as Record<string, unknown> | undefined
    if (rec) {
      return extractDecisionGraphFromRecommendation(rec)
    }
    return null
  }

  const nodes: CausalGraphNode[] = []
  const edges: CausalGraphEdge[] = []

  // 添加 evaluation axes 作为因子节点
  const axisNodes: Array<{ id: string; label: CausalGraphNode['label']; weight: number }> = []
  for (const ax of axesPayload) {
    const name = (ax.name ?? ax.axisName ?? 'unknown_axis') as string
    const weight = (ax.weight ?? ax.importance ?? 0) as number
    const id = `ax_${name}`

    let label: CausalGraphNode['label']
    if (weight >= 0.25) label = 'primary_factor'
    else if (weight >= 0.1) label = 'secondary_factor'
    else if (weight >= 0.05) label = 'correction_factor'
    else label = 'correction_factor'

    nodes.push({ id, label, name: String(name) })
    axisNodes.push({ id, label, weight })
  }

  // 找到 primary factor（权重最高轴）
  axisNodes.sort((a, b) => b.weight - a.weight)
  const primaryFactorId = axisNodes.length > 0 ? axisNodes[0].id : undefined

  // 添加候选实体节点
  const candidateIds: string[] = []
  for (const c of candidates) {
    const name = (c.name ?? c.id ?? c.entityName ?? 'unknown') as string
    const id = `cand_${name}`
    nodes.push({ id, label: 'decision_node', name: String(name) })
    candidateIds.push(id)
  }

  // 构建因果边：因子 → 候选实体
  for (const axNode of axisNodes) {
    for (const candId of candidateIds) {
      edges.push({ source: axNode.id, target: candId })
    }
  }

  // 去除低权重修正因子（weight < 0.05）
  const filteredAxisIds = new Set(axisNodes.filter(a => a.weight >= 0.05).map(a => a.id))

  return {
    nodes: nodes.filter(n => {
      if (n.label === 'correction_factor' && !filteredAxisIds.has(n.id)) return false
      return true
    }),
    edges: edges.filter(e => filteredAxisIds.has(e.source)),
    primaryFactorId,
  }
}

/**
 * 从 recommendation 对象中提取因果图
 */
function extractDecisionGraphFromRecommendation(rec: Record<string, unknown>): CausalGraph {
  const nodes: CausalGraphNode[] = []
  const edges: CausalGraphEdge[] = []

  const name = (rec.name ?? rec.recommendation ?? 'decision') as string
  const reason = (rec.reason ?? rec.rationale ?? '') as string
  const factors = (rec.factors ?? rec.keyFactors ?? []) as Array<Record<string, unknown>>

  // 添加决策节点
  nodes.push({ id: 'decision', label: 'decision_node', name: String(name) })

  if (factors.length > 0) {
    for (const f of factors) {
      const factorName = (f.name ?? f.factor ?? 'unknown') as string
      const importance = (f.importance ?? f.weight ?? 0.5) as number
      const id = `factor_${factorName}`

      let label: CausalGraphNode['label']
      if (importance >= 0.3) label = 'primary_factor'
      else if (importance >= 0.1) label = 'secondary_factor'
      else label = 'correction_factor'

      nodes.push({ id, label, name: String(factorName) })
      edges.push({ source: id, target: 'decision' })
    }
  }

  return {
    nodes,
    edges,
    primaryFactorId: nodes.find(n => n.label === 'primary_factor')?.id,
  }
}

/**
 * 从 recommendation_computed 事件中提取因果图
 */
function extractDecisionGraphFromRecommendationEvent(payload: Record<string, unknown>): CausalGraph {
  const nodes: CausalGraphNode[] = []
  const edges: CausalGraphEdge[] = []

  const ranking = (payload.ranking ?? []) as Array<Record<string, unknown>>
  const primaryFactor = (payload.primaryFactor ?? 'unknown') as string
  const factorWeights = (payload.factorWeights ?? {}) as Record<string, number>

  // 添加排序因子节点
  const factorNames = Object.keys(factorWeights)
  if (factorNames.length > 0) {
    for (const [name, weight] of Object.entries(factorWeights)) {
      let label: CausalGraphNode['label']
      if (weight >= 0.25) label = 'primary_factor'
      else if (weight >= 0.1) label = 'secondary_factor'
      else label = 'correction_factor'

      const id = `factor_${name}`
      nodes.push({ id, label, name })
    }
  } else {
    // 没有明确 factorWeights 时，用 primaryFactor 和排名推断
    nodes.push({ id: 'factor_main', label: 'primary_factor', name: primaryFactor })
  }

  // 添加排名候选节点
  let primaryFactorId: string | undefined
  for (const item of ranking) {
    const candidateId = (item.candidateId ?? 'unknown') as string
    const id = `cand_${candidateId}`
    nodes.push({ id, label: 'decision_node', name: candidateId })

    // 因子的因果边 → 决策节点
    for (const factor of nodes.filter(n => n.label !== 'decision_node')) {
      edges.push({ source: factor.id, target: id })
    }
  }

  // 主因子识别
  primaryFactorId = nodes.find(n => n.label === 'primary_factor')?.id

  return { nodes, edges, primaryFactorId }
}

/**
 * 标准化因果图
 *
 * 规范化处理：
 * - 去除 correction_factor 节点
 * - 节点按 label 排序
 * - 邻接表标准化
 */
export function normalizeDecisionGraph(graph: CausalGraph): CausalGraph {
  const labelOrder: Record<string, number> = {
    primary_factor: 0,
    secondary_factor: 1,
    anomaly_factor: 2,
    correction_factor: 3,
    decision_node: 4,
    intervention: 5,
  }

  // 排序节点
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    const la = labelOrder[a.label] ?? 99
    const lb = labelOrder[b.label] ?? 99
    return la - lb || a.id.localeCompare(b.id)
  })

  // 去重
  const seenIds = new Set<string>()
  const uniqueNodes = sortedNodes.filter(n => {
    if (seenIds.has(n.id)) return false
    seenIds.add(n.id)
    return true
  })

  return {
    nodes: uniqueNodes,
    edges: graph.edges.filter(e => seenIds.has(e.source) && seenIds.has(e.target)),
    primaryFactorId: graph.primaryFactorId,
  }
}

/**
 * 生成 Decision 等价类 ID
 *
 * 等价判定：标准化因果图同构（邻接表 + 节点标签 + 主因子标识）
 */
export function computeDecisionEquivalenceClass(trace: DecisionTrace): DecisionEquivalenceClassId | null {
  const graph = extractDecisionGraph(trace)
  if (!graph) return null

  const normalized = normalizeDecisionGraph(graph)

  const adjList = normalized.nodes.map(n => {
    const outEdges = normalized.edges
      .filter(e => e.source === n.id)
      .map(e => e.target)
      .sort()
    return `${n.id}:${n.label}:${outEdges.join(',')}`
  }).join('|')

  return simpleHash(`${adjList}|${normalized.primaryFactorId ?? ''}`)
}

// ============================================================
// 6. 三层等价类综合判定
// ============================================================

/**
 * 将单个 Trace 映射为语义等价类
 */
export function traceToEquivalenceClass(trace: DecisionTrace): SemanticEquivalenceClass | null {
  const frame = computeFrameEquivalenceClass(trace)
  const evaluation = computeEvaluationEquivalenceClass(trace)
  const decision = computeDecisionEquivalenceClass(trace)

  if (!frame && !evaluation && !decision) return null

  return {
    frame: frame ?? 'none',
    evaluation: evaluation ?? 'none',
    decision: decision ?? 'none',
  }
}

/**
 * 判定两个 Trace 是否属于同一语义等价类
 *
 * 注意：这不是"相似度"，而是离散等价关系判定。
 * 输出 true/false，不是连续值。
 */
export function isSemanticallyEquivalent(a: DecisionTrace, b: DecisionTrace): boolean {
  const classA = traceToEquivalenceClass(a)
  const classB = traceToEquivalenceClass(b)

  if (!classA || !classB) return false

  return (
    classA.frame === classB.frame &&
    classA.evaluation === classB.evaluation &&
    classA.decision === classB.decision
  )
}

/**
 * 字典序降级判定
 *
 * CTS → RSI → S_frame 依次判定
 * 返回最匹配的层级
 */
export function isFrameEquivalent(a: DecisionTrace, b: DecisionTrace): boolean {
  const fa = computeFrameEquivalenceClass(a)
  const fb = computeFrameEquivalenceClass(b)
  return fa !== null && fb !== null && fa === fb
}

export function isEvaluationEquivalent(a: DecisionTrace, b: DecisionTrace): boolean {
  const ea = computeEvaluationEquivalenceClass(a)
  const eb = computeEvaluationEquivalenceClass(b)
  return ea !== null && eb !== null && ea === eb
}

export function isDecisionEquivalent(a: DecisionTrace, b: DecisionTrace): boolean {
  const da = computeDecisionEquivalenceClass(a)
  const db = computeDecisionEquivalenceClass(b)
  return da !== null && db !== null && da === db
}

// ============================================================
// 7. 简单哈希工具
// ============================================================

function simpleHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}
