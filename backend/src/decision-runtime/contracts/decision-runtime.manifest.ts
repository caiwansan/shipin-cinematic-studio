/**
 * decision-runtime.manifest.ts — Decision Runtime 注册清单
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A-0: Decision Runtime Contract Layer
 * ═══════════════════════════════════════════════════════════════
 *
 * 此文件是 Decision Runtime 在昆仑镜 Capability Runtime 体系中的
 * 唯一身份声明。任何集成点（Gateway / Snapshot / Event Log / 可观测性）
 * 都通过此 Manifest 发现 Runtime 的结构和能力。
 *
 * 宪法：
 *   1. RuntimeType 必须全局唯一
 *   2. version 升级必须向后兼容（major bump 需创建 Migration）
 *   3. inputSchema / outputSchema 是契约根，禁止运行时静默扩展
 *   4. nodeTypes 和 eventTypes 必须与 ontology / event 枚举严格一致
 *
 * @phase decision-runtime
 */

import { DecisionNodeType } from './decision-ontology.js'
import { DecisionEventType } from './decision-event.js'

// ============================================================
// 1. Manifest 结构
// ============================================================

export interface DecisionRuntimeManifest {
  /** Runtime 类型标识（昆仑镜全局唯一） */
  runtimeType: 'decision-runtime'

  /** 语义版本号 — 遵循 semver */
  version: 'v1'

  /** 输入 Schema 引用（JSON Schema 文件路径或内联定义名） */
  inputSchema: 'Requirement'

  /** 输出 Schema 引用 */
  outputSchema: 'DecisionReport'

  /** 允许的节点类型（Graph 中的节点种类） */
  nodeTypes: DecisionNodeType[]

  /** 允许的事件类型（Event Log 中的事件种类） */
  eventTypes: DecisionEventType[]

  /** Snapshot 版本标识 — 变更需对应 Migration */
  snapshotVersion: 'v1'

  /** 支持的 Agent 能力列表 */
  capabilities: string[]

  /** 元信息 */
  meta: {
    name: '昆仑镜 AI 决策智能运行时'
    description: '需求理解 → 事实搜集 → 证据整理 → 多维评估 → 决策建议'
    created: '2026-06-22'
    phase: 'A-0'
  }
}

// ============================================================
// 2. 实例化 Manifest（单例）
// ============================================================

export const DECISION_RUNTIME_MANIFEST: DecisionRuntimeManifest = {
  runtimeType: 'decision-runtime',
  version: 'v1',
  inputSchema: 'Requirement',
  outputSchema: 'DecisionReport',
  nodeTypes: [
    DecisionNodeType.REQUIREMENT,
    DecisionNodeType.SEARCH,
    DecisionNodeType.EVIDENCE,
    DecisionNodeType.CANDIDATE,
    DecisionNodeType.SCORE,
    DecisionNodeType.RECOMMENDATION,
    DecisionNodeType.REPORT,
  ],
  eventTypes: [
    DecisionEventType.REQUIREMENT_PARSED,
    DecisionEventType.SEARCH_COMPLETED,
    DecisionEventType.EVIDENCE_EXTRACTED,
    DecisionEventType.CANDIDATE_CREATED,
    DecisionEventType.SCORE_CALCULATED,
    DecisionEventType.RECOMMENDATION_GENERATED,
    DecisionEventType.REPORT_GENERATED,
  ],
  snapshotVersion: 'v1',
  capabilities: [
    'requirement-analysis',
    'information-search',
    'evidence-extraction',
    'multi-dimension-scoring',
    'candidate-ranking',
    'report-generation',
  ],
  meta: {
    name: '昆仑镜 AI 决策智能运行时',
    description: '需求理解 → 事实搜集 → 证据整理 → 多维评估 → 决策建议',
    created: '2026-06-22',
    phase: 'A-0',
  },
}

// ============================================================
// 3. Manifest 校验器（自检用）
// ============================================================

export function validateManifest(m: DecisionRuntimeManifest): string[] {
  const errors: string[] = []

  if (m.runtimeType !== 'decision-runtime') {
    errors.push(`runtimeType 必须为 "decision-runtime"，收到 "${m.runtimeType}"`)
  }

  if (m.version !== 'v1') {
    errors.push(`version 为 "${m.version}"，首次发布应为 "v1"`)
  }

  // nodeTypes 与枚举一致
  const allNodeTypes = Object.values(DecisionNodeType)
  for (const nt of m.nodeTypes) {
    if (!allNodeTypes.includes(nt)) {
      errors.push(`nodeType "${nt}" 不在 DecisionNodeType 枚举中`)
    }
  }
  if (m.nodeTypes.length !== allNodeTypes.length) {
    errors.push(`nodeTypes 数量 (${m.nodeTypes.length}) 与枚举 (${allNodeTypes.length}) 不一致`)
  }

  // eventTypes 与枚举一致
  const allEventTypes = Object.values(DecisionEventType)
  for (const et of m.eventTypes) {
    if (!allEventTypes.includes(et)) {
      errors.push(`eventType "${et}" 不在 DecisionEventType 枚举中`)
    }
  }
  if (m.eventTypes.length !== allEventTypes.length) {
    errors.push(`eventTypes 数量 (${m.eventTypes.length}) 与枚举 (${allEventTypes.length}) 不一致`)
  }

  return errors
}
