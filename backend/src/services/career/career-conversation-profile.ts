// ─── Sprint-10D Task 01: CareerConversationProfile 已降级 ─────
//
// 不再维护独立字段结构。
// CareerIdentityProfile (career-identity/types.ts) 是唯一 SSOT。
// 所有修改必须通过 careerIdentityService.mergeExtraction()。
//
// 生命周期（迁移完成前）：
//   1. 旧的 `createEmptyProfile()` 仍可用（返回旧接口）
//   2. `extractCareerFacts()` + `mergeProfiles()` 不再产生实际变更
//   3. `formatProfileForPrompt()` 保留供下游调用
//   4. `buildCareerConversationContext()` 保留供下游调用
//
// 新调用链：
//   userMessage → careerIdentityService.processUserInput()
//              → 写入 CareerIdentityProfile (SSOT)
//              → buildLLMContext() → LLM Prompt

import type { CareerIdentityProfile } from '../career-identity/types.js'

/**
 * 单段工作经历（旧接口，@deprecated）
 */
export interface CareerHistoryEntry {
  company: string
  role: string
  years: string
  description: string
  evidence: string
}

/**
 * 技能条目（旧接口，@deprecated）
 */
export interface CareerSkill {
  name: string
  level: string      // beginner | intermediate | advanced | expert
  evidence: string
}

/**
 * 项目经验（旧接口，@deprecated）
 */
export interface ProjectEntry {
  name: string
  description: string
  technology: string
  evidence: string
}

/**
 * CareerConversationProfile — @deprecated Sprint-10D
 *
 * 不再作为独立事实源。
 * 所有字段保持定义以兼容下游引用，但不再主动维护。
 * 使用 CareerIdentityProfile (career-identity/types.ts) 替代。
 */
export interface CareerConversationProfile {
  identity: { name: string; age: string; gender: string }
  location: { city: string; preferredCities: string[] }
  education: { degree: string; major: string; school: string }
  careerHistory: CareerHistoryEntry[]
  experienceYears: number
  skills: CareerSkill[]
  projects: ProjectEntry[]
  achievements: string[]
  targetCareer: { position: string; industry: string; direction: string }
  jobSearch: { status: string; salary: string; availability: string }
  /** @deprecated 用 identityProfile.confirmedFacts */
  confirmedFacts: string[]
  /** @deprecated 用 identityProfile.missingFields */
  missingInformation: string[]
}

// ─── 适配器：ConversationProfile ↔ IdentityProfile ─────

/**
 * 将 IdentityProfile 转换为普通的 ConversationProfile 对象
 * 用于兼容下游旧代码
 */
export function toConversationProfile(ip: CareerIdentityProfile): CareerConversationProfile {
  return {
    identity: {
      name: ip.identity.name || '',
      age: String(ip.identity.age || ''),
      gender: ip.identity.gender || '',
    },
    location: {
      city: ip.location.currentCity || '',
      preferredCities: ip.location.preferredCities,
    },
    education: {
      degree: ip.education.degree || '',
      major: ip.education.major || '',
      school: ip.education.school || '',
    },
    careerHistory: (ip.workExperience || []).map(w => ({
      company: w.company,
      role: w.position,
      years: String(w.years),
      description: w.description,
      evidence: '',
    })),
    experienceYears: ip.career.yearsExperience || 0,
    skills: (ip.skills || []).map(s => ({
      name: s.name,
      level: s.level,
      evidence: s.evidence,
    })),
    projects: (ip.projects || []).map(p => ({
      name: p.name,
      description: p.description,
      technology: p.technology,
      evidence: '',
    })),
    achievements: ip.workExperience.flatMap(w => w.achievements || []),
    targetCareer: {
      position: ip.career.targetPosition || '',
      industry: ip.career.targetIndustry || '',
      direction: ip.career.careerDirection || '',
    },
    jobSearch: {
      status: ip.career.currentStatus || '',
      salary: ip.jobPreference.salary || '',
      availability: '',
    },
    confirmedFacts: (ip.confirmedFacts || []).map(f => `${f.field}: ${f.value}`),
    missingInformation: ip.missingFields,
  }
}

