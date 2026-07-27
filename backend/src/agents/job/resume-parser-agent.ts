/**
 * resume-parser-agent.ts — AI 简历分析 Agent
 *
 * Phase 2-P1: 企业招聘筛选能力
 * - 简历解析（文本提取）
 * - 简历质量评分
 * - 岗位匹配增强
 * - 企业人才库
 */

// ─── 类型定义 ───

export interface ResumeParseInput {
  text: string  // 简历原始文本
  fileName?: string
}

export interface ResumeParseResult {
  name: string
  email: string
  phone: string
  education: string
  major: string
  skills: string[]
  experience: string
  experienceYears: number
  city: string
  salaryMin: number
  salaryMax: number
  careerGoal: string
  projects: string
}

export interface ResumeQualityResult {
  score: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
}

export interface ResumeMatchInput {
  resume: ResumeParseResult
  jobSkills: string[]
  jobSalary: string
  jobLocation: string
  jobRequirements: string[]
}

export interface ResumeMatchResult {
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

// ─── 简历解析器 ───

export class ResumeParserAgent {

  /**
   * 解析简历文本，提取结构化信息
   */
  parseResume(input: ResumeParseInput): ResumeParseResult {
    const text = input.text

    return {
      name: this.extractName(text),
      email: this.extractEmail(text),
      phone: this.extractPhone(text),
      education: this.extractEducation(text),
      major: this.extractMajor(text),
      skills: this.extractSkills(text),
      experience: this.extractExperience(text),
      experienceYears: this.extractExperienceYears(text),
      city: this.extractCity(text),
      salaryMin: this.extractSalary(text).min,
      salaryMax: this.extractSalary(text).max,
      careerGoal: this.extractCareerGoal(text),
      projects: this.extractProjects(text),
    }
  }

  /**
   * 简历质量评分
   */
  evaluateQuality(resume: ResumeParseResult): ResumeQualityResult {
    const strengths: string[] = []
    const weaknesses: string[] = []
    let score = 60  // 基础分

    // 技能丰富度
    if (resume.skills.length >= 5) {
      strengths.push(`技能丰富（${resume.skills.length}项技能）`)
      score += 10
    } else if (resume.skills.length >= 3) {
      strengths.push(`具备核心技能（${resume.skills.length}项）`)
      score += 5
    } else {
      weaknesses.push('技能描述较少')
      score -= 5
    }

    // 经验年限
    if (resume.experienceYears >= 3) {
      strengths.push(`${resume.experienceYears}年工作经验`)
      score += 10
    } else if (resume.experienceYears >= 1) {
      strengths.push(`${resume.experienceYears}年工作经验`)
      score += 5
    } else {
      weaknesses.push('工作经验较少')
    }

    // 学历
    if (resume.education && ['本科', '硕士', '博士'].includes(resume.education)) {
      strengths.push(`${resume.education}学历`)
      score += 5
    }

    // 项目经验
    if (resume.projects && resume.projects.length > 20) {
      strengths.push('有项目经验描述')
      score += 5
    } else {
      weaknesses.push('缺少项目经验描述')
    }

    // 联系方式
    if (resume.email && resume.phone) {
      strengths.push('联系方式完整')
      score += 3
    } else {
      weaknesses.push('联系方式不完整')
    }

    // 职业目标
    if (resume.careerGoal) {
      strengths.push('有明确的职业目标')
      score += 2
    }

    // 优化建议
    const suggestions: string[] = []
    if (resume.skills.length < 5) suggestions.push('建议补充更多技能描述')
    if (!resume.projects || resume.projects.length < 20) suggestions.push('建议增加项目经验描述，量化成果')
    if (!resume.careerGoal) suggestions.push('建议添加职业目标描述')
    if (!resume.email || !resume.phone) suggestions.push('建议补充完整的联系方式')
    if (resume.experience.length < 30) suggestions.push('建议详细描述工作经历，突出成果')

    return {
      score: Math.min(Math.max(score, 30), 100),
      strengths,
      weaknesses,
      suggestions,
    }
  }

