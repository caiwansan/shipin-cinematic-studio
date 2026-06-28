/**
 * COE — Cinematic Optimization Engine v1.0
 *
 * PQL 闭环的修正内核。
 * 永远不修改 Prompt，只输出 CIR Patch。
 *
 * 四层架构：
 *   Layer 1: Recommendation Resolver — 统一 CEE 的 Recommendation 格式
 *   Layer 2: Patch Planner — 冲突检测 + 优先级排序 + 生成 Patch Plan
 *   Layer 3: Patch Generator — Patch Plan → 结构化 CIR Patch
 *   Layer 4: Patch Validator — Patch 合法性/冲突/副作用检查
 *
 * 后续优化：COE 永远不直接修改 CIR，而是输出 CIR Patch 合集，
 * 由上层决定是否、何时、哪些 Patch 被应用。
 */

// ─── CIR Patch（结构化修改）───────────────

export interface FieldPatch {
  /** CIR 字段路径（如 "shots[0].camera.scale"） */
  path: string
  /** 原值 */
  from?: string | number | boolean
  /** 新值 */
  to: string | number | boolean
}

export interface PatchSection {
  /** Patch 类型 */
  type: PatchType
  /** 置信度 (0-1) */
  confidence: number
  /** 目标 Capability */
  targetCapability: string
  /** 修改的字段 */
  fields: FieldPatch[]
  /** Patch 理由 */
  reason: string
  /** 预期收益描述 */
  expectedGain?: string
  /** 风险描述 */
  risk?: string
}

export type PatchType = 'safe' | 'recommended' | 'experimental'

// ─── Patch Plan（Layer 2 产物）────────────

export interface PatchPlan {
  /** 计划 ID */
  id: string
  /** 各分段的 Patch */
  patches: PatchSection[]
  /** 已检测到的冲突 */
  conflicts: PatchConflict[]
  /** 排重后的推荐应用顺序 */
  applyOrder: string[]
  /** 生成时间 */
  generatedAt: string
}

export interface PatchConflict {
  /** 冲突的路径 */
  path: string
  /** 冲突的 Capabilities */
  betweenCapabilities: string[]
  /** 冲突描述 */
  description: string
}

// ─── 验证结果（Layer 4 产物）──────────────

export interface PatchValidation {
  /** Patch 是否合法 */
  valid: boolean
  /** 验证错误 */
  errors: string[]
  /** 警告 */
  warnings: string[]
  /** 受影响的 Capabilities */
  affectedCapabilities: Array<{ capability: string; expectedChange: number; direction: 'up' | 'down' }>
}

// ─── COE 完整输出 ─────────────────────────

export interface OptimizationResult {
  /** 相关视频 ID */
  videoId: string
  /** 评估对应的证据 ID */
  evidenceId: string
  /** 生成时间 */
  generatedAt: string
  /** Patch Plan */
  plan: PatchPlan
  /** 生成的 CIR Patch 列表 */
  patches: PatchSection[]
  /** 验证结果 */
  validation: PatchValidation
  /** 汇总 */
  summary: {
    totalPatches: number
    safePatches: number
    recommendedPatches: number
    experimentalPatches: number
    overallConfidence: number
    autoApplicable: boolean
  }
}

// ─── COE Engine 接口 ──────────────────────

export interface CoeEngine {
  /**
   * 输入 CEE 的 CapabilityReport，输出 OptimizationResult
   */
  optimize(reports: import('../cee-types.js').CapabilityReport[], options?: CoeOptions): OptimizationResult | Promise<OptimizationResult>
}

export interface CoeOptions {
  /** 最大建议 patch 数 */
  maxPatches?: number
  /** 最低置信度阈值 */
  minConfidence?: number
  /** 仅自动应用 safe 类型 */
  autoApplySafe?: boolean
}

// ─── COE 策略接口 ─────────────────────────

/**
 * PatchStrategy 定义了 COE 如何根据 Recommendation 生成 Patch。
 * 后续可扩展为 Learning Memory 驱动的策略。
 */
export interface PatchStrategy {
  name: string
  description: string
  /** 该策略可处理的 Recommendation type */
  handlesTypes: string[]
  /** 生成 Patch */
  generate(recommendation: import('../cee-types.js').Recommendation): PatchSection[]
}
