/**
 * job-matching.service.ts — 岗位匹配算法服务
 *
 * 匹配公式：
 * 岗位匹配度 = 技能匹配 40% + 经验匹配 25% + 城市匹配 15% + 薪资匹配 15% + 企业质量 5%
 *
 * Phase 1: 规则评分（不使用复杂ML模型）
 * Phase 2: 升级为 AI 评分
 */

import { CandidateProfile } from './job-career-engine'

export interface JobPostingDTO {
  id: string
  title: string
  company: string
  salary: string
  location: string
  description: string
  requirements: string
  qualityScore: number
  // Phase 1.6: 知识库增强
  tags?: string[]
  skillRequirements?: string[]
  industry?: string
  careerPath?: string
  promotionPath?: string
  relatedSkills?: string[]
}

export interface MatchResult {
  jobId: string
  title: string
  company: string
  salary: string
  location: string
  matchScore: number
  matchBreakdown: {
    skills: number
    experience: number
    city: number
    salary: number
    company: number
  }
  reasons: string[]
  risks: string[]
  companyRating: number
  // Phase 1.5: 推荐解释增强
  recommendReason: string       // 一句话推荐原因
  strengthMatch: string[]       // 优势匹配点
  skillGap: string[]            // 能力差距
  growthAdvice: string          // 成长建议
}

// ─── 薪资解析 ───

function parseSalary(salaryStr: string): { min: number; max: number } {
  if (!salaryStr) return { min: 0, max: 0 }

  // 匹配 "15-20K", "15K-20K", "15000-20000"
  const kMatch = salaryStr.match(/(\d+)[-~](\d+)\s*[kK]/)
  if (kMatch) return { min: parseInt(kMatch[1]), max: parseInt(kMatch[2]) }

  const singleK = salaryStr.match(/(\d+)\s*[kK]/)
  if (singleK) {
    const val = parseInt(singleK[1])
    return { min: val, max: val + 5 }
  }

  // 匹配纯数字
  const numMatch = salaryStr.match(/(\d{4,5})[-~](\d{4,5})/)
  if (numMatch) return { min: Math.round(parseInt(numMatch[1]) / 1000), max: Math.round(parseInt(numMatch[2]) / 1000) }

  return { min: 0, max: 0 }
}

// ─── 技能匹配（40%）───

function calculateSkillsMatch(profileSkills: string[], jobRequirements: string): number {
  if (!profileSkills || profileSkills.length === 0) return 0
  if (!jobRequirements) return 50 // 无要求时给中等分数

  const reqLower = jobRequirements.toLowerCase()
  let matchCount = 0
  const matchedSkills: string[] = []

  for (const skill of profileSkills) {
    if (reqLower.includes(skill.toLowerCase())) {
      matchCount++
      matchedSkills.push(skill)
    }
  }

  // 计算匹配率
  const matchRate = matchCount / profileSkills.length

  // 额外加分：匹配到核心技能
  const coreSkills = ['python', 'ai', '机器学习', '深度学习', '大模型', 'langchain', '数据分析']
  let coreBonus = 0
  for (const core of coreSkills) {
    if (reqLower.includes(core) && profileSkills.some(s => s.toLowerCase().includes(core))) {
      coreBonus += 5
    }
  }

  return Math.min(Math.round(matchRate * 80 + coreBonus), 100)
}

// ─── 经验匹配（25%）───

function calculateExperienceMatch(experienceYears: number, jobRequirements: string): number {
  if (!jobRequirements) return 60

  const reqLower = jobRequirements.toLowerCase()

  // 解析岗位要求经验
  let requiredYears = 0
  const yearMatch = jobRequirements.match(/(\d+)[-~](\d+)\s*年/)
  if (yearMatch) {
    requiredYears = parseInt(yearMatch[1])
  } else {
    const singleYear = jobRequirements.match(/(\d+)\s*年/)
    if (singleYear) requiredYears = parseInt(singleYear[1])
  }

  if (requiredYears === 0) return 70 // 无明确要求

  if (experienceYears >= requiredYears) {
    return Math.min(70 + (experienceYears - requiredYears) * 5, 100)
  } else {
    // 经验不足
    const gap = requiredYears - experienceYears
    return Math.max(100 - gap * 20, 20)
  }
}

