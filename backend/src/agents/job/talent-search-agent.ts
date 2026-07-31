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

import { matchSimpleCandidates } from '../../services/matching/simple-match.adapter.js'

export class TalentSearchAgent {

  /**
   * 搜索人才 — 统一匹配引擎
   * Sprint-RECRUITMENT-REALITY-02 Task 04:
   * 删除私有权重（0.30/0.20/0.15/0.15/0.10/0.10），统一走 TalentMatchingEngine（0.40/0.30/0.15/0.15）
   * 搜索条件（skills/city/experienceYears）作为引擎输入，分数与岗位匹配同源
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

    const results = matchSimpleCandidates(
      candidates.map(c => ({
        id: c.id,
        name: c.name,
        skills: c.skills || [],
        experience: c.experience || '',
        experienceYears: c.experienceYears || 0,
        city: c.city || '',
        education: c.education || '',
        careerGoal: c.careerGoal || '',
      })),
      {
        jobId: input.workspaceId,
        jobSkills: skills,
        experienceMin: experienceYears || 0,
        location: city || undefined,
      },
    )

    return results
      .slice(0, limit)
      .map(r => {
        const nameMap = new Map(candidates.map(c => [c.id, c.name]))
        const candidate = candidates.find(c => c.id === r.candidateId) || {}

        // 从证据生成可读推荐原因（确定性，LLM 不参与）
        const dimLabels: Record<string, string> = { skill: '核心技能', experience: '经验', education: '学历', career: '方向/城市' }
        const reasons: string[] = []
        const risks: string[] = []
        for (const [dim, label] of Object.entries(dimLabels)) {
          const score = r.breakdown[dim as keyof typeof r.breakdown] || 0
          if (score >= 80) reasons.push(`${label}匹配（${score}分）`)
          else if (score < 50) risks.push(`${label}不足（${score}分）`)
        }
        if (careerLevel && candidate.careerLevel === 'Lead' && careerLevel === 'Junior') risks.push('级别过高')
        if (reasons.length === 0) reasons.push('综合匹配度一般')

        // 薪资过滤提示（不参与评分，仅展示）
        const cMin = candidate.salaryMin || 0
        const cMax = candidate.salaryMax || 999
        if (cMax < salaryMin) risks.push('薪资期望超出预算')

        return {
          talentId: r.candidateId,
          name: nameMap.get(r.candidateId) || '求职者',
          matchScore: r.score,
          matchBreakdown: {
            skills: r.breakdown.skill,
            experience: r.breakdown.experience,
            city: r.breakdown.career,
            salary: r.breakdown.career,
            education: r.breakdown.education,
            level: r.breakdown.career,
          },
          recommendReason: reasons.join('；'),
          risks,
          talent: {
            education: candidate.education || '未知',
            skills: candidate.skills || [],
            experience: candidate.experience || '',
            city: candidate.city || '未知',
            careerLevel: candidate.careerLevel || '未知',
            strengths: candidate.strengths || [],
          },
        }
      })
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
