/**
 * shot-graph-schema.ts — Sprint 1 纯导演语义 Shot Graph
 *
 * 只包括导演决策：故事 → 镜头规划。
 * 严禁包含 Camera / VFX / Motion / Particle 等非导演层信息。
 */

// ============================================================
// ShotNode — 单镜头语义单元（纯导演）
// ============================================================

export type ShotType =
  | 'establishing'     // 环境定场
  | 'reveal'           // 角色揭示
  | 'dialogue'         // 对话交流
  | 'confrontation'    // 对峙/待发
  | 'action'           // 动作爆发
  | 'impact'           // 撞击/碰撞瞬间
  | 'climax'           // 高潮/转折
  | 'ending'           // 收尾/余韵

export interface ShotNode {
  id: string
  shotType: ShotType
  subject: string[]
  environment: string
  action: string
  duration: number
}

// ============================================================
// ShotGraph — 完整导演输出
// ============================================================

export interface ShotGraph {
  shots: ShotNode[]
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

  if (!shot.shotType) {
    issues.push({
      shotId: shot.id,
      severity: 'error',
      rule: 'ShotType Required',
      message: 'shot 缺少 shotType',
    })
  }

  if (!shot.subject || shot.subject.length === 0) {
    issues.push({
      shotId: shot.id,
      severity: 'error',
      rule: 'Subject Required',
      message: 'shot 缺少 subject（主体）',
    })
  }

  if (!shot.environment || shot.environment.length < 3) {
    issues.push({
      shotId: shot.id,
      severity: 'error',
      rule: 'Environment Required',
      message: 'shot 缺少 environment（环境）',
    })
  }

  if (!shot.action || shot.action.length < 5) {
    issues.push({
      shotId: shot.id,
      severity: 'error',
      rule: 'Action Required',
      message: 'shot 缺少 action（动作）',
    })
  }

  if (shot.duration <= 0) {
    issues.push({
      shotId: shot.id,
      severity: 'error',
      rule: 'Duration Required',
      message: 'shot 缺少有效的 duration（时长）',
    })
  }

  // 禁止连接词
  const connectors = /然后|接着|随后|之后|同时|并 |且 /g
  if ((shot.action.match(connectors) || []).length > 0) {
    issues.push({
      shotId: shot.id,
      severity: 'warning',
      rule: 'Action Atomicity',
      message: `action 包含连接词，可能存在多动作: "${shot.action.slice(0, 40)}..."`,
    })
  }

  return issues
}

export function validateShotGraph(graph: ShotGraph): ValidationIssue[] {
  return graph.shots.flatMap(validateShotNode)
}