// ─── 城市匹配（15%）───

function calculateCityMatch(profileCity: string, jobLocation: string): number {
  if (!profileCity || profileCity === '不限') return 80
  if (!jobLocation) return 50

  // 精确匹配
  if (jobLocation.includes(profileCity) || profileCity.includes(jobLocation)) return 100

  // 同省/区域匹配
  const regionMap: Record<string, string[]> = {
    '北京': ['北京', '天津', '河北'],
    '上海': ['上海', '江苏', '浙江'],
    '深圳': ['深圳', '广州', '广东', '东莞', '佛山'],
    '广州': ['广州', '深圳', '广东', '东莞'],
    '杭州': ['杭州', '浙江', '上海', '江苏'],
  }

  const profileRegion = regionMap[profileCity] || [profileCity]
  for (const city of profileRegion) {
    if (jobLocation.includes(city)) return 70
  }

  return 30
}

// ─── 薪资匹配（15%）───

function calculateSalaryMatch(profileMin: number, profileMax: number, jobSalary: string): number {
  if (!jobSalary || profileMin === 0) return 60

  const job = parseSalary(jobSalary)
  if (job.min === 0 && job.max === 0) return 50

  // 计算重叠度
  const overlapMin = Math.max(profileMin, job.min)
  const overlapMax = Math.min(profileMax, job.max)

  if (overlapMax >= overlapMin) {
    // 有重叠
    const overlapSize = overlapMax - overlapMin
    const profileSize = profileMax - profileMin || 1
    const overlapRate = overlapSize / profileSize
    return Math.min(Math.round(60 + overlapRate * 40), 100)
  } else {
    // 无重叠，计算距离
    const gap = overlapMin - overlapMax
    return Math.max(100 - gap * 10, 20)
  }
}

// ─── 企业质量（5%）───

function calculateCompanyMatch(qualityScore: number): number {
  return Math.min(qualityScore || 50, 100)
}

// ─── 技能关键词库（用于 Gap Analysis）───

const SKILL_KEYWORDS: Record<string, string[]> = {
  'AI应用工程师': ['python', 'langchain', '大模型', 'ai', '机器学习', 'prompt', 'agent'],
  'Python开发工程师': ['python', 'django', 'flask', 'sql', 'redis', 'docker'],
  '数据分析师': ['python', 'sql', '数据分析', 'excel', '可视化', '统计'],
  '机器学习工程师': ['python', '机器学习', '深度学习', 'pytorch', 'tensorflow', '算法'],
  'AI产品经理': ['产品', 'ai', '数据分析', '需求分析', '用户研究'],
  '全栈开发工程师': ['python', 'javascript', 'react', 'vue', 'node', 'sql'],
  'NLP算法工程师': ['python', 'nlp', '深度学习', 'pytorch', '大模型', '文本分析'],
  '后端开发工程师': ['java', 'python', 'spring', 'mysql', 'redis', '微服务'],
}

// ─── 推荐理由生成 ───

function generateReasons(breakdown: MatchResult['matchBreakdown'], profile: CandidateProfile, job: JobPostingDTO): string[] {
  const reasons: string[] = []

  if (breakdown.skills >= 70) {
    reasons.push('技能高度匹配')
  } else if (breakdown.skills >= 50) {
    reasons.push('技能部分匹配')
  }

  if (breakdown.experience >= 70) {
    reasons.push('经验符合要求')
  }

  if (breakdown.city >= 80) {
    reasons.push(`${profile.city}地区匹配`)
  }

  if (breakdown.salary >= 70) {
    reasons.push('薪资符合期望')
  } else if (breakdown.salary >= 50) {
    reasons.push('薪资接近期望')
  }

  if (breakdown.company >= 70) {
    reasons.push('企业评分优秀')
  }

  return reasons.length > 0 ? reasons : ['综合匹配度良好']
}

