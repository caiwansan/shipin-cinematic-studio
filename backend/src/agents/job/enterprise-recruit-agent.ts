/**
 * enterprise-recruit-agent.ts — 企业 AI 招聘代理
 *
 * Phase 2: 企业 AI 招聘部门
 * - AI 生成 JD
 * - 岗位优化建议
 * - 招聘需求分析
 * - 人才匹配
 */

// ─── 类型定义 ───

export interface JDGenerationInput {
  companyName: string
  position: string
  industry?: string
  scale?: string
  salaryRange?: string
  location?: string
  requirements?: string[]
  benefits?: string[]
}

export interface JDGenerationResult {
  title: string
  description: string
  requirements: string[]
  responsibilities: string[]
  salarySuggestion: string
  benefits: string[]
  qualityScore: number
  improvements: string[]
}

export interface JobOptimizationInput {
  title: string
  description: string
  requirements: string[]
  salary: string
  location: string
}

export interface JobOptimizationResult {
  qualityScore: number
  salaryCompetitiveness: {
    score: number
    marketAverage: string
    suggestion: string
  }
  requirementAnalysis: {
    tooMany: boolean
    missing: string[]
    suggestion: string
  }
  improvements: string[]
  optimizedJD: {
    title: string
    description: string
    requirements: string[]
  }
}

export interface CandidateMatchInput {
  jobId: string
  jobRequirements: string[]
  jobSkills: string[]
  jobSalary: string
  jobLocation: string
  candidates: {
    id: string
    name: string
    skills: string[]
    experience: string
    city: string
    salaryMin: number
    salaryMax: number
    education: string
  }[]
}

export interface CandidateMatchResult {
  candidateId: string
  name: string
  matchScore: number
  matchBreakdown: {
    skills: number
    experience: number
    city: number
    salary: number
    education: number
  }
  reasons: string[]
  risks: string[]
}

// ─── 薪资市场数据（Mock） ───

const SALARY_BENCHMARKS: Record<string, { low: number; mid: number; high: number }> = {
  'AI应用工程师': { low: 18, mid: 25, high: 35 },
  'Python开发工程师': { low: 12, mid: 18, high: 25 },
  '数据分析师': { low: 10, mid: 15, high: 22 },
  '机器学习工程师': { low: 20, mid: 30, high: 45 },
  'AI产品经理': { low: 18, mid: 25, high: 35 },
  '全栈开发工程师': { low: 14, mid: 20, high: 28 },
  'NLP算法工程师': { low: 18, mid: 28, high: 40 },
  '后端开发工程师': { low: 12, mid: 18, high: 25 },
  '前端开发工程师': { low: 10, mid: 16, high: 22 },
  '产品经理': { low: 15, mid: 22, high: 30 },
}

function getSalaryBenchmark(title: string): { low: number; mid: number; high: number } {
  for (const [key, value] of Object.entries(SALARY_BENCHMARKS)) {
    if (title.includes(key.replace('工程师', '').replace('开发', ''))) {
      return value
    }
  }
  return { low: 10, mid: 18, high: 28 }
}

function parseSalaryRange(salary: string): { min: number; max: number } {
  const match = salary.match(/(\d+)[-~](\d+)/)
  if (match) return { min: parseInt(match[1]), max: parseInt(match[2]) }
  const single = salary.match(/(\d+)/)
  if (single) return { min: parseInt(single[1]), max: parseInt(single[1]) + 5 }
  return { min: 0, max: 0 }
}

// ─── 企业招聘代理 ───

export class EnterpriseRecruitAgent {

