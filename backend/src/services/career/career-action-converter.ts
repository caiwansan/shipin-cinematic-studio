// ─── Sprint-09E-04 Task 01: Planning → Action Converter ─────
//
// 继承原则（来自 09E-02.5 / 09E-03）：
//   AI 可以解释，AI 不拥有职业事实
//   每个行动必须可追溯：Action → Planning Reason → Confirmed Fact
//   禁止生成与 Confirmed Facts 无关的行动
//
// 核心假设：
//   用户得到职业路线之后，AI 能否帮助用户迈出下一步

import type {
  CareerIntelligenceOutput,
  CareerActionPlan,
  CareerAction,
  RecommendedPath,
  SkillGap,
} from './career-planning-types.js'

let actionCounter = 0

function generateActionId(): string {
  actionCounter++
  const ts = Date.now().toString(36)
  return `act_${ts}_${actionCounter}`
}

/**
 * 根据方向生成 30 天行动
 *
 * 规则：
 * - 每个行动必须基于推荐路径或技能缺口
 * - evidence 必须引用 Confirmed Facts 或规划输出
 * - 禁止生成用户数据范围外的行动（如用户无编程背景时推荐算法实现）
 */
function generate30DayActions(
  paths: RecommendedPath[],
  gaps: SkillGap[],
): CareerAction[] {
  const actions: CareerAction[] = []

  // ── 基于技能缺口生成学习行动（优先最高优先级） ──
  const criticalGaps = gaps.filter((g) => g.importance === 'critical')
  const missingGaps = criticalGaps.filter((g) => g.currentStatus === 'missing')
  for (const gap of missingGaps.slice(0, 2)) {
    actions.push({
      id: generateActionId(),
      title: `掌握 ${gap.skill} 基础 — ${gap.suggestion.slice(0, 30)}`,
      reason: gap.suggestion,
      relatedEvidence: [`SkillGap: ${gap.skill} (${gap.importance})`, ...(paths.length > 0 ? [`Direction: ${paths[0].direction}`] : [])],
      targetSkill: gap.skill,
      priority: 'high',
      phase: '30days',
    })
  }

  // ── 基于推荐路径生成调研/学习行动 ──
  for (const path of paths.slice(0, 2)) {
    const dir = path.direction.toLowerCase()

    // AI 方向：案例分析
    if (dir.includes('ai') || dir.includes('人工智能') || dir.includes('算法')) {
      actions.push({
        id: generateActionId(),
        title: `完成 3 个 AI/${dir} 领域案例分析`,
        reason: `深入理解 AI 方向的实际应用场景和市场趋势，为 ${path.direction} 积累认知基础`,
        relatedEvidence: [path.evidence[0] || `Direction: ${path.direction}`],
        priority: 'high',
        phase: '30days',
      })
    }

    // 设计/产品方向：作品集或文档
    if (dir.includes('设计') || dir.includes('产品') || dir.includes('视觉')) {
      actions.push({
        id: generateActionId(),
        title: '梳理现有作品/项目，制作方向匹配的作品集框架',
        reason: `向 ${path.direction} 方向发展，需要展示相关能力的作品集`,
        relatedEvidence: [...path.evidence],
        priority: 'high',
        phase: '30days',
      })
    }

    // 管理/专家方向：定位分析
    if (dir.includes('管理') || dir.includes('总监') || dir.includes('架构') || dir.includes('lead')) {
      actions.push({
        id: generateActionId(),
        title: '完成一次方向匹配度自我评估，明确能力差距',
        reason: `识别当前能力与 ${path.direction} 目标的差距，制定精准提升计划`,
        relatedEvidence: [...path.evidence],
        priority: 'medium',
        phase: '30days',
      })
    }

    // 通用兜底：方向调研
    if (actions.length < 2) {
      actions.push({
        id: generateActionId(),
        title: `研究 ${path.direction} 方向的岗位要求和典型发展路径`,
        reason: `了解实际市场对 ${path.direction} 能力的要求，对齐后续学习计划`,
        relatedEvidence: [...path.evidence],
        priority: 'medium',
        phase: '30days',
      })
    }
  }

  // ── 如果有重要但非关键缺口 ──
  const importantMissing = gaps.filter((g) => g.importance === 'important' && g.currentStatus === 'missing')
  if (importantMissing.length > 0) {
    actions.push({
      id: generateActionId(),
      title: `提升 ${importantMissing[0].skill} — ${importantMissing[0].suggestion.slice(0, 30)}`,
      reason: importantMissing[0].suggestion,
      relatedEvidence: [`SkillGap: ${importantMissing[0].skill} (${importantMissing[0].importance})`],
      targetSkill: importantMissing[0].skill,
      priority: 'medium',
      phase: '30days',
    })
  }

  return actions.slice(0, 4) // 最多 4 个 30 天行动
}

/**
 * 根据方向和 30 天行动，生成 90 天行动
 */