// ─── 风险提示生成 ───

function generateRisks(breakdown: MatchResult['matchBreakdown'], profile: CandidateProfile, job: JobPostingDTO): string[] {
  const risks: string[] = []

  if (breakdown.skills < 50) {
    risks.push('需补充相关技能')
  }

  if (breakdown.experience < 50) {
    risks.push('经验略有差距')
  }

  if (breakdown.city < 50) {
    risks.push('城市不完全匹配')
  }

  if (breakdown.salary < 50) {
    risks.push('薪资可能有差距')
  }

  return risks
}

// ─── 推荐原因生成（Phase 1.5 增强）───

function generateRecommendReason(breakdown: MatchResult['matchBreakdown'], profile: CandidateProfile, job: JobPostingDTO): string {
  const points: string[] = []

  if (breakdown.skills >= 70) points.push('技能高度匹配')
  else if (breakdown.skills >= 50) points.push('技能部分匹配')

  if (breakdown.city >= 80) points.push(`${profile.city}地区匹配`)
  if (breakdown.experience >= 70) points.push('经验符合要求')
  if (breakdown.salary >= 70) points.push('薪资符合期望')

  if (points.length > 0) {
    return `${points.join('，')}，综合匹配度${Math.round(breakdown.skills * 0.4 + breakdown.experience * 0.25 + breakdown.city * 0.15 + breakdown.salary * 0.15 + breakdown.company * 0.05)}%`
  }
  return '综合匹配度良好，建议了解'
}

// ─── 优势匹配点生成 ───

function generateStrengthMatch(breakdown: MatchResult['matchBreakdown'], profile: CandidateProfile, job: JobPostingDTO): string[] {
  const strengths: string[] = []

  if (breakdown.skills >= 60) {
    const matchedSkills = (profile.skills || []).filter(s =>
      (job.requirements || job.description || '').toLowerCase().includes(s.toLowerCase())
    )
    if (matchedSkills.length > 0) {
      strengths.push(`${matchedSkills.slice(0, 3).join('、')}技能匹配`)
    } else {
      strengths.push('技能基础扎实')
    }
  }

  if (breakdown.experience >= 60) strengths.push('工作经验符合')
  if (breakdown.city >= 80) strengths.push(`${profile.city}地区匹配`)
  if (breakdown.salary >= 60) strengths.push('薪资期望合理')
  if (breakdown.company >= 70) strengths.push('企业发展前景好')

  return strengths.length > 0 ? strengths : ['有成长潜力']
}

// ─── 能力差距分析 ───

function generateSkillGap(profile: CandidateProfile, job: JobPostingDTO): string[] {
  const gaps: string[] = []
  const jobText = ((job.requirements || '') + ' ' + (job.description || '')).toLowerCase()
  const profileSkills = (profile.skills || []).map(s => s.toLowerCase())

  // 获取该岗位的核心技能要求
  const requiredSkills = SKILL_KEYWORDS[job.title] || []

  for (const skill of requiredSkills) {
    if (!profileSkills.some(ps => ps.includes(skill) || skill.includes(ps))) {
      gaps.push(skill)
    }
  }

  // 去重并限制数量
  return [...new Set(gaps)].slice(0, 3)
}

// ─── 成长建议生成 ───

function generateGrowthAdvice(breakdown: MatchResult['matchBreakdown'], profile: CandidateProfile, job: JobPostingDTO, gaps: string[]): string {
  if (gaps.length > 0) {
    return `建议学习${gaps.slice(0, 2).join('、')}，提升岗位匹配度`
  }
  if (breakdown.skills < 60) {
    return '建议深化核心技能，提升竞争力'
  }
  if (breakdown.experience < 60) {
    return '建议积累项目经验，增强实战能力'
  }
  return '匹配度良好，建议持续学习保持竞争力'
}

// ─── 主匹配函数 ───

