// ─── Sprint-10C: CareerIdentityProfile 类型定义 ───
// 免费 + 付费 Career Agent 共用基础资产
// 所有用户信息只能来自用户明确表达，LLM 不可自动补全

export type ProfileStatus = 'collecting' | 'draft' | 'completed' | 'published'

export type SkillLevel = 'beginner' | 'intermediate' | 'expert'

export interface IdentityProfileIdentity {
  name: string | null
  age: number | null
  gender: string | null
}

export interface IdentityProfileLocation {
  currentCity: string | null
  preferredCities: string[]
}

export interface IdentityProfileEducation {
  degree: string | null
  school: string | null
  major: string | null
}

export interface IdentityProfileCareer {
  currentStatus: string | null
  targetPosition: string | null
  targetIndustry: string | null
  yearsExperience: number | null
  careerDirection: string | null
}

export interface IdentityProfileSkill {
  name: string
  level: SkillLevel
  evidence: string
}

export interface IdentityProfileWorkExperience {
  company: string
  position: string
  years: number
  description: string
  achievements: string[]
}

export interface IdentityProfileProject {
  name: string
  description: string
  technology: string
}

export interface IdentityProfileJobPreference {
  salary: string | null
  location: string | null
  remote: boolean
}

export interface IdentityProfileConfirmedFact {
  field: string
  value: string
  source: 'user'
  createdAt: Date
}

/**
 * CareerIdentityProfile — 用户职业身份资产的 Single Source of Truth
 *
 * 以 JSON 文档为核心，不依赖关系表。
 * 免费和付费 Career Agent 共用此资产。
 */
export interface CareerIdentityProfile {
  id: string
  userId: string
  status: ProfileStatus

  identity: IdentityProfileIdentity
  location: IdentityProfileLocation
  education: IdentityProfileEducation
  career: IdentityProfileCareer

  skills: IdentityProfileSkill[]
  workExperience: IdentityProfileWorkExperience[]
  projects: IdentityProfileProject[]

  jobPreference: IdentityProfileJobPreference

  confirmedFacts: IdentityProfileConfirmedFact[]
  missingFields: string[]
  completionScore: number

  createdAt: Date
  updatedAt: Date
}

/**
 * 创建空的 CareerIdentityProfile
 */
export function createEmptyProfile(userId: string): CareerIdentityProfile {
  return {
    id: '',
    userId,
    status: 'collecting',
    identity: { name: null, age: null, gender: null },
    location: { currentCity: null, preferredCities: [] },
    education: { degree: null, school: null, major: null },
    career: {
      currentStatus: null,
      targetPosition: null,
      targetIndustry: null,
      yearsExperience: null,
      careerDirection: null,
    },
    skills: [],
    workExperience: [],
    projects: [],
    jobPreference: { salary: null, location: null, remote: false },
    confirmedFacts: [],
    missingFields: ['name', 'careerDirection', 'experience', 'skills'],
    completionScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * 从 Prisma JSON 字段解析为类型化对象
 */
export function parseJsonField<T>(json: unknown, defaultValue: T): T {
  if (!json) return defaultValue
  if (typeof json === 'object') return json as T
  try {
    return JSON.parse(String(json)) as T
  } catch {
    return defaultValue
  }
}
