/**
 * decision-ontology.ts — Decision Node Ontology
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-0: Decision Runtime Contract Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件定义 Decision Graph 中所有允许的节点类型。
 *
 * 宪法：
 *   1. 禁止自由扩张 — 第一版固定 7 种节点类型
 *   2. 新增节点类型必须经过 Contract Review（Phase A-0 完成后
 *      只能通过 Manifest version bump 添加）
 *   3. 每个节点类型对应一个 Agent 的输出产物
 *
 * 节点类型说明：
 *
 *   REQUIREMENT     — 用户需求的结构化表示
 *   SEARCH          — 搜索查询及原始结果
 *   EVIDENCE        — 从搜索结果中提取的证据/事实
 *   CANDIDATE       — 经过评估的候选对象（企业/产品/服务）
 *   SCORE           — 对 Candidate 的多维度评分
 *   RECOMMENDATION  — 排序后的推荐结果列表
 *   REPORT          — 最终决策报告（文本/结构化）
 *
 * @phase decision-runtime
 */

export enum DecisionNodeType {
  /** 用户需求结构化 */
  REQUIREMENT = 'REQUIREMENT',

  /** 搜索任务及原始结果 */
  SEARCH = 'SEARCH',

  /** 从搜索结果提取的证据/事实 */
  EVIDENCE = 'EVIDENCE',

  /** 经过评估的候选对象 */
  CANDIDATE = 'CANDIDATE',

  /** 多维度评分 */
  SCORE = 'SCORE',

  /** 排序推荐 */
  RECOMMENDATION = 'RECOMMENDATION',

  /** 最终报告 */
  REPORT = 'REPORT',

  /** 编译器验证（A-3.0.5 新增，非决策业务节点） */
  VALIDATION = 'VALIDATION',
}

// ============================================================
// Node Type Descriptors —— 供可观测性/UI 使用
// ============================================================

export interface NodeTypeDescriptor {
  type: DecisionNodeType
  label: string
  description: string
  color: string // hex color for graph visualization
  inputPorts: string[]
  outputPorts: string[]
}

export const NODE_TYPE_DESCRIPTORS: Record<DecisionNodeType, NodeTypeDescriptor> = {
  [DecisionNodeType.REQUIREMENT]: {
    type: DecisionNodeType.REQUIREMENT,
    label: '需求分析',
    description: '理解用户真实需求，提取关键条件',
    color: '#4F46E5',
    inputPorts: ['user-input'],
    outputPorts: ['requirement-json'],
  },
  [DecisionNodeType.SEARCH]: {
    type: DecisionNodeType.SEARCH,
    label: '信息搜索',
    description: '全网搜索相关信息',
    color: '#059669',
    inputPorts: ['requirement-json'],
    outputPorts: ['search-results'],
  },
  [DecisionNodeType.EVIDENCE]: {
    type: DecisionNodeType.EVIDENCE,
    label: '证据提取',
    description: '从搜索结果中提取可信证据',
    color: '#D97706',
    inputPorts: ['search-results'],
    outputPorts: ['evidences'],
  },
  [DecisionNodeType.CANDIDATE]: {
    type: DecisionNodeType.CANDIDATE,
    label: '候选评估',
    description: '将证据归集到候选对象并初步评估',
    color: '#DC2626',
    inputPorts: ['evidences'],
    outputPorts: ['candidates'],
  },
  [DecisionNodeType.SCORE]: {
    type: DecisionNodeType.SCORE,
    label: '多维评分',
    description: '对候选对象进行多维度评分',
    color: '#7C3AED',
    inputPorts: ['candidates'],
    outputPorts: ['score-cards'],
  },
  [DecisionNodeType.RECOMMENDATION]: {
    type: DecisionNodeType.RECOMMENDATION,
    label: '推荐排序',
    description: '综合评分与需求匹配度排序',
    color: '#0891B2',
    inputPorts: ['score-cards', 'requirement-json'],
    outputPorts: ['ranked-candidates'],
  },
  [DecisionNodeType.REPORT]: {
    type: DecisionNodeType.REPORT,
    label: '报告生成',
    description: '生成最终决策报告',
    color: '#1D4ED8',
    inputPorts: ['ranked-candidates', 'requirement-json'],
    outputPorts: ['report'],
  },
  [DecisionNodeType.VALIDATION]: {
    type: DecisionNodeType.VALIDATION,
    label: '编译器验证',
    description: '验证决策管道的语义正确性',
    color: '#78716C',
    inputPorts: ['trace'],
    outputPorts: ['validation-result'],
  },
}