export function matchJobs(profile: CandidateProfile, jobs: JobPostingDTO[]): MatchResult[] {
  const results: MatchResult[] = []

  for (const job of jobs) {
    const breakdown = {
      skills: calculateSkillsMatch(profile.skills || [], job.requirements || job.description || ''),
      experience: calculateExperienceMatch(profile.experienceYears || 0, job.requirements || ''),
      city: calculateCityMatch(profile.city || '', job.location || ''),
      salary: calculateSalaryMatch(profile.salaryMin || 0, profile.salaryMax || 0, job.salary || ''),
      company: calculateCompanyMatch(job.qualityScore || 0),
    }

    // 加权总分
    const matchScore = Math.round(
      breakdown.skills * 0.40 +
      breakdown.experience * 0.25 +
      breakdown.city * 0.15 +
      breakdown.salary * 0.15 +
      breakdown.company * 0.05
    )

    const skillGaps = generateSkillGap(profile, job)

    results.push({
      jobId: job.id,
      title: job.title,
      company: job.company,
      salary: job.salary,
      location: job.location,
      matchScore,
      matchBreakdown: breakdown,
      reasons: generateReasons(breakdown, profile, job),
      risks: generateRisks(breakdown, profile, job),
      companyRating: Math.round((job.qualityScore || 50) / 20), // 1-5星
      // Phase 1.5: 推荐解释增强
      recommendReason: generateRecommendReason(breakdown, profile, job),
      strengthMatch: generateStrengthMatch(breakdown, profile, job),
      skillGap: skillGaps,
      growthAdvice: generateGrowthAdvice(breakdown, profile, job, skillGaps),
    })
  }

  // 按匹配度降序排列
  results.sort((a, b) => b.matchScore - a.matchScore)

  // 返回 TOP 5
  return results.slice(0, 5)
}

// ─── 生成模拟岗位数据（Phase 1 测试用）───