  /**
   * AI 生成 JD
   */
  generateJD(input: JDGenerationInput): JDGenerationResult {
    const { companyName, position, industry, scale, salaryRange, location } = input

    // 生成岗位描述
    const description = this.buildDescription(input)

    // 生成岗位要求
    const requirements = this.buildRequirements(input)

    // 生成岗位职责
    const responsibilities = this.buildResponsibilities(input)

    // 薪资建议
    const benchmark = getSalaryBenchmark(position)
    const salarySuggestion = salaryRange || `${benchmark.low}-${benchmark.high}K`

    // 福利建议
    const benefits = input.benefits || [
      '五险一金', '带薪年假', '弹性工作',
      '餐补/交通补', '定期团建', '学习基金',
    ]

    // 质量评分
    const qualityScore = this.calculateJDQuality(input)

    // 改进建议
    const improvements = this.suggestJDImprovements(input)

    return {
      title: position,
      description,
      requirements,
      responsibilities,
      salarySuggestion,
      benefits,
      qualityScore,
      improvements,
    }
  }

  /**
   * 岗位优化建议
   */
  optimizeJob(input: JobOptimizationInput): JobOptimizationResult {
    const { title, description, requirements, salary, location } = input

    // 薪资竞争力分析
    const benchmark = getSalaryBenchmark(title)
    const salaryRange = parseSalaryRange(salary)
    const salaryMid = (salaryRange.min + salaryRange.max) / 2
    const salaryCompetitiveness = {
      score: salaryMid >= benchmark.mid ? 85 : Math.round((salaryMid / benchmark.mid) * 100),
      marketAverage: `${benchmark.low}-${benchmark.high}K`,
      suggestion: salaryMid < benchmark.mid
        ? `当前薪资低于市场平均，建议提高到 ${benchmark.low}-${benchmark.high}K`
        : '薪资具有市场竞争力',
    }

    // 要求分析
    const tooMany = requirements.length > 8
    const missing: string[] = []
    if (!requirements.some(r => r.toLowerCase().includes('学历'))) {
      missing.push('学历要求')
    }
    if (!requirements.some(r => r.toLowerCase().includes('经验'))) {
      missing.push('经验要求')
    }

    // 质量评分
    const qualityScore = Math.round(
      (salaryCompetitiveness.score * 0.3) +
      (tooMany ? 60 : 85) * 0.3 +
      (description.length > 100 ? 90 : 60) * 0.2 +
      (missing.length === 0 ? 90 : 60) * 0.2
    )

    // 改进建议
    const improvements: string[] = []
    if (salaryCompetitiveness.score < 80) {
      improvements.push(`薪资竞争力不足：${salaryCompetitiveness.suggestion}`)
    }
    if (tooMany) {
      improvements.push(`岗位要求过多（${requirements.length}项），建议精简到6-8项`)
    }
    if (missing.length > 0) {
      improvements.push(`缺少关键要求：${missing.join('、')}`)
    }
    if (description.length < 100) {
      improvements.push('岗位描述过短，建议补充工作内容和团队介绍')
    }

    return {
      qualityScore,
      salaryCompetitiveness,
      requirementAnalysis: {
        tooMany,
        missing,
        suggestion: tooMany ? '建议精简要求' : '要求数量合理',
      },
      improvements,
      optimizedJD: {
        title,
        description: description.length > 100 ? description : description + '\n\n我们期待你的加入！',
        requirements: tooMany ? requirements.slice(0, 8) : requirements,
      },
    }
  }

