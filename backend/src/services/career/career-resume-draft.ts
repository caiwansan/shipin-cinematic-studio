// ─── Sprint-10B T05: Resume Draft Trigger ─────
//
// 职业画像达到最低条件后生成 ResumeDraft。
// 前提：已有 CareerConversationProfile，且 hasMinimumData 为 true。
//
// 生成条件：
// - name（姓名）+ experience（经验）+ skills（技能）+ education（教育）+ targetCareer（目标）
//
// 注意：
// - 不是自动发布，只是生成候选简历资产
// - 需要用户确认后才进入正式流程

import type { CareerConversationProfile } from './career-conversation-profile.js'
import { hasMinimumData } from './career-conversation-profile.js'

// ─── 简历草稿类型 ─────────────────────────────────────

export interface ResumeDraft {
  basicInfo: {
    name: string
    city: string
    email: string
    phone: string
  }
  /** 职业摘要（1-3 句话） */
  careerSummary: string
  /** 技能列表 */
  skills: ResumeDraftSkill[]
  /** 工作经历 */
  experience: ResumeDraftExperience[]
  /** 项目经历 */
  projects: ResumeDraftProject[]
  /** 教育背景 */
  education: ResumeDraftEducation
  /** 目标岗位 */
  targetPosition: string
  /** 生成时间 */
  generatedAt: string
  /** 是否已确认 */
  confirmedAt?: string
}

export interface ResumeDraftSkill {
  name: string
  level: string
}

export interface ResumeDraftExperience {
  company: string
  role: string
  years: string
  description: string
}

export interface ResumeDraftProject {
  name: string
  description: string
  technology: string
}

export interface ResumeDraftEducation {
  degree: string
  school: string
  major: string
}

// ─── 触发条件检查 ─────────────────────────────────────

/**
 * 检查是否满足简历草稿生成条件
 *
 * 完整条件：
 * 1. profile 有 hasMinimumData
 * 2. 有姓名
 * 3. 有经验（工作经历或年限）
 * 4. 有技能
 * 5. 有教育（至少一项）
 * 6. 有目标（岗位或方向）
 */
export function canGenerateResumeDraft(profile: CareerConversationProfile): boolean {
  if (!hasMinimumData(profile)) return false

  const checks = [
    !!profile.identity.name,
    profile.experienceYears > 0 || profile.careerHistory.length > 0,
    profile.skills.length > 0,
    !!profile.education.degree || !!profile.education.school,
    !!profile.targetCareer.position || !!profile.targetCareer.direction,
  ]

  return checks.filter(Boolean).length >= 4
}

// ─── 简历生成 ─────────────────────────────────────────

/**
 * 从 CareerConversationProfile 生成 ResumeDraft
 *
 * 只在 canGenerateResumeDraft 返回 true 时调用。
 * 生成结果需要用户确认。
 *
 * @param profile 职业画像
 * @returns 简历草稿
 */
export function generateResumeDraft(profile: CareerConversationProfile): ResumeDraft | null {
  if (!canGenerateResumeDraft(profile)) {
    return null
  }

  const draft: ResumeDraft = {
    basicInfo: {
      name: profile.identity.name || '',
      city: profile.location.city || '',
      email: '',
      phone: '',
    },
    careerSummary: buildCareerSummary(profile),
    skills: profile.skills.map(s => ({
      name: s.name,
      level: s.level,
    })),
    experience: profile.careerHistory.map(h => ({
      company: h.company,
      role: h.role,
      years: h.years,
      description: h.description,
    })),
    projects: profile.projects.map(p => ({
      name: p.name,
      description: p.description,
      technology: p.technology,
    })),
    education: {
      degree: profile.education.degree || '',
      school: profile.education.school || '',
      major: profile.education.major || '',
    },
    targetPosition: profile.targetCareer.position || profile.targetCareer.direction || '',
    generatedAt: new Date().toISOString(),
  }

  return draft
}

// ─── 工具函数 ─────────────────────────────────────────

/**
 * 构建职业摘要（基于现有信息生成 1-3 句话）
 */
function buildCareerSummary(profile: CareerConversationProfile): string {
  const parts: string[] = []

  if (profile.experienceYears > 0) {
    parts.push(`${profile.experienceYears}年`)
  }

  // 行业
  const industry = profile.targetCareer.industry
  if (industry) {
    const prefix = profile.experienceYears > 0 ? '' : ''
    parts.push(`${industry}行业`)
  }

  // 角色
  const role = profile.targetCareer.position
  if (role) {
    parts.push(`${role}`)
  }

  // 技能摘要
  if (profile.skills.length > 0) {
    const topSkills = profile.skills.slice(0, 3).map(s => s.name).join('、')
    parts.push(`擅长${topSkills}`)
  }

  if (parts.length > 0) {
    const summary = parts.join(' | ')
    return `${profile.identity.name || '求职者'}，${summary}。`
  }

  return `${profile.identity.name || '求职者'}，正在寻求新的职业机会。`
}

// ─── Resume Draft 注册与状态管理 ───────────────────────

/** 对话中生成的简历草稿注册表（内存）*/
const resumeDraftRegistry = new Map<string, ResumeDraft>()

/**
 * 注册简历草稿（关联用户 ID）
 */
export function registerResumeDraft(userId: string, draft: ResumeDraft): void {
  resumeDraftRegistry.set(userId, draft)
}

/**
 * 获取用户的简历草稿
 */
export function getResumeDraft(userId: string): ResumeDraft | undefined {
  return resumeDraftRegistry.get(userId)
}

/**
 * 确认简历草稿
 */
export function confirmResumeDraft(userId: string): boolean {
  const draft = resumeDraftRegistry.get(userId)
  if (!draft) return false
  draft.confirmedAt = new Date().toISOString()
  return true
}
