// ─── Sprint-09E-05.1 Task 02: Career Context Builder ─────
// 统一服务：从数据库读取 Confirmed Facts，构建 CareerIdentityCard + CurrentCareerContext。
//
// 约束：
// 1. ✅ 只读 dataQualityStatus=valid 的 Confirmed Facts
// 2. ✅ 禁止 legacy_unknown / review_required 数据进入
// 3. ✅ 所有字段 source 可追溯
// 4. ✅ 不新建数据库表
// 5. ✅ 复用 CareerProfile / WorkExperience / CandidateSkill / Education

import { prisma } from '../../../utils/index.js'
import type { CareerAgentContext, CareerIdentityCard, CurrentCareerContext } from './career-identity-card.js'
import { DataQualityStatus } from '../data-quality-status.js'

/**
 * 构建 Career Agent 统一上下文
 *
 * 所有 Career Agent 入口必须使用此函数获取用户职业身份：
 * - Chat（聊天）
 * - Planning（规划）
 * - Actions（行动）
 * - Interview / Matching（面试/匹配）
 *
 * 这是 Career Context Authority —— 唯一可信的职业身份来源。
 *
 * @param userId 用户 ID
 * @returns CareerAgentContext — 统一上下文，含 identityCard + currentContext + activeActions + recentFeedback
 * @throws 如果用户无 CareerProfile 数据
 * @throws 如果 dataQualityStatus=legacy_unknown（违反数据门控）
 */
export async function buildCareerAgentContext(userId: string): Promise<CareerAgentContext> {
  // ── Step 1: 获取 CareerProfile 基础数据 ──
  const profile = await prisma.careerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      fullName: true,
      yearsExperience: true,
      currentLevel: true,
      careerDirection: true,
      city: true,
      industry: true,
      dataQualityStatus: true,
    },
  })

  if (!profile) {
    throw new Error(`[CareerContext] 用户 ${userId.slice(0, 8)}... 无 CareerProfile 数据`)
  }

  // ── Step 2: 数据质量门控 ──
  if (profile.dataQualityStatus === DataQualityStatus.LEGACY_UNKNOWN) {
    throw new Error(
      `[CareerContext] 数据质量状态为 legacy_unknown，无法构建 Identity Card。用户 ${userId.slice(0, 8)}... 的数据来源不可信。`
    )
  }

  const dataQualityStatus = profile.dataQualityStatus || DataQualityStatus.VALID

  // ── Step 3: 读取子表数据（所有 Confirmed Facts） ──
  // 3a: WorkExperience（through CareerProfile.workExperiences relation）
  const workExperiences = await prisma.workExperience.findMany({
    where: { profileId: profile.id },
    select: {
      company: true,
      title: true,
      startDate: true,
      endDate: true,
      isCurrent: true,
      skillsUsed: true,
    },
    orderBy: { startDate: 'desc' },
  })

  // 3b: CandidateSkill（through CareerProfile.skills relation — uses profileId FK）
  const candidateSkills = await prisma.candidateSkill.findMany({
    where: { profileId: profile.id },
    select: {
      skill: { select: { name: true } },
      level: true,
      source: true,
    },
  })

  // 3c: Education（through CareerProfile.educations relation — uses profileId FK）
  const educations = await prisma.education.findMany({
    where: { profileId: profile.id },
    select: {
      school: true,
      degree: true,
      major: true,
    },
  })

  // 3d: CareerActionProgress（活跃任务 + 最近反馈 — uses userId directly）
  const actionProgressRecords = await prisma.careerActionProgress.findMany({
    where: { userId },
    select: {
      id: true,
      actionTitle: true,
      phase: true,
      status: true,
      feedback: true,
      alternativePath: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 13, // 10 active + 3 feedback
  })

  const activeActions = actionProgressRecords.filter(a => ['pending', 'doing'].includes(a.status)).slice(0, 10)
  const feedbackRecords = actionProgressRecords.filter(a => a.feedback != null).slice(0, 3)

  // ── Step 4: 构建 CareerIdentityCard ──
  const identityCard: CareerIdentityCard = {
    userId,

    identity: {
      name: profile.fullName || undefined,
      location: profile.city || undefined,
    },

    career: {
      currentRole: workExperiences.find(w => w.isCurrent)?.title || undefined,
      experienceYears: profile.yearsExperience || 0,
      industries: profile.industry ? [profile.industry] : [],
      direction: profile.careerDirection || undefined,
      level: profile.currentLevel || undefined,
    },

    skills: candidateSkills.map(s => ({
      name: s.skill.name,
      level: s.level || 'beginner',
      source: s.source || 'resume_extraction',
    })),

    education: educations.map(e => ({
      school: e.school,
      degree: e.degree || undefined,
      major: e.major || undefined,
    })),

    workHistory: workExperiences.map(w => ({
      company: w.company,
      title: w.title,
      startDate: w.startDate,
      endDate: w.endDate || undefined,
      isCurrent: w.isCurrent,
      skillsUsed: (w.skillsUsed as string[]) || [],
    })),

    confirmedFacts: buildConfirmedFactsList(profile, workExperiences, candidateSkills, educations),

    careerGoals: buildCareerGoals(profile),
  }

  // ── Step 5: 构建 CurrentCareerContext ──
  const currentContext: CurrentCareerContext = {
    currentGoal: undefined, // CareerProfile 不直接存储 targetRole，未来可选
    constraints: [],
    missingInformation: detectMissingInformation(identityCard),
  }

  // ── Step 6: 组装 CareerAgentContext ──
  return {
    identityCard,
    currentContext,
    activeActions: activeActions.map(a => ({
      id: a.id,
      title: a.actionTitle,
      phase: a.phase,
      status: a.status,
    })),
    recentFeedback: feedbackRecords.map(f => ({
      actionId: f.id,
      actionTitle: f.actionTitle,
      status: f.status,
      feedback: f.feedback || undefined,
      updatedAt: f.updatedAt,
    })),
  }
}