  /**
   * 人才匹配
   */
  matchCandidates(input: CandidateMatchInput): CandidateMatchResult[] {
    const { jobSkills, jobSalary, jobLocation, candidates } = input
    const salaryRange = parseSalaryRange(jobSalary)

    return candidates.map(candidate => {
      // 技能匹配
      const candidateSkills = candidate.skills.map(s => s.toLowerCase())
      const jobSkillList = jobSkills.map(s => s.toLowerCase())
      const matchedSkills = jobSkillList.filter(s =>
        candidateSkills.some(cs => cs.includes(s) || s.includes(cs))
      )
      const skillsScore = jobSkillList.length > 0
        ? Math.round((matchedSkills.length / jobSkillList.length) * 100)
        : 50

      // 经验匹配
      const expMatch = candidate.experience ? 80 : 40

      // 城市匹配
      const cityMatch = candidate.city === jobLocation || jobLocation === '不限' ? 100 : 30

      // 薪资匹配
      let salaryScore = 50
      if (candidate.salaryMin <= salaryRange.max && candidate.salaryMax >= salaryRange.min) {
        salaryScore = 100
      } else if (candidate.salaryMax < salaryRange.min) {
        salaryScore = 70
      } else {
        salaryScore = 40
      }

      // 学历匹配
      const eduScore = candidate.education && ['本科', '硕士', '博士'].includes(candidate.education) ? 90 : 60

      // 综合评分
      const matchScore = Math.round(
        skillsScore * 0.35 +
        expMatch * 0.2 +
        cityMatch * 0.2 +
        salaryScore * 0.15 +
        eduScore * 0.1
      )

      // 匹配原因
      const reasons: string[] = []
      if (skillsScore >= 70) reasons.push(`技能匹配度高（${matchedSkills.length}/${jobSkillList.length}）`)
      if (cityMatch === 100) reasons.push('目标城市匹配')
      if (salaryScore === 100) reasons.push('薪资期望匹配')
      if (expMatch >= 80) reasons.push('有相关经验')

      // 风险点
      const risks: string[] = []
      if (skillsScore < 50) risks.push('技能匹配度较低')
      if (cityMatch < 50) risks.push('城市不匹配')
      if (salaryScore < 50) risks.push('薪资期望超出预算')

      return {
        candidateId: candidate.id,
        name: candidate.name,
        matchScore,
        matchBreakdown: {
          skills: skillsScore,
          experience: expMatch,
          city: cityMatch,
          salary: salaryScore,
          education: eduScore,
        },
        reasons,
        risks,
      }
    }).sort((a, b) => b.matchScore - a.matchScore)
  }

  // ─── 私有辅助方法 ───

  private buildDescription(input: JDGenerationInput): string {
    const { companyName, position, industry, scale } = input
    return `${companyName}（${industry || '互联网'}行业${scale || ''}）正在寻找优秀的${position}加入我们的团队。\n\n在这里，你将参与核心产品的设计与开发，与一流的技术团队协作，解决有挑战性的问题。我们提供良好的技术氛围和成长空间。`
  }

  private buildRequirements(input: JDGenerationInput): string[] {
    const base = input.requirements || []
    const defaults = [
      '本科及以上学历，计算机相关专业',
      '良好的沟通能力和团队协作精神',
      '对技术有热情，学习能力强',
    ]
    return [...base, ...defaults].slice(0, 8)
  }

  private buildResponsibilities(input: JDGenerationInput): string[] {
    const position = input.position
    if (position.includes('AI') || position.includes('人工智能')) {
      return [
        '负责AI应用产品的设计与开发',
        '参与大模型应用落地和优化',
        '跟踪AI前沿技术，推动技术创新',
        '与产品、设计团队协作，交付高质量产品',
      ]
    }
    if (position.includes('数据')) {
      return [
        '负责业务数据的分析和挖掘',
        '构建数据指标体系，输出分析报告',
        '参与数据产品建设和优化',
        '与业务部门协作，提供数据支持',
      ]
    }
    return [
      '参与核心产品的设计与开发',
      '编写高质量、可维护的代码',
      '参与技术方案评审和优化',
      '持续改进系统性能和稳定性',
    ]
  }

  private calculateJDQuality(input: JDGenerationInput): number {
    let score = 70
    if (input.salaryRange) score += 10
    if (input.requirements && input.requirements.length >= 3) score += 10
    if (input.industry) score += 5
    if (input.scale) score += 5
    return Math.min(score, 100)
  }

  private suggestJDImprovements(input: JDGenerationInput): string[] {
    const improvements: string[] = []
    if (!input.salaryRange) improvements.push('建议添加薪资范围，提高吸引力')
    if (!input.requirements || input.requirements.length < 3) improvements.push('建议添加更详细的岗位要求')
    if (!input.industry) improvements.push('建议添加行业信息，帮助求职者了解')
    if (!input.benefits || input.benefits.length < 3) improvements.push('建议添加福利列表，提升竞争力')
    return improvements
  }
}