/** @deprecated 用 mergeExtraction 替代 */
export function mergeProfiles(
  _current: CareerConversationProfile,
  _updates: Partial<CareerConversationProfile>
): CareerConversationProfile {
  // Sprint-10D: mergeProfiles 已废弃
  // 所有修改必须通过 careerIdentityService.mergeExtraction()
  // 返回原值（不做变更）
  return { ..._current }
}

/** @deprecated 用 IdentityProfile.missingFields 替代 */
export function detectMissingInformation(_profile: CareerConversationProfile): string[] {
  return _profile.missingInformation || []
}

/** @deprecated 用 IdentityProfile 判断替代 */
export function hasMinimumData(profile: CareerConversationProfile): boolean {
  const hasName = !!profile.identity.name
  const hasExperience = profile.experienceYears > 0 || profile.careerHistory.length > 0
  const hasSkill = profile.skills.length > 0
  const hasTarget = !!profile.targetCareer.position || !!profile.targetCareer.direction
  const met = [hasName, hasExperience, hasSkill, hasTarget].filter(Boolean).length
  return met >= 2
}

/**
 * 将 CareerConversationProfile 转为简洁的身份文本
 * @deprecated Sprint-10D: 在 Task 02 中替换为 buildLLMContext
 */
export function formatProfileForPrompt(profile: CareerConversationProfile): string {
  const lines: string[] = []
  lines.push('【用户职业身份卡】')
  lines.push('以下信息是用户已经确认的职业事实，不要重复询问。')
  lines.push('')

  if (profile.identity.name) lines.push(`姓名：${profile.identity.name}`)
  if (profile.identity.age) lines.push(`年龄：${profile.identity.age}`)
  if (profile.location.city) lines.push(`城市：${profile.location.city}`)
  if (profile.location.preferredCities.length > 0) lines.push(`意向城市：${profile.location.preferredCities.join('、')}`)

  if (profile.education.school || profile.education.degree || profile.education.major) {
    const edu = [profile.education.degree, profile.education.school, profile.education.major].filter(Boolean).join(' ')
    lines.push(`教育背景：${edu}`)
  }

  if (profile.experienceYears > 0) lines.push(`工作年限：${profile.experienceYears}年`)
  if (profile.careerHistory.length > 0) {
    const recent = profile.careerHistory.slice(0, 3).map(h => `${h.role} @ ${h.company}`).join('；')
    lines.push(`工作经历：${recent}`)
  }
  if (profile.skills.length > 0) {
    const skillList = profile.skills.map(s => s.name).join('、')
    lines.push(`技能：${skillList}`)
  }
  if (profile.projects.length > 0) {
    const projList = profile.projects.slice(0, 3).map(p => p.name).join('、')
    lines.push(`项目：${projList}`)
  }
  if (profile.targetCareer.position) lines.push(`目标岗位：${profile.targetCareer.position}`)
  if (profile.targetCareer.industry) lines.push(`目标行业：${profile.targetCareer.industry}`)
  if (profile.targetCareer.direction) lines.push(`职业方向：${profile.targetCareer.direction}`)
  if (profile.jobSearch.salary) lines.push(`期望薪资：${profile.jobSearch.salary}`)

  lines.push('')
  lines.push('规则：')
  lines.push('1. 不重复询问已有信息。')
  lines.push('2. 不创造用户没有提供的经历。')
  lines.push('3. 优先补充 missingInformation 中的字段。')
  lines.push('4. 每次交流推动职业画像完善。')

  return lines.join('\n')
}

/** @deprecated 用 createEmptyProfile from career-identity/types 替代 */
export function createEmptyProfile(): CareerConversationProfile {
  return {
    identity: { name: '', age: '', gender: '' },
    location: { city: '', preferredCities: [] },
    education: { degree: '', major: '', school: '' },
    careerHistory: [],
    experienceYears: 0,
    skills: [],
    projects: [],
    achievements: [],
    targetCareer: { position: '', industry: '', direction: '' },
    jobSearch: { status: '', salary: '', availability: '' },
    confirmedFacts: [],
    missingInformation: [],
  }
}
