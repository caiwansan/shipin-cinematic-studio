// ─── Sprint-09E-03 Task 01: Career Planning Input Reality ─────
// 严格输入边界：只读取 dataQualityStatus=valid 的 Confirmed Facts
// 禁止 legacy_unknown / review_required 数据参与职业分析
//
// Sprint-09E-05.1 Task 05: 改用 buildCareerAgentContext 统一入口
// 不再单独查询 CareerProfile + 子表

import { prisma } from '../../utils/index.js'
import type {
  CareerPlanningContext,
  ConfirmedExperience,
  ConfirmedSkill,
  ConfirmedEducation,
} from './career-planning-types.js'
import { DataQualityStatus } from './data-quality-status.js'
import { extractResumeSafeData } from './resume-safety-gate.js'
import { buildCareerAgentContext } from './context/career-context-builder.js'
import type { CareerAgentContext } from './context/career-identity-card.js'

/**
 * 构建职业规划上下文
 *
 * 核心约束（来自 09E-03 设计）：
 * 1. ❌ 不直接读取所有 CareerProfile JSON
 * 2. ❌ 不读取 legacy 数据
 * 3. ❌ 不根据 industry/history 自动脑补
 * 4. ❌ 不使用 Resume 未确认字段
 * 5. ✅ 只读取 dataQualityStatus=valid 的 Confirmed Facts
 * 6. ✅ Sprint-09E-05.1: 通过 buildCareerAgentContext 统一入口
 *
 * @param userId 用户 ID
 * @param userGoal 用户明确提出的职业目标（可选）
 * @param constraints 用户约束列表（可选）
 */
export async function buildCareerPlanningContext(
  userId: string,
  userGoal?: string,
  constraints?: string[],
): Promise<CareerPlanningContext> {
  // ── Step 1: 数据质量门控（保留独立验证） ──
  const safeData = await extractResumeSafeData(userId)

  if (!safeData) {
    throw new Error('用户无 CareerProfile 数据')
  }

  if (safeData.dataQualityStatus === DataQualityStatus.LEGACY_UNKNOWN) {
    throw new Error(`数据质量状态为 legacy_unknown，无法参与职业分析。用户 ${userId.slice(0, 8)}... 的数据来源不可信。`)
  }
  if (safeData.dataQualityStatus === DataQualityStatus.REVIEW_REQUIRED) {
    throw new Error(`数据质量状态为 review_required，需要人工审查后参与分析。用户 ${userId.slice(0, 8)}...`)
  }

  // ── Step 2: 通过统一 Context Builder 获取职业身份（Sprint-09E-05.1）──
  let agentCtx: CareerAgentContext
  try {
    agentCtx = await buildCareerAgentContext(userId)
  } catch (err) {
    throw new Error(`构建职业上下文失败: ${(err as Error).message}`)
  }

  const { identityCard } = agentCtx

  // ── Step 3: 从 Identity Card 映射 Confirmed Facts ──
  const workHistory: ConfirmedExperience[] = identityCard.workHistory.map((w) => ({
    company: w.company,
    title: w.title,
    startDate: w.startDate,
    endDate: w.endDate,
    isCurrent: w.isCurrent,
    description: undefined, // 非必需，通过 identityCard 可扩展
    achievements: [],       // 同上
    skillsUsed: w.skillsUsed,
  }))

  const skills: ConfirmedSkill[] = identityCard.skills.map((s) => ({
    name: s.name,
    level: s.level,
    confidence: s.level === 'advanced' ? 0.9 : s.level === 'intermediate' ? 0.7 : 0.5,
  }))

  const education: ConfirmedEducation[] = identityCard.education.map((e) => ({
    school: e.school,
    degree: e.degree,
    major: e.major,
  }))

  // ── Step 4: 检测缺失信息 ──
  const missingInformation: string[] = [...agentCtx.currentContext.missingInformation]
  if (!identityCard.career.direction && !userGoal) {
    missingInformation.push('职业方向未设定')
  }
  if (identityCard.career.industries.length === 0 && !safeData.industry) {
    missingInformation.push('行业信息缺失')
  }

  // ── Step 5: 组装上下文 ──
  return {
    fullName: identityCard.identity.name || safeData.fullName,
    currentDirection: identityCard.career.direction ?? undefined,
    industry: identityCard.career.industries[0] ?? undefined,
    yearsExperience: identityCard.career.experienceYears || safeData.yearsExperience,
    currentLevel: identityCard.career.level ?? undefined,
    workHistory,
    skills,
    education,
    userGoal: userGoal || identityCard.careerGoals[0] || undefined,
    constraints: constraints || agentCtx.currentContext.constraints,
    missingInformation,
    dataSources: [
      'career_profile',
      ...(workHistory.length > 0 ? ['work_experience'] : []),
      ...(skills.length > 0 ? ['candidate_skill'] : []),
      ...(education.length > 0 ? ['education'] : []),
    ],
    dataQualityStatus: safeData.dataQualityStatus,
  }
}
