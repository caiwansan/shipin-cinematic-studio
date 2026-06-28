/**
 * Asset 类型定义
 *
 * P1.4 Capability Assets 统一类型。
 * 每个 Dataset 绑定的不仅仅是 metadata，还包含 failureModes、evaluationCriteria、Gold Reference。
 */

// ─── Asset Metadata ──────────────────────────────

export interface AssetMetadata {
  /** 唯一标识，如 L2-001 */
  id: string
  /** 唯一主能力 */
  primaryCapability: string
  /** 附带的次要能力 */
  secondaryCapabilities: string[]
  /** 难度级别 L0-L4 */
  difficulty: string
  /** 依赖的 Pipeline 阶段 */
  stage: string
  /** 人类可读名称 */
  name: string
  /** 简短描述 */
  description: string
  /** 场景说明（中文剧情描述） */
  scenario: string
  /** Wave 2+: 电影创作意图（emphasize_subject, create_tension, establish_mood 等） */
  cinematicIntent?: string
  /** Wave 2+: 灯光设计意图 */
  lightingIntent?: string
  /** Wave 2+: 视觉效果意图 */
  visualIntent?: string
}

// ─── Failure Mode ────────────────────────────────

export interface FailureMode {
  id: string
  description: string
  expectedBehavior: string
  severity: 'high' | 'medium' | 'low'
}

// ─── Evaluation Criteria ─────────────────────────

export interface EvaluationCriterion {
  id: string
  name: string
  description: string
  weight: number // 0-1, sum of weights should = 1
  passThreshold: number // 0-100
  /** Wave 2+: 该标准对应的创作意图标签 */
  intentType?: 'cinematic' | 'lighting' | 'visual' | 'technical'
}

// ─── Gold Reference ──────────────────────────────

export interface GoldReference {
  input: string
  expectedPlanning: Record<string, any>
  expectedNegotiation: Record<string, any>
  expectedRuntime: Record<string, any>
  expectedEvaluation: Record<string, any>
}

// ─── Full Asset ──────────────────────────────────

export interface CapabilityAsset {
  metadata: AssetMetadata
  failureModes: FailureMode[]
  evaluationCriteria: EvaluationCriterion[]
  goldReference?: GoldReference
}

// ─── Backlog Entry ───────────────────────────────

export interface BacklogEntry {
  capability: string
  priority: 'P0' | 'P1' | 'P2'
  group: string
  stage: string
  difficulty: string
  suggestedId: string
  reason: string
  status: 'todo' | 'in-progress' | 'done'
  createdAt: string
}
