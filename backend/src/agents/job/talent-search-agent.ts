/**
 * talent-search-agent.ts — AI人才猎聘 Agent
 *
 * Phase 2-P3: 企业 AI 招聘部门
 * - 人才画像引擎（整合简历+面试+职业档案）
 * - 主动人才推荐
 * - 人才关系管理
 * - AI人才雷达
 */

// ─── 类型定义 ───

export interface TalentSearchInput {
  workspaceId: string
  enterpriseId: string
  title: string
  description?: string
  skills?: string[]
  city?: string
  salaryMin?: number
  salaryMax?: number
  careerLevel?: string
  education?: string
  experienceYears?: number
  limit?: number
}

export interface TalentMatchResult {
  talentId: string
  name: string
  matchScore: number
  matchBreakdown: {
    skills: number
    experience: number
    city: number
    salary: number
    education: number
    level: number
  }
  recommendReason: string
  risks: string[]
  talent: {
    education: string
    skills: string[]
    experience: string
    city: string
    careerLevel: string
    strengths: string[]
  }
}

export interface TalentProfileInput {
  name: string
  email?: string
  phone?: string
  education?: string
  skills?: string[]
  experience?: string
  experienceYears?: number
  city?: string
  salaryMin?: number
  salaryMax?: number
  careerGoal?: string
  projects?: string
  sourceType: string
  sourceId?: string
}

export interface TalentRadarConfig {
  workspaceId: string
  enterpriseId: string
  name: string
  skills: string[]
  city?: string
  salaryMin?: number
  salaryMax?: number
  careerLevel?: string
  frequency: 'daily' | 'weekly' | 'biweekly'
  limit: number
}

// ─── 人才猎聘 Agent ───

export class TalentSearchAgent {