  /**
   * 简历与岗位匹配
   */
  matchWithJob(input: ResumeMatchInput): ResumeMatchResult {
    const { resume, jobSkills, jobSalary, jobLocation, jobRequirements } = input

    // 技能匹配
    const resumeSkills = resume.skills.map(s => s.toLowerCase())
    const jobSkillList = jobSkills.map(s => s.toLowerCase())
    const matchedSkills = jobSkillList.filter(s =>
      resumeSkills.some(rs => rs.includes(s) || s.includes(rs))
    )
    const skillsScore = jobSkillList.length > 0
      ? Math.round((matchedSkills.length / jobSkillList.length) * 100)
      : 50

    // 经验匹配
    const expScore = resume.experienceYears >= 3 ? 80 : resume.experienceYears >= 1 ? 60 : 30

    // 城市匹配
    const cityScore = resume.city === jobLocation || jobLocation === '不限' ? 100 : 30

    // 薪资匹配
    const salaryRange = this.parseSalaryRange(jobSalary)
    let salaryScore = 50
    if (resume.salaryMin <= salaryRange.max && resume.salaryMax >= salaryRange.min) {
      salaryScore = 100
    } else if (resume.salaryMax < salaryRange.min) {
      salaryScore = 70
    } else {
      salaryScore = 40
    }

    // 学历匹配
    const eduScore = resume.education && ['本科', '硕士', '博士'].includes(resume.education) ? 90 : 60

    // 综合评分
    const matchScore = Math.round(
      skillsScore * 0.35 +
      expScore * 0.2 +
      cityScore * 0.2 +
      salaryScore * 0.15 +
      eduScore * 0.1
    )

    // 匹配原因
    const reasons: string[] = []
    if (skillsScore >= 70) reasons.push(`技能匹配度高（${matchedSkills.length}/${jobSkillList.length}）`)
    if (cityScore === 100) reasons.push('目标城市匹配')
    if (salaryScore === 100) reasons.push('薪资期望匹配')
    if (expScore >= 80) reasons.push('经验丰富')
    if (eduScore >= 90) reasons.push('学历符合要求')

    // 风险点
    const risks: string[] = []
    if (skillsScore < 50) risks.push('技能匹配度较低')
    if (cityScore < 50) risks.push('城市不匹配')
    if (salaryScore < 50) risks.push('薪资期望超出预算')
    if (expScore < 50) risks.push('经验不足')

    return {
      matchScore,
      matchBreakdown: {
        skills: skillsScore,
        experience: expScore,
        city: cityScore,
        salary: salaryScore,
        education: eduScore,
      },
      reasons,
      risks,
    }
  }

  // ─── 私有解析方法 ───

  private extractName(text: string): string {
    const patterns = [
      /(?:姓名|名字|Name)[：:\s]*([^\n,，。]+)/i,
      /^([^\n,，。]{2,4})(?=\s|联系方式|电话|邮箱|$)/,
    ]
    for (const p of patterns) {
      const match = text.match(p)
      if (match) return match[1].trim()
    }
    return ''
  }

  private extractEmail(text: string): string {
    const match = text.match(/[\w.-]+@[\w.-]+\.\w+/)
    return match ? match[0] : ''
  }

  private extractPhone(text: string): string {
    const match = text.match(/(?:\+?86)?1[3-9]\d{9}/)
    return match ? match[0] : ''
  }

  private extractEducation(text: string): string {
    const eduMap: [string, string][] = [
      ['博士', '博士'], ['硕士', '硕士'], ['研究生', '硕士'],
      ['本科', '本科'], ['学士', '本科'],
      ['大专', '大专'], ['专科', '大专'],
      ['高中', '高中'],
    ]
    for (const [key, value] of eduMap) {
      if (text.includes(key)) return value
    }
    return ''
  }

