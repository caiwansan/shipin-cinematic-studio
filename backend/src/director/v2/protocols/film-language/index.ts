// ═══════════════════════════════════════════════════════════════════
// Film Language Protocol (A6.5) — 第七个核心协议
// ═══════════════════════════════════════════════════════════════════
//
// Film Language IR 不是"结构化 Prompt"，而是强类型的领域模型中间表示。
// 每一层都有自己的类型、校验规则和生命周期：
//   - 可验证（Validation）
//   - 可评分（Evaluation）
//   - 可恢复（Recovery）
//   - 可编译（Provider Compiler）
//
// 合法路径（架构强制）：
//   DirectorDecision → ExecutionPlan → Constraint → Reference → FilmLanguageIR → ProviderCompiler
//
// 禁止路径（架构违规）：
//   ProviderCompiler → ExecutionPlan（直接读取 ExecutionPlan 字段）
//
// ═══════════════════════════════════════════════════════════════════

// ─── 主体层 ───────────────────────────────────────────────────────

export interface SubjectInfo {
  /** 主体名称（如 "沈三笑"） */
  name: string
  /** 对应的视觉资产 ID */
  assetNodeId: string
  /** 视觉权重 0.0~1.0，同帧内总和 1.0 */
  visualWeight: number
  /** 角色描述（简洁，描述视觉特征即可） */
  appearance: string
  /** 当前帧中的服装/状态 */
  attire?: string
}

export interface SubjectLayer {
  primary: SubjectInfo
  secondary: SubjectInfo[]
}

// ─── 镜头层 ───────────────────────────────────────────────────────

export interface CameraLayer {
  /** 叙事型构图描述，非工程型："古槐占据画面左2/3" */
  composition: string
  /** 景别：特写/近景/中景/全景/远景 */
  shotType: string
  /** 叙事动机："以老槐树的永恒衬托人物的短暂" */
  narrativeIntention: string
  /** 主体对齐方向 */
  subjectAlignment?: string
  /** 焦距感 */
  focalFeeling?: 'intimate' | 'distant' | 'neutral'
}

// ─── 运动层 ───────────────────────────────────────────────────────

export interface MotionLayer {
  /** 相机运动（"极慢匀速上升，带呼吸感"） */
  camera: string
  /** 角色运动（"微风吹衣角，目光缓缓移动"） */
  character: string
  /** 环境运动（"嫩芽轻摇，树梢微颤"） */
  environment: string
  /** 粒子运动（"晨光中细微灰尘漂浮"） */
  particles?: string
}

// ─── 环境层 ───────────────────────────────────────────────────────

export interface EnvironmentLayer {
  /** 场景描述 */
  scene: string
  /** 时间 */
  timeOfDay: string
  /** 天气 */
  weather: string
}

// ─── 光照层 ───────────────────────────────────────────────────────

export interface LightingLayer {
  /** 光源描述（"春日清晨的漫射天光"） */
  source: string
  /** 光线品质（"柔光，略带散射"） */
  quality: string
  /** 方向（"顶光偏侧，柔和均匀"） */
  direction: string
}

// ─── 情绪层 ───────────────────────────────────────────────────────

export interface EmotionLayer {
  /** 氛围描述（"宁静春日，生机与深邃"） */
  mood: string
}

// ─── 视觉锚点层 ────────────────────────────────────────────────────

export interface VisualAnchor {
  /** 元素名称 */
  name: string
  /** 类型 */
  type: 'character' | 'scene' | 'prop'
  /** Asset Graph 中的节点 ID */
  assetNodeId: string
  /** 角色（primary/secondary/background） */
  role: 'primary' | 'secondary' | 'background'
  /** 跨镜头一致性标识 */
  continuityKey: string
}

export interface VisualAnchorLayer {
  anchors: VisualAnchor[]
}

// ─── 连续性层 ──────────────────────────────────────────────────────

export type ContinuityPriority = 'must' | 'should' | 'nice'

export interface ContinuityConstraint {
  /** 需保持一致的要素 */
  element: string
  /** 约束描述 */
  description: string
  priority: ContinuityPriority
}

export interface ContinuityLayer {
  constraints: ContinuityConstraint[]
}

// ─── 叙事层 ────────────────────────────────────────────────────────

export interface NarrativeLayer {
  /** 简洁叙事，严格控制在 100 token 以内 */
  short: string
  /** 对话文本（如有） */
  dialogue?: string
}

// ─── FilmLanguageFrame ─────────────────────────────────────────────