  /**
   * 搜索人才 — 核心匹配引擎
   */
  searchTalents(input: TalentSearchInput, candidates: any[]): TalentMatchResult[] {
    const {
      skills = [],
      city,
      salaryMin = 0,
      salaryMax = 999,
      careerLevel,
      education,
      experienceYears,
      limit = 10,
    } = input

    const results: TalentMatchResult[] = []

    for (const candidate of candidates) {
      const candidateSkills = (candidate.skills || []).map((s: string) => s.toLowerCase())
      const searchSkills = skills.map(s => s.toLowerCase())

      // 技能匹配
      const matchedSkills = searchSkills.filter(s =>
        candidateSkills.some((cs: string) => cs.includes(s) || s.includes(cs))
      )
      const skillsScore = searchSkills.length > 0
        ? Math.round((matchedSkills.length / searchSkills.length) * 100)
        : 50

      // 经验匹配
      const candidateExp = candidate.experienceYears || 0
      let expScore = 50
      if (experienceYears) {
        if (candidateExp >= experienceYears) expScore = 100
        else if (candidateExp >= experienceYears - 1) expScore = 80
        else if (candidateExp >= experienceYears - 2) expScore = 60
        else expScore = 30
      } else {
        expScore = candidateExp > 0 ? 80 : 40
      }

      // 城市匹配
      const cityScore = !city || city === '不限' || candidate.city === city ? 100 : 20

      // 薪资匹配
      let salaryScore = 50
      const cMin = candidate.salaryMin || 0
      const cMax = candidate.salaryMax || 999
      if (cMin <= salaryMax && cMax >= salaryMin) {
        salaryScore = 100
      } else if (cMax < salaryMin) {
        salaryScore = 70
      } else {
        salaryScore = 30
      }

      // 学历匹配
      const eduScore = this.matchEducation(education, candidate.education)

      // 级别匹配
      const levelScore = this.matchLevel(careerLevel, candidate.careerLevel)

      // 综合评分（加权）
      const matchScore = Math.round(
        skillsScore * 0.30 +
        expScore * 0.20 +
        cityScore * 0.15 +
        salaryScore * 0.15 +
        eduScore * 0.10 +
        levelScore * 0.10
      )

      // 推荐原因
      const reasons: string[] = []
      if (skillsScore >= 70) reasons.push(`核心技能匹配（${matchedSkills.length}/${searchSkills.length}）`)
      if (cityScore === 100 && city) reasons.push(`城市匹配（${city}）`)
      if (salaryScore === 100) reasons.push('薪资期望匹配')
      if (expScore >= 80) reasons.push(`经验丰富（${candidateExp}年）`)
      if (eduScore >= 90) reasons.push(`学历匹配（${candidate.education}）`)
      if (levelScore >= 80) reasons.push(`级别匹配（${candidate.careerLevel}）`)

      // 风险点
      const risks: string[] = []
      if (skillsScore < 50) risks.push('核心技能不足')
      if (cityScore < 50) risks.push(`城市不匹配（候选人：${candidate.city || '未知'}）`)
      if (salaryScore < 50) risks.push('薪资期望超出预算')
      if (expScore < 50) risks.push('经验不足')
      if (candidate.careerLevel === 'Lead' && careerLevel === 'Junior') risks.push('级别过高')

      results.push({
        talentId: candidate.id,
        name: candidate.name,
        matchScore,
        matchBreakdown: {
          skills: skillsScore,
          experience: expScore,
          city: cityScore,
          salary: salaryScore,
          education: eduScore,
          level: levelScore,
        },
        recommendReason: reasons.length > 0 ? reasons.join('；') : '综合匹配度一般',
        risks,
        talent: {
          education: candidate.education || '未知',
          skills: candidate.skills || [],
          experience: candidate.experience || '',
          city: candidate.city || '未知',
          careerLevel: candidate.careerLevel || '未知',
          strengths: candidate.strengths || [],
        },
      })
    }

    return results
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit)
  }

  /**
   * 生成人才画像 — 整合多源数据
   */
  buildTalentProfile(input: TalentProfileInput) {
    const careerLevel = this.inferCareerLevel(input.experienceYears || 0, input.skills || [])
    const strengths = this.inferStrengths(input)
    const risks = this.inferRisks(input)

    return {
      ...input,
      careerLevel,
      strengths,
      risks,
    }
  }

  /**
   * 生成推荐卡描述
   */
  generateRecommendCard(result: TalentMatchResult): string {
    const { name, matchScore, recommendReason, risks, talent } = result
    let card = `**${name}** 匹配度：${matchScore}%\n\n`
    card += `✅ ${recommendReason}\n`
    if (risks.length > 0) {
      card += `⚠️ 关注风险：${risks.join('、')}\n`
    }
    card += `\n🎯 ${talent.skills.slice(0, 3).join(' / ')} | ${talent.city} | ${talent.careerLevel}`
    return card
  }

  /**
   * 推断职业级别
   */
  private inferCareerLevel(years: number, skills: string[]): string {
    if (years >= 8) return 'Lead'
    if (years >= 5) return 'Senior'
    if (years >= 2) return 'Middle'
    return 'Junior'
  }

  /**
   * 推断优势
   */
  private inferStrengths(input: TalentProfileInput): string[] {
    const strengths: string[] = []
    if (input.skills && input.skills.length >= 3) strengths.push('技能组合丰富')
    if (input.experienceYears && input.experienceYears >= 3) strengths.push('有实战经验')
    if (input.education && ['硕士', '博士'].includes(input.education)) strengths.push('学历优秀')
    if (input.projects && input.projects.length > 50) strengths.push('有项目经验')
    return strengths
  }

  /**
   * 推断风险
   */
  private inferRisks(input: TalentProfileInput): string[] {
    const risks: string[] = []
    if (!input.skills || input.skills.length === 0) risks.push('技能信息缺失')
    if (!input.experience || input.experience.length < 10) risks.push('经验描述不足')
    if (!input.city) risks.push('城市信息缺失')
    return risks
  }

  /**
   * 学历匹配
   */
  private matchEducation(required: string | undefined, actual: string | undefined): number {
    if (!required) return 70
    if (!actual) return 30
    const levels = ['高中', '大专', '本科', '硕士', '博士']
    const reqIdx = levels.indexOf(required)
    const actIdx = levels.indexOf(actual)
    if (actIdx >= reqIdx) return 100
    if (actIdx === reqIdx - 1) return 70
    return 40
  }

  /**
   * 级别匹配
   */
  private matchLevel(required: string | undefined, actual: string | undefined): number {
    if (!required) return 70
    if (!actual) return 30
    const levels = ['Junior', 'Middle', 'Senior', 'Lead']
    const reqIdx = levels.indexOf(required)
    const actIdx = levels.indexOf(actual)
    if (actIdx === reqIdx) return 100
    if (actIdx > reqIdx) return 80
    if (actIdx === reqIdx - 1) return 60
    return 30
  }
}