// ─── Helpers ─────────────────────────────────────────

/**
 * 构建 Confirmed Facts 引用列表
 * 每一条 evidence 对应一个有来源可追溯的确认事实
 */
function buildConfirmedFactsList(
  profile: any,
  experiences: any[],
  skills: any[],
  educations: any[]
): string[] {
  const facts: string[] = []

  if (profile.fullName) facts.push(`fullName: ${profile.fullName}`)
  if (profile.yearsExperience != null) facts.push(`yearsExperience: ${profile.yearsExperience}`)
  if (profile.careerDirection) facts.push(`careerDirection: ${profile.careerDirection}`)
  if (profile.industry) facts.push(`industry: ${profile.industry}`)
  if (profile.city) facts.push(`city: ${profile.city}`)

  for (const exp of experiences) {
    facts.push(`workExperience: ${exp.title} @ ${exp.company} (${exp.isCurrent ? '当前' : '过往'})`)
  }

  for (const skill of skills) {
    facts.push(`skill: ${skill.skill.name} (${skill.level}, source: ${skill.source})`)
  }

  for (const edu of educations) {
    facts.push(`education: ${edu.major || ''} @ ${edu.school}${edu.degree ? ` (${edu.degree})` : ''}`)
  }

  return facts
}

/**
 * 构建职业目标列表
 */
function buildCareerGoals(profile: any): string[] {
  const goals: string[] = []
  if (profile.careerDirection) goals.push(`职业方向: ${profile.careerDirection}`)
  if (profile.industry) goals.push(`行业: ${profile.industry}`)
  return goals
}

/**
 * 检测关键缺失信息（用于引导用户补充）
 * 与 09E-03 buildCareerPlanningContext 的 missingInformation 逻辑一致
 */
function detectMissingInformation(card: CareerIdentityCard): string[] {
  const missing: string[] = []

  if (!card.identity.name) missing.push('用户姓名')
  if (card.career.experienceYears === 0) missing.push('工作年限')
  if (card.skills.length === 0) missing.push('技能列表')
  if (card.education.length === 0) missing.push('教育背景')
  if (!card.career.direction && !card.career.currentRole) missing.push('职业方向/当前角色')

  return missing
}
