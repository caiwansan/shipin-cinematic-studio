// ─── Sprint-09E-03 Task 02: Career Intelligence Decision Engine ─────
//
// 核心原则（来自 09E-03 设计）：
//   AI 可以解释，AI 不拥有职业事实
//   每个建议必须引用 evidence（Confirmed Facts 中的一个或多个条目）
//   禁止生成用户未提供的经历/技能
//
// 回答的问题：
//   "根据我的真实经历，未来 3 年最值得走哪条路线？"

import type {
  CareerPlanningContext,
  CareerIntelligenceOutput,
  RecommendedPath,
  SkillGap,
  ThreeYearPlan,
  Risk,
} from './career-planning-types.js'

/**
 * 最低数据量要求：至少有足够的 Confirmed Facts 才能生成有意义的推荐
 */
function hasMinimumData(ctx: CareerPlanningContext): boolean {
  return ctx.yearsExperience > 0 || ctx.workHistory.length > 0 || ctx.skills.length > 1
}

/**
 * 方向分类器：根据 Confirmed Facts 推断可能的职业方向
 *
 * 规则：
 * - 每个推荐方向必须引用 >=1 个 evidence
 * - evidence 必须是 Confirmed Facts 中的真实条目
 * - 禁止凭空生成方向
 * - 数据不足时不生成具体推荐（防止 0 年经验 + careerDirection 组合产生误导）
 */
