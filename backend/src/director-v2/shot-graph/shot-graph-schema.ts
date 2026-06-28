/**
 * shot-graph-schema.ts — Shot Graph 数据结构
 *
 * Shot Graph 是导演层的唯一输出结构。
 * 每个 ShotNode = 单一镜头语义单元。
 *
 * 核心原则：
 *   1. Shot Graph = 唯一导演输出
 *   2. Prompt Compiler = 只负责单镜头 → prompt 的翻译
 *   3. 绝对禁止时间轴拆分、多镜头混写
 */

// ============================================================
// Shot Node — 单镜头语义单元
// ============================================================

export interface ShotNode {
  /** 镜头 ID（如 "S01", "S02"） */
  id: string

  /** 镜头意图：导演选择的叙事功能 */
  intent: ShotIntent

  /** 空间定义 — 唯一场景，一个 shot 只能绑定一个空间 */
  spatialFrame: string

  /** 镜头参数 */
  camera: ShotCamera

  /** 主体 — 该镜头内可见的角色/物体，最少1个 */
  subject: string[]

  /** 单一连续动作（必须 atomic） */
  action: string

  /** 物理特效描述（非抽象，必须物理可视） */
  vfx: string[]

  /** 与前后 shot 的连续性关系（可选） */
  continuity?: ShotContinuity
}

// ============================================================
// Shot Intent — 镜头叙事意图
// ============================================================

export type ShotIntent =
  | 'establishing'   // 环境定场
  | 'reveal'         // 揭示/展露
  | 'confrontation'  // 对峙/待发
  | 'action'         // 动作爆发
  | 'impact'         // 撞击/碰撞瞬间
  | 'climax'         // 高潮/转折
  | 'ending'         // 收尾/余韵

// ============================================================
// Camera
// ============================================================

export interface ShotCamera {
  /** 景别：aerial / low-angle / close-up / wide / over-shoulder / medium / establishing */
  type: string
  /** 镜头运动（可选）：push-in / shake / orbit / static / tracking / crane */
  movement?: string
}

// ============================================================
// Continuity
// ============================================================

export interface ShotContinuity {
  /** 与前一 shot 的关系 */
  previousRelation: 'cut' | 'match-cut' | 'same-scene' | 'jump-cut'
  /** 连续性描述 */
  description: string
}

// ============================================================
// Shot Graph — 完整导演输出
// ============================================================

export interface ShotGraph {
  shots: ShotNode[]
  /** 元信息 */
  meta: {
    totalShots: number
    narrativeSummary: string
  }
}

// ============================================================
// Validation
// ============================================================

export type ValidationIssue = {
  shotId: string
  severity: 'error' | 'warning'
  rule: string
  message: string
}

export function validateShotNode(shot: ShotNode): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // 1. 禁止多动作
  const actionConnectors = /然后|接着|随后|之后|同时|并 |且 /g
  if ((shot.action.match(actionConnectors) || []).length > 0) {
    issues.push({
      shotId: shot.id,
      severity: 'error',
      rule: 'Action Atomicity',
      message: `shot 包含多个动作用连接词连接: "${shot.action}"`,
    })
  }

  // 2. 必须有空间定义
  if (!shot.spatialFrame || shot.spatialFrame.length < 3) {
    issues.push({
      shotId: shot.id,
      severity: 'error',
      rule: 'Spatial Lock',
      message: 'shot 缺少 spatialFrame（空间定义）',
    })
  }

  // 3. 摄影机必须单一类型
  if (!shot.camera.type || shot.camera.type.length < 2) {
    issues.push({
      shotId: shot.id,
      severity: 'error',
      rule: 'Camera Stability',
      message: 'shot 缺少 camera.type',
    })
  }
  if ((shot.camera.type.match(/\//g) || []).length > 0) {
    issues.push({
      shotId: shot.id,
      severity: 'warning',
      rule: 'Camera Stability',
      message: `camera.type 包含混合镜头描述（"/"）: "${shot.camera.type}"`,
    })
  }

  // 4. 至少一个主体
  if (!shot.subject || shot.subject.length === 0) {
    issues.push({
      shotId: shot.id,
      severity: 'error',
      rule: 'Subject Required',
      message: 'shot 缺少 subject（主体）',
    })
  }

  return issues
}

export function validateShotGraph(graph: ShotGraph): ValidationIssue[] {
  return graph.shots.flatMap(validateShotNode)
}