  private extractMajor(text: string): string {
    const match = text.match(/(?:专业|Major|主修)[：:\s]*([^\n,，。]+)/i)
    return match ? match[1].trim() : ''
  }

  private extractSkills(text: string): string[] {
    const skillKeywords = [
      'python', 'java', 'javascript', 'typescript', 'go', 'rust', 'c++', 'c#',
      '数据分析', '机器学习', '深度学习', 'ai', '人工智能', '大模型', 'langchain',
      'sql', 'mysql', 'postgresql', 'mongodb', 'redis',
      'react', 'vue', 'angular', 'node', 'django', 'flask', 'spring',
      'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp',
      '自动化', '办公', 'excel', 'ppt', '项目管理',
      '产品经理', '产品', '运营', '市场', '销售',
      'pytorch', 'tensorflow', 'nlp', 'prompt', 'agent',
    ]

    const lowerText = text.toLowerCase()
    const skills: string[] = []

    for (const skill of skillKeywords) {
      if (lowerText.includes(skill.toLowerCase())) {
        skills.push(skill)
      }
    }

    return [...new Set(skills)]
  }

  private extractExperience(text: string): string {
    const lines = text.split('\n')
    const expLines: string[] = []
    let inExp = false
    for (const line of lines) {
      if (line.match(/(?:工作经验|工作经历|Experience|实习)/)) {
        inExp = true
        continue
      }
      if (inExp && line.match(/(?:教育|项目|技能|自我)/)) {
        inExp = false
      }
      if (inExp && line.trim()) {
        expLines.push(line.trim())
      }
    }
    return expLines.join('\n').slice(0, 500)
  }

  private extractExperienceYears(text: string): number {
    if (text.includes('应届') || text.includes('无经验')) return 0
    const match = text.match(/(\d+)\s*(?:年|years?)\s*(?:工作|经验)/i)
    if (match) return parseInt(match[1])
    const yearMatch = text.match(/(\d+)\s*年\s*经验/)
    if (yearMatch) return parseInt(yearMatch[1])
    return 0
  }

  private extractCity(text: string): string {
    const cities = ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '南京', '苏州', '西安', '长沙', '重庆', '天津', '青岛', '大连', '宁波', '厦门', '无锡', '佛山', '东莞']
    for (const city of cities) {
      if (text.includes(city)) return city
    }
    if (text.includes('不限') || text.includes('远程')) return '不限'
    return ''
  }

  private extractSalary(text: string): { min: number; max: number } {
    const kMatch = text.match(/(\d+)[-~](\d+)\s*[kK]/)
    if (kMatch) return { min: parseInt(kMatch[1]), max: parseInt(kMatch[2]) }
    const numMatch = text.match(/(\d+)\s*[kK]/)
    if (numMatch) {
      const val = parseInt(numMatch[1])
      return { min: val, max: val + 5 }
    }
    return { min: 0, max: 0 }
  }

  private extractCareerGoal(text: string): string {
    const match = text.match(/(?:职业目标|求职意向|Career|期望职位)[：:\s]*([^\n]+)/i)
    return match ? match[1].trim() : ''
  }

  private extractProjects(text: string): string {
    const lines = text.split('\n')
    const projLines: string[] = []
    let inProj = false
    for (const line of lines) {
      if (line.match(/(?:项目经验|项目经历|Projects)/)) {
        inProj = true
        continue
      }
      if (inProj && line.match(/(?:技能|自我|获奖|证书)/)) {
        inProj = false
      }
      if (inProj && line.trim()) {
        projLines.push(line.trim())
      }
    }
    return projLines.join('\n').slice(0, 500)
  }

  private parseSalaryRange(salary: string): { min: number; max: number } {
    const match = salary.match(/(\d+)[-~](\d+)/)
    if (match) return { min: parseInt(match[1]), max: parseInt(match[2]) }
    const single = salary.match(/(\d+)/)
    if (single) return { min: parseInt(single[1]), max: parseInt(single[1]) + 5 }
    return { min: 0, max: 0 }
  }
}
