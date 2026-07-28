/**
 * candidate.repository.ts — Candidate (Identity) 数据访问层
 *
 * AR-01 Phase 3: Relationship Domain
 * DP-5: Repository 只负责数据访问，不负责业务组装。
 *
 * Sprint-SSOT-CLEANUP-01: 以 CareerProfile 作为 SSOT，不再依赖 JobCandidate。
 */

import { prisma } from '../../utils/index.js'

export interface CandidateQueryOptions {
  city?: string
  keyword?: string
  quality?: string  // high | medium | low
  status?: string
  sortBy?: string
  skip: number
  take: number
}

export interface CandidateStats {
  total: number
  withProfile: number
  withMatches: number
  avgExperienceYears: number | null
  topSkills: { skill: string; count: number }[]
}

export interface CandidateRow {
  id: string
  userId: string
  name: string | null
  email: string | null
  phone: string | null
  city: string | null
  experienceYears: number | null
  salaryMin: number | null
  salaryMax: number | null
  careerGoal: string | null
  skills: string[]
  education: string | null
  qualityScore: number | null
  status: string | null
  summary: string | null
  createdAt: Date
  updatedAt: Date
}

export const candidateRepository = {
  /**
   * 分页查询候选人列表（支持搜索、筛选、排序）
   * Sprint-SSOT-CLEANUP-01: 基于 CareerProfile，不再读 JobCandidate
   */
  async findMany(options: CandidateQueryOptions): Promise<{ rows: CandidateRow[], total: number }> {
    const where: Record<string, unknown> = {}
    if (options.city) where.city = options.city
    if (options.keyword) {
      where.OR = [
        { fullName: { contains: options.keyword, mode: 'insensitive' as any } },
        { bio: { contains: options.keyword, mode: 'insensitive' as any } },
        { headline: { contains: options.keyword, mode: 'insensitive' as any } },
      ]
    }

    const [candidates, total] = await Promise.all([
      prisma.careerProfile.findMany({
        where,
        skip: options.skip,
        take: options.take,
        orderBy: options.sortBy === 'experienceYears'
          ? { yearsExperience: 'desc' }
          : { lastActiveAt: 'desc' },
        select: {
          id: true,
          userId: true,
          fullName: true,
          email: true,
          phone: true,
          city: true,
          yearsExperience: true,
          headline: true,
          bio: true,
          careerDirection: true,
          completionScore: true,
          skills: {
            select: { name: true },
          },
          workExperiences: { take: 1, select: { title: true, company: true } },
          educations: { take: 1, select: { degree: true, field: true } },
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.careerProfile.count({ where }),
    ])

    const rows: CandidateRow[] = candidates.map(cp => ({
      id: cp.id,
      userId: cp.userId,
      name: cp.fullName,
      email: cp.email,
      phone: cp.phone,
      city: cp.city,
      experienceYears: cp.yearsExperience,
      salaryMin: null,
      salaryMax: null,
      careerGoal: cp.careerDirection ?? cp.bio,
      skills: cp.skills?.map(s => s.name) ?? [],
      education: cp.educations?.[0]?.degree ?? cp.educations?.[0]?.field ?? null,
      qualityScore: cp.completionScore,
      status: null,
      summary: cp.headline ?? cp.bio,
      createdAt: cp.createdAt,
      updatedAt: cp.updatedAt,
    }))

    // Memory filter for quality
    if (options.quality) {
      rows = rows.filter(r => {
        const s = r.qualityScore
        if (s == null) return false
        if (options.quality === 'high') return s >= 70
        if (options.quality === 'medium') return s >= 50 && s < 70
        return s < 50
      })
    }

    // Memory filter for keyword in name/skills
    if (options.keyword) {
      const kw = options.keyword.toLowerCase()
      rows = rows.filter(r =>
        r.name?.toLowerCase().includes(kw) ||
        r.skills.some(s => s.toLowerCase().includes(kw)) ||
        r.city?.toLowerCase().includes(kw)
      )
    }

    return { rows, total }
  },

  /**
   * 获取候选人详情
   * Sprint-SSOT-CLEANUP-01: 基于 CareerProfile，向下兼容返回结构
   */
  async findById(id: string) {
    const cp = await prisma.careerProfile.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        fullName: true,
        email: true,
        phone: true,
        city: true,
        yearsExperience: true,
        headline: true,
        bio: true,
        careerDirection: true,
        industry: true,
        currentLevel: true,
        jobSeekingStatus: true,
        openToOpportunity: true,
        visibility: true,
        completionScore: true,
        lastActiveAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!cp) return null

    // CareerProfile 关联数据
    const candidateSkills = await prisma.candidateSkill.findMany({
      where: { profileId: cp.id },
      include: { skill: { select: { id: true, name: true, category: true } } },
      orderBy: { confidence: 'desc' },
    })
    const workExperiences = await prisma.workExperience.findMany({
      where: { profileId: cp.id },
      orderBy: { startDate: 'desc' },
    })
    const educations = await prisma.education.findMany({
      where: { profileId: cp.id },
      orderBy: { startDate: 'desc' },
    })

    // 匹配记录统计
    const matchCount = await prisma.candidateMatch.count({
      where: { candidateId: cp.id },
    })
    const matches = await prisma.candidateMatch.findMany({
      where: { candidateId: cp.id },
      select: {
        id: true, matchScore: true, status: true,
        job: { select: { id: true, title: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return {
      id: cp.id,
      userId: cp.userId,
      name: cp.fullName,
      email: cp.email,
      phone: cp.phone,
      city: cp.city,
      experienceYears: cp.yearsExperience,
      salaryMin: null,
      salaryMax: null,
      careerGoal: cp.careerDirection ?? cp.bio,
      skills: candidateSkills.map(s => s.skill.name),
      education: educations?.[0]?.degree ?? educations?.[0]?.field ?? null,
      qualityScore: cp.completionScore,
      summary: cp.headline ?? cp.bio,
      completeness: cp.completionScore,
      createdAt: cp.createdAt,
      updatedAt: cp.updatedAt,
      talentProfile: null, // 不再关联废弃模型
      matchCount,
      matches,
      careerProfile: cp,
      candidateSkills,
      workExperiences,
      educations,
    }
  },

  /**
   * 候选人统计（运营面板）
   * Sprint-SSOT-CLEANUP-01: 基于 CareerProfile
   */
  async stats(): Promise<CandidateStats> {
    const total = await prisma.careerProfile.count()
    const withProfile = total // CareerProfile 本身就是画像
    // 统计有匹配记录的候选人数（去重）
    const matchedCandidates = await prisma.candidateMatch.findMany({
      where: { status: { not: 'rejected' } },
      select: { candidateId: true },
      distinct: ['candidateId'],
    })
    const withMatches = matchedCandidates.length

    // Top skills via CandidateSkill
    const allSkills = await prisma.candidateSkill.findMany({
      select: { name: true },
      where: { name: { not: null } },
    })
    const skillMap = new Map<string, number>()
    for (const row of allSkills) {
      if (!row.name) continue
      const k = row.name.toLowerCase().trim()
      skillMap.set(k, (skillMap.get(k) ?? 0) + 1)
    }
    const topSkills = [...skillMap.entries()]
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      total,
      withProfile,
      withMatches: Math.min(withMatches, total),
      avgExperienceYears: null,
      topSkills,
    }
  },
}
