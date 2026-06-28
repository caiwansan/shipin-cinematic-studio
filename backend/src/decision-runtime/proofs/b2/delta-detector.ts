/**
 * delta-detector.ts — Phase B-2 Counterfactual Stability
 *
 * ============================================================
 * Delta Detector
 * ============================================================
 *
 * 职责：检测输入变化，定位变更节点及其因果影响范围。
 *
 * 宪法约束：
 *   1. 不重新执行证明
 *   2. 不调用任何 Agent
 *   3. 只做纯字符串差异分析
 *   4. 输出的是影响范围（impact scope），不是结果
 */

// ============================================================
// 1. Delta 类型
// ============================================================

export type DeltaNode = 'requirement' | 'world' | 'evidence' | 'scoring' | 'decision' | 'unknown'

export interface TextDiff {
  /** 发生变化的节点 */
  node: DeltaNode
  /** 旧值片段 */
  oldValue: string
  /** 新值片段 */
  newValue: string
  /** 变更幅度（0~1） */
  changeMagnitude: number
  /** 影响到的因果边（eventType 对） */
  impactedEdges: Array<{ from: string; to: string }>
}

export interface DeltaResult {
  /** 输入是否发生变化 */
  changed: boolean
  /** 所有变更节点 */
  nodes: TextDiff[]
  /** 影响范围——哪些 eventType 需要重新计算 */
  impactScope: Set<string>
  /** 总体变更幅度 */
  totalMagnitude: number
}

// ============================================================
// 2. 变更 → 影响范围映射
// ============================================================

/**
 * 每个变更节点对应的影响范围（因果链传播）
 *
 * 规则（按照 Pipeline 拓扑）：
 *   requirement 变 → 全链路受影响
 *   world 变 → frame + evidence + scoring + decision
 *   evidence 变 → scoring + decision（frame 不变，world 不变）
 *   scoring 变 → decision（frame + evidence + world 不变）
 *   decision 变 → 仅报告（不回溯）
 */
const IMPACT_MAP: Record<DeltaNode, string[]> = {
  requirement: ['requirement_analyzed', 'world_view_constructed', 'reasoning_frame_created', 'evidence_collected', 'scoring_completed', 'recommendation_computed', 'report_generated'],
  world: ['world_view_constructed', 'reasoning_frame_created', 'evidence_collected', 'scoring_completed', 'recommendation_computed', 'report_generated'],
  evidence: ['evidence_collected', 'scoring_completed', 'recommendation_computed', 'report_generated'],
  scoring: ['scoring_completed', 'recommendation_computed', 'report_generated'],
  decision: ['recommendation_computed', 'report_generated'],
  unknown: [],
}

/**
 * 每个变更节点影响的因果边
 */
const IMPACT_EDGES: Record<DeltaNode, Array<{ from: string; to: string }>> = {
  requirement: [
    { from: 'requirement_analyzed', to: 'world_view_constructed' },
    { from: 'world_view_constructed', to: 'reasoning_frame_created' },
    { from: 'reasoning_frame_created', to: 'evidence_collected' },
    { from: 'evidence_collected', to: 'scoring_completed' },
    { from: 'scoring_completed', to: 'recommendation_computed' },
    { from: 'recommendation_computed', to: 'report_generated' },
  ],
  world: [
    { from: 'world_view_constructed', to: 'reasoning_frame_created' },
    { from: 'reasoning_frame_created', to: 'evidence_collected' },
    { from: 'evidence_collected', to: 'scoring_completed' },
    { from: 'scoring_completed', to: 'recommendation_computed' },
    { from: 'recommendation_computed', to: 'report_generated' },
  ],
  evidence: [
    { from: 'evidence_collected', to: 'scoring_completed' },
    { from: 'scoring_completed', to: 'recommendation_computed' },
    { from: 'recommendation_computed', to: 'report_generated' },
  ],
  scoring: [
    { from: 'scoring_completed', to: 'recommendation_computed' },
    { from: 'recommendation_computed', to: 'report_generated' },
  ],
  decision: [
    { from: 'recommendation_computed', to: 'report_generated' },
  ],
  unknown: [],
}