export interface FilmLanguageFrame {
  frameIndex: number
  subject: SubjectLayer
  camera: CameraLayer
  motion: MotionLayer
  environment: EnvironmentLayer
  lighting: LightingLayer
  emotion: EmotionLayer
  visualAnchors: VisualAnchorLayer
  continuity: ContinuityLayer
  narrative: NarrativeLayer
  /** 用于校验的元信息 */
  meta: {
    /** 来源 DirectorDecision ID */
    decisionId?: string
    /** 来源 ExecutionPlan ID */
    planId?: string
    /** 生产者 */
    producer: string
    /** 版本号 */
    version: string
  }
}

// ─── 整体 IR ──────────────────────────────────────────────────────

export interface FilmLanguageIR {
  frames: FilmLanguageFrame[]
  /** IR 级元信息 */
  meta: {
    decisionId: string
    planId: string
    producer: string
    version: string
    createdAt: string
  }
}

// ─── 不变量检查 ─────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════
// 三条冻结原则（2026-06-29 熊大确立）
// ═══════════════════════════════════════════════════════════════════
//
// ① Information Preservation Principle（信息无损）
//    任何进入 FilmLanguageIR 的信息不能丢失。
//    如果 Provider 发现缺少信息，是 IR 的缺陷，不是 Provider 的职责。
//
// ② Provider Compiler 必须是纯函数
//    compile(FilmLanguageIR, ProviderCapability) → ProviderOutput
//    同输入 → 同输出。不能访问数据库、不能查资产、不能修改 IR。
//
// ③ FilmLanguageFingerprint
//    用于 Evaluation 比较不同 Provider 是否保持同一导演意图。
// ═══════════════════════════════════════════════════════════════════

export function validateFilmLanguageIR(ir: FilmLanguageIR): string[] {
  const errors: string[] = []
  for (const frame of ir.frames) {
    // 权重总和校验
    const totalWeight =
      frame.subject.primary.visualWeight +
      frame.subject.secondary.reduce((s, si) => s + si.visualWeight, 0)
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      errors.push(
        `frame[${frame.frameIndex}] SubjectLayer 视觉权重总和 ${totalWeight}，应为 1.0`
      )
    }
    // 必须有 primary
    if (!frame.subject.primary.name) {
      errors.push(`frame[${frame.frameIndex}] SubjectLayer 缺少 primary`)
    }
    // motion 不能全为空
    if (!frame.motion.camera && !frame.motion.character && !frame.motion.environment) {
      errors.push(`frame[${frame.frameIndex}] MotionLayer 全为空`)
    }
    // 必须有 visualAnchors
    if (!frame.visualAnchors.anchors.length) {
      errors.push(`frame[${frame.frameIndex}] VisualAnchorLayer 为空`)
    }
  }
  return errors
}

// ─── 协议正式定义 ──────────────────────────────────────────────────

export const FilmLanguageProtocol = {
  protocolName: 'film-language' as const,
  version: '1.0.0',
  owner: 'FilmLanguageCompiler' as const,
  invariants: {
    deterministic: true,      // 同样输入 → 同样输出
    weightSumToOne: true,     // 权重总和 = 1.0
    visualAnchorsRequired: true, // 必须有视觉锚点
    informationPreserved: true,  // 信息无损：所有输入信息必须保留在 IR 中
  },
  /**
   * FilmLanguageFingerprint — 用于 Evaluation 比较不同 Provider 的输出
   * IR A → Provider A → Video  vs  IR A → Provider B → Video
   * 是不是同一个导演意图？
   */
  fingerprintVersion: '1.0.0',
} as const

// 计算 FilmLanguageFingerprint（不包含 meta 中可变的字段）
export function computeFilmLanguageFingerprint(ir: FilmLanguageIR): string {
  // 深拷贝副本，移除可变字段（createdAt, decisionId, planId 等）
  const stripped = JSON.parse(JSON.stringify(ir))
  if (stripped.meta) {
    delete stripped.meta.createdAt
    delete stripped.meta.decisionId
    delete stripped.meta.planId
  }
  // 每帧也移除可变 meta
  for (const frame of stripped.frames) {
    if (frame.meta) {
      delete frame.meta.decisionId
      delete frame.meta.planId
    }
  }
  // 使用 JSON.stringify 的 replacer + 排序 key 获得确定性 hash
  return JSON.stringify(stripped, (key, value) => {
    // 保留所有内容，只重新排序
    return value
  }, 0)
}

// ─── 确定性校验 ─────────────────────────────────────────────────────

/**
 * 相同输入 → 相同 FilmLanguageIR（确定性保证）
 * 由 A5 Evaluation Framework 在 Runtime Gate 调用
 */
export function deterministicFingerprint(ir: FilmLanguageIR): string {
  return JSON.stringify(ir, Object.keys(ir).sort())
}
