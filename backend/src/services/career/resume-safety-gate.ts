// ─── Sprint-09E-02 Task 03.2 Resume Safety Gate ─────
// 🛡️ 简历数据安全门：确保 Resume Generator 只读取 Confirmed Facts
//
// 使用规则：
//   任何生成简历的代码必须调用 this.extractResumeSafeData(profile)
//   而非直接读取 CareerProfile 字段。
//
// CareerProfile 只存 Confirmed Facts。
// Derived Insights 存储在 CareerProfile.appendInsights() 的 metadata 或独立文件。
// Resume 生成路径禁止读取 Derived Insights 作为"事实"。

import { prisma } from '../../utils/index.js'

/**
 * 数据质量状态枚举（与 career_profile 表保持一致）
 */
const DataQualityStatus = {
  VALID: 'valid',
  REVIEW_REQUIRED: 'review_required',
  LEGACY_UNKNOWN: 'legacy_unknown',
} as const

/**
 * 安全的简历数据（只含用户确认的事实）
 */
export interface SafeResumeData {
  fullName: string
  headline?: string
  bio?: string
  city?: string
  careerDirection?: string
  industry?: string
  yearsExperience: number
  currentLevel?: string
  email?: string
  phone?: string
  /** 用户明确说过的技能 */
  skills: string[]
  /** 用户明确说过的公司经历 */
  workHistory: Array<{
    company: string
    title?: string
    startDate?: string
    endDate?: string
    description?: string
  }>
  /** 用户明确说过的教育经历 */
  education: Array<{
    school: string
    degree?: string
    major?: string
    startYear?: string
    endYear?: string
  }>
  /** 完整度 */
  completionScore: number
  confidence: number
  /**
   * 数据质量状态
   * - valid: 可信数据（经 09E-02 Trust Filter 写入）
   * - legacy_unknown: 旧系统遗留，industry 等字段可能为 AI 推断
   * - review_required: 需要人工审查
   */
  dataQualityStatus: string
  /** 是否为 legacy 数据（潜在不可信） */
  isLegacy: boolean
}

/**
 * 🛡️ 从 CareerProfile 提取安全的简历数据
 *
 * 此函数只返回 Confirmed Facts。
 * Derived Insights 永远不会出现在返回值中。
 *
 * @param userId 用户 ID
 * @returns SafeResumeData（不含 AI 推断）
 */
export async function extractResumeSafeData(userId: string): Promise<SafeResumeData | null> {
  const profile = await prisma.careerProfile.findUnique({
    where: { userId },
    include: {
      skills: { include: { skill: true } },
      workExperiences: true,
      educations: true,
    },
  })

  if (!profile) return null

  // 🔒 只读取 CareerProfile 主表字段（Confirmed Facts）
  // 不从 headline/bio 解析 AI 推断标记（如 📋AI推断: 前缀）
  const headlineText = profile.headline || ''
  const safeHeadline = headlineText.includes('📋AI推断')
    ? headlineText.split('\n📋AI推断')[0]  // 截断推断标记
    : headlineText

  const bioText = profile.bio || ''
  const safeBio = bioText.includes('📋AI推断')
    ? bioText.split('\n📋AI推断')[0]
    : bioText

  // 🔒 Legacy 数据：不暴露可能为 AI 推断的字段
  const isLegacy = profile.dataQualityStatus === DataQualityStatus.LEGACY_UNKNOWN
  const safeIndustry = isLegacy ? undefined : (profile.industry || undefined)

  return {
    fullName: profile.fullName,
    headline: safeHeadline,
    bio: safeBio,
    city: profile.city || undefined,
    careerDirection: profile.careerDirection || undefined,
    industry: safeIndustry,
    yearsExperience: profile.yearsExperience,
    currentLevel: profile.currentLevel || undefined,
    email: profile.email || undefined,
    phone: profile.phone || undefined,
    skills: profile.skills.map(cs => cs.skill.name),
    workHistory: profile.workExperiences.map(we => ({
      company: we.company,
      title: we.title || undefined,
      startDate: we.startDate?.toISOString().slice(0, 10),
      endDate: we.endDate?.toISOString().slice(0, 10),
      description: we.description || undefined,
    })),
    education: profile.educations.map(ed => ({
      school: ed.school,
      degree: ed.degree || undefined,
      major: ed.major || undefined,
      startYear: ed.startYear?.toString(),
      endYear: ed.endYear?.toString(),
    })),
    completionScore: profile.completionScore,
    confidence: 95,
    dataQualityStatus: profile.dataQualityStatus,
    isLegacy,
  }
}