// ============================================================
// 3. Delta 检测器
// ============================================================

export class DeltaDetector {
  /**
   * 检测两个输入之间的变化
   *
   * @param oldInput 参考输入
   * @param newInput 新输入
   * @returns DeltaResult
   */
  detect(oldInput: string, newInput: string): DeltaResult {
    if (oldInput === newInput) {
      return {
        changed: false,
        nodes: [],
        impactScope: new Set(),
        totalMagnitude: 0,
      }
    }

    const nodes: TextDiff[] = []
    const impactScope = new Set<string>()
    let totalMagnitude = 0

    // 提取旧输入的关键词
    const oldKeywords = this.extractKeywords(oldInput)
    const newKeywords = this.extractKeywords(newInput)

    // 检查每个关键词类型的变更
    const changedTypes = this.findChangedTypes(oldKeywords, newKeywords)

    for (const change of changedTypes) {
      const impactedEdges = IMPACT_EDGES[change.node] ?? []
      const nodeScope = IMPACT_MAP[change.node] ?? []

      nodes.push({
        node: change.node,
        oldValue: change.oldValue,
        newValue: change.newValue,
        changeMagnitude: change.magnitude,
        impactedEdges,
      })

      for (const scope of nodeScope) {
        impactScope.add(scope)
      }

      totalMagnitude += change.magnitude
    }

    return {
      changed: nodes.length > 0,
      nodes,
      impactScope,
      totalMagnitude: Math.min(totalMagnitude / Math.max(changedTypes.length, 1), 1),
    }
  }

  /**
   * 从输入字符串中提取关键词
   */
  private extractKeywords(input: string): Record<string, string> {
    const keywords: Record<string, string> = {}

    // 城市名
    const cityMatch = input.match(/[北京上海深圳广州杭州成都武汉南京]/)
    if (cityMatch) keywords.city = cityMatch[0]

    // 金额
    const priceMatch = input.match(/(\d+万|\d+\.?\d*[亿])/)
    if (priceMatch) keywords.price = priceMatch[1]

    // 意图
    const intentMatch = input.match(/(买|租|投资|推荐|找|看)/)
    if (intentMatch) keywords.intent = intentMatch[0]

    // 领域关键词
    const domainKeywords = ['买房', '租房', '学区', '投资', '商铺', '写字楼']
    for (const dk of domainKeywords) {
      if (input.includes(dk)) {
        keywords.domain = dk
        break
      }
    }

    return keywords
  }

  /**
   * 找出变化的关键词类型并映射到 DeltaNode
   */
  private findChangedTypes(
    oldKeywords: Record<string, string>,
    newKeywords: Record<string, string>,
  ): Array<{ node: DeltaNode; oldValue: string; newValue: string; magnitude: number }> {
    const changes: Array<{ node: DeltaNode; oldValue: string; newValue: string; magnitude: number }> = []

    // 城市变化 → requirement
    if (oldKeywords.city && newKeywords.city && oldKeywords.city !== newKeywords.city) {
      changes.push({
        node: 'requirement',
        oldValue: oldKeywords.city,
        newValue: newKeywords.city,
        magnitude: 0.8,
      })
    }

    // 金额变化 → evidence（评分会受影响）
    if (oldKeywords.price && newKeywords.price && oldKeywords.price !== newKeywords.price) {
      changes.push({
        node: 'evidence',
        oldValue: oldKeywords.price,
        newValue: newKeywords.price,
        magnitude: 0.5,
      })
    }

    // 意图变化 → requirement
    if (oldKeywords.intent && newKeywords.intent && oldKeywords.intent !== newKeywords.intent) {
      changes.push({
        node: 'requirement',
        oldValue: oldKeywords.intent,
        newValue: newKeywords.intent,
        magnitude: 0.7,
      })
    }

    // 没有特定关键词变化 → 标记为未知变更
    if (changes.length === 0) {
      changes.push({
        node: 'unknown',
        oldValue: oldInput.slice(0, 20),
        newValue: newInput.slice(0, 20),
        magnitude: 0.3,
      })
    }

    return changes
  }
}

/**
 * 单例检测器
 */
export const deltaDetector = new DeltaDetector()