function analyzeDirections(ctx: CareerPlanningContext): RecommendedPath[] {
  const paths: RecommendedPath[] = []

  // 🔒 数据不足门控：至少需要一些真实数据才能生成有意义的推荐
  if (!hasMinimumData(ctx)) {
    return paths
  }

  // ── 基于 careerDirection 的垂直/水平扩展 ──
  if (ctx.currentDirection) {
    const dir = ctx.currentDirection.toLowerCase()

    // AI/算法方向
    if (dir.includes('ai') || dir.includes('算法') || dir.includes('人工智能')) {
      paths.push({
        direction: 'AI 应用架构师',
        reason:
          `你当前的职业方向是「${ctx.currentDirection}」，AI 领域正在从算法模型向应用架构转型。` +
          `基于你的 ${ctx.yearsExperience} 年行业经验，向上发展至架构层是自然进阶路径。`,
        confidence: 'high',
        evidence: [`career_direction: ${ctx.currentDirection}`, `years_experience: ${ctx.yearsExperience}`],
        difficulty: 3,
      })
      // 横向扩展：AI 产品化
      if (ctx.skills.some((s) => s.name.includes('产品') || s.name.includes('管理'))) {
        paths.push({
          direction: 'AI 产品负责人',
          reason: '你具备产品思维相关的技能记录，结合 AI 技术背景，AI 产品管理是值得考虑的横向路径。',
          confidence: 'medium',
          evidence: [
            `career_direction: ${ctx.currentDirection}`,
            `skills: ${ctx.skills.filter((s) => s.name.includes('产品') || s.name.includes('管理')).map((s) => s.name).join(', ')}`,
          ],
          difficulty: 2,
        })
      }
    }

    // 产品方向
    if (dir.includes('产品') || dir.includes('运营')) {
      paths.push({
        direction: `${ctx.currentDirection} 方向资深专家`,
        reason: `你当前的职业方向是「${ctx.currentDirection}」，且有 ${ctx.yearsExperience} 年从业经验。` +
          `继续深化产品能力，向高级产品经理或产品总监方向发展是直接路径。`,
        confidence: 'high',
        evidence: [`career_direction: ${ctx.currentDirection}`, `years_experience: ${ctx.yearsExperience}`],
        difficulty: 2,
      })

      // AI 产品线
      if (ctx.skills.some((s) => s.name.toLowerCase().includes('ai') || s.name.toLowerCase().includes('python'))) {
        paths.push({
          direction: 'AI 产品经理',
          reason: '你已具备 AI/技术相关的技能基础，向 AI 产品经理转型可以结合你的产品经验与技术认知。',
          confidence: 'medium',
          evidence: [
            `career_direction: ${ctx.currentDirection}`,
            `skills: ${ctx.skills.filter((s) => s.name.toLowerCase().includes('ai') || s.name.toLowerCase().includes('python')).map((s) => s.name).join(', ')}`,
          ],
          difficulty: 3,
        })
      }
    }

    // 设计方向
    if (dir.includes('设计') || ctx.skills.some((s) => s.name.includes('设计') || s.name.includes('UI') || s.name.includes('UX'))) {
      // 基础路径
      if (ctx.yearsExperience >= 4) {
        paths.push({
          direction: '设计团队负责人 / 设计总监',
          reason: `${ctx.yearsExperience} 年设计经验，你可以向设计管理方向发展，带领团队并主导设计系统建设。`,
          confidence: 'high',
          evidence: [`career_direction: ${ctx.currentDirection}`, `years_experience: ${ctx.yearsExperience}`],
          difficulty: 2,
        })
      }

      // AIGC 方向
      paths.push({
        direction: 'AIGC 视觉方向（AI 视觉设计师 / AIGC 内容生产）',
        reason: '基于你的设计背景，AIGC 工具链（Midjourney / Stable Diffusion 等）是设计行业最大的新机会。' +
          '现有设计资产迁移到 AI 工作流，而非完全转行。',
        confidence: 'medium',
        evidence: [
          `work_history: ${ctx.workHistory.length} 段经历`,
          ctx.currentDirection ? `career_direction: ${ctx.currentDirection}` : '未设定方向',
        ],
        difficulty: 2,
      })
    }

    // 开发方向
    if (
      dir.includes('开发') ||
      dir.includes('工程') ||
      dir.includes('架构') ||
      ctx.skills.some((s) =>
        ['java', 'python', 'vue', 'react', 'go', 'rust', '前端', '后端', '全栈'].some((k) =>
          s.name.toLowerCase().includes(k),
        ),
      )
    ) {
      paths.push({
        direction: `${ctx.currentDirection} 技术专家`,
        reason: `你已有 ${ctx.yearsExperience} 年开发经验，继续深入技术栈，向架构师/技术专家方向发展是稳健路径。`,
        confidence: 'high',
        evidence: [
          ctx.currentDirection ? `career_direction: ${ctx.currentDirection}` : null,
          `years_experience: ${ctx.yearsExperience}`,
          `skills: ${ctx.skills.map((s) => s.name).join(', ')}`,
        ].filter(Boolean) as string[],
        difficulty: 2,
      })

      // AI 应用方向
      if (ctx.currentDirection?.includes('AI') || ctx.currentDirection?.toLowerCase().includes('ai')) {
        paths.push({
          direction: 'AI Agent 应用开发',
          reason:
            '你当前的 AI + 开发双背景非常适合 AI Agent 方向。' +
            '2026 年 AI Agent 正从概念走向商业应用，有开发经验的 AI 人才极度稀缺。',
          confidence: 'high',
          evidence: [
            `career_direction: ${ctx.currentDirection}`,
            `skills: ${ctx.skills.map((s) => s.name).join(', ')}`,
          ],
          difficulty: 3,
        })
      }

      // 技术管理方向
      if (ctx.yearsExperience >= 6) {
        paths.push({
          direction: '技术管理（技术经理 / 技术总监）',
          reason: `${ctx.yearsExperience} 年开发经验已经为技术管理准备了足够的技术判断力基础，可以考虑逐步从纯技术向 Tech Lead 转型。`,
          confidence: 'medium',
          evidence: [`years_experience: ${ctx.yearsExperience}`, `work_history: ${ctx.workHistory.length} 段经历`],
          difficulty: 3,
        })
      }
    }
  }

  // ── 基于 workHistory 的推断 ──
  if (paths.length === 0 && ctx.workHistory.length > 0) {
    // 从最近的工作经历提取方向
    const latestJob = ctx.workHistory[0]
    const titleLower = latestJob.title.toLowerCase()

    if (titleLower.includes('设计') || titleLower.includes('ui') || titleLower.includes('ux')) {
      paths.push({
        direction: '高级视觉设计师',
        reason: `你最近一段工作是「${latestJob.title}」，在该方向继续深耕是低风险路径。`,
        confidence: 'high',
        evidence: [`work_experience: ${latestJob.company} - ${latestJob.title}`],
        difficulty: 1,
      })
    } else if (titleLower.includes('开发') || titleLower.includes('工程')) {
      paths.push({
        direction: '资深开发工程师',
        reason: `你最近一段工作是「${latestJob.title}」，积累深度技术能力是清晰路径。`,
        confidence: 'high',
        evidence: [`work_experience: ${latestJob.company} - ${latestJob.title}`],
        difficulty: 1,
      })
    } else if (titleLower.includes('销售') || titleLower.includes('市场')) {
      paths.push({
        direction: '销售管理 / 客户成功负责人',
        reason: `你最近一段工作是「${latestJob.title}」，销售/市场方向向管理发展是自然路径。`,
        confidence: 'high',
        evidence: [`work_experience: ${latestJob.company} - ${latestJob.title}`],
        difficulty: 2,
      })
    } else {
      paths.push({
        direction: `${latestJob.title} 方向深耕`,
        reason: `基于你最近一段工作经历（${latestJob.company} - ${latestJob.title}），继续深化职业能力。`,
        confidence: 'medium',
        evidence: [`work_experience: ${latestJob.company} - ${latestJob.title}`],
        difficulty: 2,
      })
    }
  }

  // ── 兜底：基于技能推断 ──
  if (paths.length === 0) {
    const skillNames = ctx.skills.map((s) => s.name)
    if (skillNames.length > 0) {
      paths.push({
        direction: '基于现有技能的职业发展',
        reason: `你已记录的技能包括：${skillNames.join('、')}。建议选择一个方向深入发展。`,
        confidence: 'low',
        evidence: [`skills: ${skillNames.join(', ')}`],
        difficulty: 3,
      })
    } else {
      // 没有任何数据可以用于推荐
      // 返回空数组，由调用方处理
    }
  }

  return paths
}