export function generateMockJobs(): JobPostingDTO[] {
  return [
    {
      id: 'mock-001',
      title: 'AI应用工程师',
      company: '字节跳动',
      salary: '18-25K',
      location: '深圳',
      description: '负责AI应用产品开发，使用Python和LangChain构建智能应用',
      requirements: '本科及以上，Python开发经验，熟悉AI/机器学习，有大模型应用经验优先',
      qualityScore: 92,
      // Phase 1.6: 知识库增强
      tags: ['AI', '大模型', 'Python', '深圳', '高薪'],
      skillRequirements: ['python', 'langchain', '大模型', 'ai', '机器学习', 'prompt'],
      industry: '互联网/AI',
      careerPath: 'AI应用工程师 → 高级AI工程师 → AI技术专家',
      promotionPath: 'P5 → P6 → P7 → P8',
      relatedSkills: ['python', 'langchain', '大模型', 'prompt', 'agent', '机器学习'],
    },
    {
      id: 'mock-002',
      title: 'Python开发工程师',
      company: '腾讯',
      salary: '15-22K',
      location: '深圳',
      description: '后端服务开发，数据处理，API设计',
      requirements: '本科，Python，Django/Flask，SQL，2年以上经验',
      qualityScore: 90,
      tags: ['Python', '后端', '深圳', '稳定'],
      skillRequirements: ['python', 'django', 'flask', 'sql', 'redis', 'docker'],
      industry: '互联网',
      careerPath: 'Python开发 → 高级开发 → 技术专家/架构师',
      promotionPath: 'T1 → T2 → T3 → T4',
      relatedSkills: ['python', 'django', 'flask', 'sql', 'docker', 'kubernetes'],
    },
    {
      id: 'mock-003',
      title: '数据分析师',
      company: '阿里巴巴',
      salary: '12-18K',
      location: '杭州',
      description: '业务数据分析，用户行为分析，数据可视化',
      requirements: '本科，Python，SQL，Excel，数据分析经验',
      qualityScore: 88,
      tags: ['数据分析', '杭州', '电商', '稳定'],
      skillRequirements: ['python', 'sql', 'excel', '数据分析', '可视化', '统计'],
      industry: '电商/互联网',
      careerPath: '数据分析师 → 高级分析师 → 数据科学专家',
      promotionPath: 'P5 → P6 → P7',
      relatedSkills: ['python', 'sql', 'excel', 'tableau', '统计', '机器学习'],
    },
    {
      id: 'mock-004',
      title: '机器学习工程师',
      company: '华为',
      salary: '20-35K',
      location: '深圳',
      description: 'ML模型开发，算法优化，AI产品设计',
      requirements: '硕士及以上，Python，机器学习，深度学习，3年以上经验',
      qualityScore: 94,
      tags: ['AI', '机器学习', '深圳', '高薪', '技术密集'],
      skillRequirements: ['python', '机器学习', '深度学习', 'pytorch', 'tensorflow', '算法'],
      industry: '通信/AI',
      careerPath: 'ML工程师 → 高级ML工程师 → AI研究员',
      promotionPath: '13级 → 14级 → 15级 → 16级',
      relatedSkills: ['python', '机器学习', '深度学习', 'pytorch', 'tensorflow', '数学'],
    },
    {
      id: 'mock-005',
      title: 'AI产品经理',
      company: '美团',
      salary: '18-28K',
      location: '北京',
      description: 'AI产品规划，需求分析，产品设计',
      requirements: '本科，产品经验，AI背景，数据分析能力',
      qualityScore: 85,
      tags: ['AI', '产品经理', '北京', '高薪'],
      skillRequirements: ['产品', 'ai', '数据分析', '需求分析', '用户研究'],
      industry: '本地生活/AI',
      careerPath: 'AI产品经理 → 高级PM → 产品总监',
      promotionPath: 'P6 → P7 → P8',
      relatedSkills: ['产品', 'ai', '数据分析', '用户研究', '原型设计'],
    },
    {
      id: 'mock-006',
      title: '全栈开发工程师',
      company: '小红书',
      salary: '15-20K',
      location: '上海',
      description: '前后端开发，产品迭代',
      requirements: '本科，Python，JavaScript，React/Vue，2年经验',
      qualityScore: 82,
      tags: ['全栈', '上海', '年轻团队'],
      skillRequirements: ['python', 'javascript', 'react', 'vue', 'node', 'sql'],
      industry: '社交/互联网',
      careerPath: '全栈开发 → 高级全栈 → 技术负责人',
      promotionPath: 'P5 → P6 → P7',
      relatedSkills: ['python', 'javascript', 'react', 'vue', 'node', 'docker'],
    },
    {
      id: 'mock-007',
      title: 'NLP算法工程师',
      company: '科大讯飞',
      salary: '16-25K',
      location: '合肥',
      description: '自然语言处理，文本分析，对话系统',
      requirements: '硕士，Python，NLP，深度学习，PyTorch',
      qualityScore: 86,
      tags: ['AI', 'NLP', '合肥', '技术密集'],
      skillRequirements: ['python', 'nlp', '深度学习', 'pytorch', '大模型', '文本分析'],
      industry: 'AI/语音',
      careerPath: 'NLP工程师 → 高级NLP → AI专家',
      promotionPath: 'P5 → P6 → P7 → P8',
      relatedSkills: ['python', 'nlp', '深度学习', 'pytorch', '大模型', 'transformer'],
    },
    {
      id: 'mock-008',
      title: '后端开发工程师',
      company: '京东',
      salary: '14-20K',
      location: '北京',
      description: '电商后端服务，微服务架构',
      requirements: '本科，Java/Python，Spring，MySQL，2年经验',
      qualityScore: 84,
      tags: ['后端', '北京', '电商', '稳定'],
      skillRequirements: ['java', 'python', 'spring', 'mysql', 'redis', '微服务'],
      industry: '电商/互联网',
      careerPath: '后端开发 → 高级开发 → 架构师',
      promotionPath: 'T1 → T2 → T3 → T4',
      relatedSkills: ['java', 'python', 'spring', 'mysql', 'redis', 'docker'],
    },
  ]
}