function generate90DayActions(
  paths: RecommendedPath[],
  gaps: SkillGap[],
): CareerAction[] {
  const actions: CareerAction[] = []

  // ── 项目实践 ──
  for (const path of paths.slice(0, 1)) {
    const dir = path.direction.toLowerCase()

    if (dir.includes('ai') || dir.includes('算法')) {
      actions.push({
        id: generateActionId(),
        title: '完成一个 AI 领域的实战项目（个人/开源/工作）',
        reason: `实战项目是 ${path.direction} 方向最有说服力的能力证明`,
        relatedEvidence: [...path.evidence],
        priority: 'high',
        phase: '90days',
      })
    } else if (dir.includes('设计') || dir.includes('产品')) {
      actions.push({
        id: generateActionId(),
        title: '制作一个完整的方向匹配 Demo/作品集',
        reason: `通过完整的作品展示 ${path.direction} 的综合能力`,
        relatedEvidence: [...path.evidence],
        priority: 'high',
        phase: '90days',
      })
    } else {
      actions.push({
        id: generateActionId(),
        title: '完成一个与方向匹配的实践项目',
        reason: `通过实践积累 ${path.direction} 方向的项目经验`,
        relatedEvidence: [...path.evidence],
        priority: 'high',
        phase: '90days',
      })
    }
  }

  // ── 技能深化 ──
  const anyGaps = gaps.filter((g) => g.currentStatus === 'missing')
  const secondSkill = anyGaps.length > 1 ? anyGaps[1] : anyGaps[0]
  if (secondSkill) {
    actions.push({
      id: generateActionId(),
      title: `系统学习并实践 ${secondSkill.skill} — 完成至少 1 个练习项目`,
      reason: secondSkill.suggestion,
      relatedEvidence: [`SkillGap: ${secondSkill.skill} (${secondSkill.importance})`],
      targetSkill: secondSkill.skill,
      priority: 'medium',
      phase: '90days',
    })
  }

  // ── 影响力建设 ──
  if (paths.length > 0) {
    actions.push({
      id: generateActionId(),
      title: `开始建立 ${paths[0].direction} 方向的个人影响力（技术博客/开源贡献/行业分享）`,
      reason: `专业影响力是职业突破的关键加速器`,
      relatedEvidence: [...paths[0].evidence],
      priority: 'low',
      phase: '90days',
    })
  }

  return actions.slice(0, 4)
}

/**
 * 根据方向生成 12 个月行动
 */
function generate12MonthActions(paths: RecommendedPath[]): CareerAction[] {
  const actions: CareerAction[] = []

  for (const path of paths.slice(0, 1)) {
    actions.push({
      id: generateActionId(),
      title: `进入 ${path.direction} 相关岗位`,
      reason: `在 30 天调研 + 90 天实践的基础上，争取目标方向的正式岗位机会`,
      relatedEvidence: [...path.evidence],
      priority: 'high',
      phase: '12months',
    })
  }

  if (paths.length > 1) {
    actions.push({
      id: generateActionId(),
      title: `探索 ${paths[1].direction} 方向，准备备选方案`,
      reason: `多条路线并行准备，降低职业转型风险`,
      relatedEvidence: [...paths[1].evidence],
      priority: 'medium',
      phase: '12months',
    })
  }

  return actions.slice(0, 3)
}

/**
 * Planning → Action Converter
 *
 * 将 CareerIntelligenceOutput 转换为可执行的行动计划
 *
 * ⚠️ 原则：
 * 1. 每个 action 必须可追溯回规划依据和 Confirmed Facts
 * 2. 不生成超出用户当前能力分布的行动
 * 3. 如果无路径可推荐，返回空计划
 */
export function generateCareerActions(
  planningOutput: CareerIntelligenceOutput,
): CareerActionPlan {
  const { recommendedPaths, skillGapAnalysis } = planningOutput

  // 无推荐路径时返回空计划
  if (recommendedPaths.length === 0) {
    return {
      actions30Days: [],
      actions90Days: [],
      actions12Months: [],
      planningId: '',
      generatedAt: new Date().toISOString(),
    }
  }

  const actions30Days = generate30DayActions(recommendedPaths, skillGapAnalysis)
  const actions90Days = generate90DayActions(recommendedPaths, skillGapAnalysis)
  const actions12Months = generate12MonthActions(recommendedPaths)

  return {
    actions30Days,
    actions90Days,
    actions12Months,
    planningId: `plan_${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * 验证行动计划的数据一致性
 *
 * 检查：每个 action 的 relatedEvidence 是否可追溯
 */
export function validateActionPlan(plan: CareerActionPlan): boolean {
  const allActions = [
    ...plan.actions30Days,
    ...plan.actions90Days,
    ...plan.actions12Months,
  ]

  if (allActions.length === 0 && plan.planningId) {
    return false
  }

  // 每个 action 必须有 evidence
  for (const action of allActions) {
    if (!action.relatedEvidence || action.relatedEvidence.length === 0) {
      return false
    }
    if (!action.reason) {
      return false
    }
    if (!action.title) {
      return false
    }
  }

  return true
}