/**
 * 技能缺口分析
 */
function analyzeSkillGaps(ctx: CareerPlanningContext): SkillGap[] {
  const gaps: SkillGap[] = []
  const skillNames = new Set(ctx.skills.map((s) => s.name.toLowerCase()))

  // AI 方向常见缺口
  for (const skill of ['Python', 'PyTorch / TensorFlow', 'RAG / 向量数据库', 'AI Agent 框架']) {
    const exists = [...skillNames].some((n) => {
      const lower = skill.toLowerCase()
      return n.includes(lower) || skill.includes(n)
    })
    if (!exists) {
      gaps.push({
        skill,
        importance: 'critical',
        currentStatus: 'missing',
        suggestion: ctx.currentDirection?.includes('AI')
          ? `${skill} 是 AI 方向的核心能力，建议优先学习。`
          : `${skill} 是当前 AI 行业热门硬技能，建议了解基础。`,
      })
    }
  }

  // 根据 workHistory 检测管理能力缺口
  if (ctx.workHistory.length >= 3 && ctx.yearsExperience >= 5) {
    const hasManagement = [...skillNames].some((n) => n.includes('管理') || n.includes('lead'))
    if (!hasManagement) {
      gaps.push({
        skill: '技术管理 / 团队领导力',
        importance: 'important',
        currentStatus: 'missing',
        suggestion: `${ctx.yearsExperience} 年经验 + 多段工作经历意味着你可能需要开始关注技术管理能力。`,
      })
    }
  }

  // 检测英语能力
  const hasEnglish = [...skillNames].some((n) => n.includes('english') || n.includes('英语'))
  if (!hasEnglish) {
    gaps.push({
      skill: '英语能力（特别是技术文档阅读）',
      importance: 'important',
      currentStatus: 'missing',
      suggestion: '英语是打开全球技术资源和高端职位的关键。',
    })
  }

  // 检测已有技能的基本评估
  for (const s of ctx.skills) {
    if (s.level === 'beginner' && s.confidence < 0.5) {
      gaps.push({
        skill: `${s.name}（深入学习）`,
        importance: 'nice_to_have',
        currentStatus: 'basic',
        suggestion: `你的 ${s.name} 目前为入门水平，如果这个方向是你想要的，建议投入更多时间。`,
      })
    }
  }

  return gaps
}

