/**
 * candidate.repository.ts — Candidate (Identity) 数据访问层
 *
 * AR-01 Phase 3: Relationship Domain
 * DP-5: Repository 只负责数据访问，不负责业务组装。
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
   * P5-ADMIN-02: 关联 TalentProfile 补全数据，关联 CandidateMatch 统计匹配数
   */
  async findMany(options: CandidateQueryOptions): Promise<{ rows: CandidateRow[], total: number }> {
    const where: Record<string, unknown> = {}
    if (options.city) where.city = options.city
    if (options.keyword) {
      where.OR = [
        { careerGoal: { contains: options.keyword, mode: 'insensitive' as any } },
      ]
    }

    const [candidates, total] = await Promise.all([
      prisma.jobCandidate.findMany({
        where,
        skip: options.skip,
        take: options.take,
        orderBy: options.sortBy === 'experienceYears'
          ? { createdAt: 'desc' }
          : { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          education: true,
          skills: true,
          experience: true,
          city: true,
          salaryExpectation: true,
          careerGoal: true,
          profileJson: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.jobCandidate.count({ where }),
    ])

    let rows: CandidateRow[] = candidates.map(jc => {
      const pj = jc.profileJson != null && typeof jc.profileJson === 'object'
        ? jc.profileJson as Record<string, unknown>
        : null

      return {
        id: jc.id,
        userId: jc.userId,
        name: (pj?.name as string) ?? null,
        email: (pj?.email as string) ?? null,
        phone: (pj?.phone as string) ?? null,
        city: jc.city,
        experienceYears: (pj?.experienceYears as number) ?? null,
        salaryMin: (pj?.salaryMin as number) ?? null,
        salaryMax: (pj?.salaryMax as number) ?? null,
        careerGoal: jc.careerGoal,
        skills: jc.skills ?? [],
        education: jc.education,
        qualityScore: (pj?.qualityScore as number) ?? null,
        status: null, // JobCandidate 无 status 字段，由前端根据匹配状态展示
        summary: (pj?.summary as string) ?? null,
        createdAt: jc.createdAt,
        updatedAt: jc.updatedAt,
      }
    })

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
   * 获取候选人详情（含 TalentProfile + 匹配记录统计）
   * P5-ADMIN-02: 关联 talent_profile 和 candidate_match 表
   */
  async findById(id: string) {
    const jc = await prisma.jobCandidate.findUnique({
      where: { id },
      select: {
        id: true, userId: true, education: true, skills: true,
        experience: true, city: true, salaryExpectation: true,
        careerGoal: true, profileJson: true, createdAt: true, updatedAt: true,
      },
    })
    if (!jc) return null

    const pj = jc.profileJson != null && typeof jc.profileJson === 'object'
      ? jc.profileJson as Record<string, unknown>
      : null

    // 关联 TalentProfile（同 userId）
    const talentProfile = await prisma.talentProfile.findFirst({
      where: { sourceId: jc.id },
      select: {
        id: true, name: true, email: true, phone: true,
        experienceYears: true, salaryMin: true, salaryMax: true,
        careerLevel: true, strengths: true, risks: true,
        projects: true, matchCount: true, lastMatchedAt: true,
      },
    })

    // 匹配记录统计
    const matchCount = await prisma.candidateMatch.count({
      where: { candidateId: jc.id },
    })
    const matches = await prisma.candidateMatch.findMany({
      where: { candidateId: jc.id },
      select: {
        id: true, matchScore: true, status: true,
        job: { select: { id: true, title: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // P5-ADMIN-03: 关联 CareerProfile 链路（通过 userId）
    const careerProfile = await prisma.careerProfile.findFirst({
      where: { userId: jc.userId },
      select: {
        id: true, fullName: true, headline: true, bio: true, avatarUrl: true,
        email: true, phone: true,
        city: true, country: true, careerDirection: true, industry: true,
        yearsExperience: true, currentLevel: true, jobSeekingStatus: true,
        openToOpportunity: true, visibility: true, completionScore: true,
        lastActiveAt: true, createdAt: true,
      },
    })

    // P5-ADMIN-03: CareerProfile 关联数据
    let candidateSkills: any[] = []
    let workExperiences: any[] = []
    let educations: any[] = []
    if (careerProfile) {
      candidateSkills = await prisma.candidateSkill.findMany({
        where: { profileId: careerProfile.id },
        include: { skill: { select: { id: true, name: true, category: true } } },
        orderBy: { confidence: 'desc' },
      })
      workExperiences = await prisma.workExperience.findMany({
        where: { profileId: careerProfile.id },
        orderBy: { startDate: 'desc' },
      })
      educations = await prisma.education.findMany({
        where: { profileId: careerProfile.id },
        orderBy: { startDate: 'desc' },
      })
    }

    return {
      id: jc.id,
      userId: jc.userId,
      name: (pj?.name as string) ?? talentProfile?.name ?? careerProfile?.fullName ?? null,
      email: (pj?.email as string) ?? talentProfile?.email ?? careerProfile?.email ?? null,
      phone: (pj?.phone as string) ?? talentProfile?.phone ?? careerProfile?.phone ?? null,
      city: jc.city ?? careerProfile?.city ?? null,
      experienceYears: (pj?.experienceYears as number) ?? talentProfile?.experienceYears ?? careerProfile?.yearsExperience ?? null,
      salaryMin: (pj?.salaryMin as number) ?? talentProfile?.salaryMin ?? null,
      salaryMax: (pj?.salaryMax as number) ?? talentProfile?.salaryMax ?? null,
      careerGoal: jc.careerGoal ?? null,
      skills: jc.skills ?? [],
      education: jc.education ?? null,
      qualityScore: (pj?.qualityScore as number) ?? null,
      summary: (pj?.summary as string) ?? null,
      completeness: (pj?.completeness as number) ?? careerProfile?.completionScore ?? null,
      createdAt: jc.createdAt,
      updatedAt: jc.updatedAt,
      talentProfile,
      matchCount,
      matches,
      careerProfile,
      candidateSkills,
      workExperiences,
      educations,
    }
  },

  /**
   * 候选人统计（P5-ADMIN-02 运营面板）
   */
  async stats(): Promise<CandidateStats> {
    const total = await prisma.jobCandidate.count()
    const withProfile = await prisma.talentProfile.count()
    // 统计有匹配记录的候选人数（去重）
    const matchedCandidates = await prisma.candidateMatch.findMany({
      where: { status: { not: 'rejected' } },
      select: { candidateId: true },
      distinct: ['candidateId'],
    })
    const withMatches = matchedCandidates.length

    // Top skills
    const allSkills = await prisma.jobCandidate.findMany({
      select: { skills: true },
    })
    const skillMap = new Map<string, number>()
    for (const row of allSkills) {
      for (const s of row.skills ?? []) {
        const k = s.toLowerCase().trim()
        skillMap.set(k, (skillMap.get(k) ?? 0) + 1)
      }
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