/**
 * 风险分析
 */
function analyzeRisks(ctx: CareerPlanningContext): Risk[] {
  const risks: Risk[] = []

  // 经验单一性风险
  if (ctx.workHistory.length <= 1 && ctx.yearsExperience >= 3) {
    risks.push({
      description: '工作经历单一（仅 1 段经历）',
      severity: 'medium',
      mitigation: '考虑拓宽经验范围，或通过项目/开源贡献补充经历多样性。',
    })
  }

  // 方向未定风险
  if (!ctx.currentDirection) {
    risks.push({
      description: '职业方向未设定',
      severity: 'high',
      mitigation: '建议尽快明确职业方向，否则难以形成聚焦的职业发展路径。',
    })
  }

  // 技能广度 vs 深度风险
  if (ctx.skills.length > 8 && ctx.skills.every((s) => s.level === 'beginner')) {
    risks.push({
      description: '技能广度大但深度不足',
      severity: 'medium',
      mitigation: '建议选择 2-3 个核心技能深入学习，建立不可替代性。',
    })
  }

  // 转型风险：从非 AI 转 AI
  if (ctx.userGoal?.includes('AI') && !ctx.currentDirection?.includes('AI')) {
    risks.push({
      description: '转型 AI 但背景不匹配',
      severity: 'high',
      mitigation: '建议从「AI + 现有经验」的交叉领域切入，而非完全切换赛道。',
    })
  }

  // 信息缺失风险
  if (ctx.missingInformation.length > 2) {
    risks.push({
      description: `关键信息缺失（${ctx.missingInformation.length} 项）`,
      severity: 'medium',
      mitigation: '建议补充职业方向、技能、工作经历等关键信息，以获得更精准的分析。',
    })
  }

  return risks
}

/**
 * 生成三年行动计划
 */
function generateThreeYearPlan(ctx: CareerPlanningContext): ThreeYearPlan {
  const hasAI = ctx.currentDirection?.includes('AI') || ctx.skills.some((s) => s.name.toLowerCase().includes('ai'))
  const hasEnoughExp = ctx.yearsExperience >= 3

  if (hasAI) {
    return {
      year1: '深耕核心 AI 技能，至少完成 2 个真实 AI 项目（个人/开源/工作）。' +
        (hasEnoughExp ? ' 开始在团队中承担技术决策角色。' : ' 重点打好编程和算法基础。'),
      year2: `建立 AI 领域的专业影响力（技术博客/开源贡献/行业分享）。${hasEnoughExp ? ' 争取带项目或带团队。' : ' 争取进入 AI 相关岗位。'}`,
      year3: '成为所在组织的 AI 方向关键成员，或转型为 AI 产品/架构方向 leader。',
    }
  }

  if (ctx.currentDirection?.includes('产品')) {
    return {
      year1: `深化${ctx.currentDirection}能力，建立数据驱动决策方法。确保至少主导 1 个完整产品迭代。`,
      year2: '拓展商业化思维/团队协作能力，向高级产品经理发展。',
      year3: '成为产品方向负责人，或结合 AI 能力向 AI 产品经理转型。',
    }
  }

  if (ctx.currentDirection?.includes('设计') || ctx.skills.some((s) => s.name.includes('设计'))) {
    return {
      year1: '夯实设计系统/AIGC 工具链能力。' + (hasEnoughExp ? ' 开始在项目中引入 AI 工作流。' : ' 重点提升设计基本功。'),
      year2: `${hasEnoughExp ? '争取设计团队管理角色' : '进入更有成长空间的设计团队'}，建立作品集影响力。`,
      year3: `${hasEnoughExp ? '成为设计负责人或独立工作室主理人' : '成长为高级设计师'}，具备独立主导设计项目能力。`,
    }
  }

  // 兜底
  return {
    year1: '明确职业方向，补充关键技能。' + (ctx.currentDirection ? ` 在 ${ctx.currentDirection} 方向深入。` : ''),
    year2: '在该方向建立深度，争取主导项目或带新人。',
    year3: '成为该方向专家，或横向拓展管理能力。',
  }
}

/**
 * 职业智能决策引擎
 *
 * @param ctx 职业规划上下文（必须经过 dataQualityStatus 门控）
 * @returns 结构化的职业智能分析
 */
export async function generateCareerIntelligence(ctx: CareerPlanningContext): Promise<CareerIntelligenceOutput> {
  const paths = analyzeDirections(ctx)
  const skillGaps = analyzeSkillGaps(ctx)
  const risks = analyzeRisks(ctx)
  const plan = generateThreeYearPlan(ctx)

  return {
    analyzedAt: new Date().toISOString(),
    contextSnapshot: {
      yearsExperience: ctx.yearsExperience,
      skillCount: ctx.skills.length,
      workHistoryCount: ctx.workHistory.length,
      hasGoal: !!ctx.userGoal,
    },
    recommendedPaths: paths,
    skillGapAnalysis: skillGaps,
    threeYearPlan: plan,
    risks,
    missingInformation: ctx.missingInformation,
    dataQualityStatus: ctx.dataQualityStatus,
    isLegacy: ctx.dataQualityStatus === 'legacy_unknown',
  }
}

/**
 * 生成面向用户的自然语言摘要
 *
 * LLM 边界（09E-03 Task 03）：
 * - AI 只能基于 CareerIntelligenceOutput 生成解释
 * - AI 不能创造新的职业事实
 * - 每个建议的 reason/evidence 来自引擎的结构化输出
 */
export function formatIntelligenceForUser(output: CareerIntelligenceOutput): string {
  const lines: string[] = []

  lines.push('📊 职业智能分析')
  lines.push('')
  lines.push(`基于你确认的 ${output.contextSnapshot.workHistoryCount} 段工作经历、${output.contextSnapshot.skillCount} 项技能和 ${output.contextSnapshot.yearsExperience} 年经验。`)
  lines.push('')

  // 推荐路径
  if (output.recommendedPaths.length > 0) {
    lines.push('🎯 推荐职业路径')
    lines.push('')
    for (const path of output.recommendedPaths) {
      const conf = path.confidence === 'high' ? '🟢' : path.confidence === 'medium' ? '🟡' : '⚪'
      lines.push(`${conf} ${path.direction}`)
      lines.push(`   ${path.reason}`)
      lines.push(`   可信度: ${path.confidence === 'high' ? '高' : path.confidence === 'medium' ? '中' : '低'} | 转型难度: ${'⭐'.repeat(path.difficulty)}`)
      lines.push(`   依据: ${path.evidence.join('、')}`)
      lines.push('')
    }
  } else {
    lines.push('⚠️ 职业信息不足以生成具体推荐路径。')
    lines.push(`   当前只有 ${output.contextSnapshot.yearsExperience} 年经验、${output.contextSnapshot.skillCount} 项技能、${output.contextSnapshot.workHistoryCount} 段工作经历。`)
    lines.push('   建议先完善职业信息（工作经历、技能等），再进行职业分析。')
  }

  // 技能缺口
  if (output.skillGapAnalysis.length > 0) {
    lines.push('📚 技能缺口分析')
    lines.push('')
    for (const gap of output.skillGapAnalysis) {
      const imp = gap.importance === 'critical' ? '🔴 必备' : gap.importance === 'important' ? '🟡 重要' : '⚪ 加分'
      const cur = gap.currentStatus === 'missing' ? '缺失' : gap.currentStatus === 'basic' ? '基础' : '具备'
      lines.push(`${imp} | ${gap.skill}（${cur}）`)
      lines.push(`   ${gap.suggestion}`)
    }
    lines.push('')
  }

  // 三年计划
  lines.push('📅 三年行动计划')
  lines.push('')
  lines.push(`第1年: ${output.threeYearPlan.year1}`)
  lines.push(`第2年: ${output.threeYearPlan.year2}`)
  lines.push(`第3年: ${output.threeYearPlan.year3}`)
  lines.push('')

  // 风险提示
  if (output.risks.length > 0) {
    lines.push('⚠️ 风险提示')
    lines.push('')
    for (const risk of output.risks) {
      const sev = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '⚪'
      lines.push(`${sev} ${risk.description}`)
      lines.push(`   建议: ${risk.mitigation}`)
    }
  }

  return lines.join('\n')
}
