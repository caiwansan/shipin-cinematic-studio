/**
 * job-career-engine.ts — AI 求职助手核心引擎
 *
 * 实现真正的职业访谈流程：
 * 1. 分步骤引导用户（不是一次性问答）
 * 2. 实时提取职业画像信息
 * 3. 动态生成下一步问题
 * 4. 访谈完成后生成推荐
 *
 * 访谈阶段（InterviewStage）：
 * - GREETING: 欢迎 + 收集姓名
 * - EDUCATION: 学历 + 专业
 * - SKILLS: 技能 + 经验
 * - EXPERIENCE: 工作经历细节
 * - LOCATION: 目标城市
 * - SALARY: 期望薪资
 * - GOAL: 职业目标
 * - COMPLETE: 访谈完成，生成画像 + 推荐
 */

export type InterviewStage =
  | 'GREETING'
  | 'EDUCATION'
  | 'SKILLS'
  | 'EXPERIENCE'
  | 'LOCATION'
  | 'SALARY'
  | 'GOAL'
  | 'COMPLETE'

export interface CareerInterviewState {
  currentStage: InterviewStage
  profile: Partial<CandidateProfile>
  messageCount: number
  lastUserMessage: string
  stageHistory: InterviewStage[]
}

export interface CandidateProfile {
  name: string
  education: string
  major: string
  skills: string[]
  experience: string
  experienceYears: number
  city: string
  salaryMin: number
  salaryMax: number
  careerGoal: string
  completeness: number  // 0-100
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  stage?: InterviewStage
}

export interface JobRecommendationDTO {
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
}

// ─── 访谈流程配置 ───

const STAGE_FLOW: InterviewStage[] = [
  'EDUCATION', 'SKILLS', 'EXPERIENCE', 'LOCATION', 'SALARY', 'GOAL', 'COMPLETE'
]

const STAGE_QUESTIONS: Record<InterviewStage, string[]> = {
  GREETING: [
    '你好！我是求职顾问 🧠\n\n我会通过几个问题了解你的情况，帮你发现最适合的职业机会。\n\n先告诉我，你希望我怎么称呼你？',
    '你好！欢迎来到昆仑镜求职工作台 💼\n\n我是你的求职顾问 🧠。一步步帮你梳理职业方向。\n\n先从基础开始——你叫什么名字？',
  ],
  EDUCATION: [
    '很高兴认识你，{name}！\n\n你的最高学历是什么？\n\nA 本科\nB 硕士\nC 大专\nD 高中/其他',
    '好的{name}，了解了。\n\n你毕业的院校和专业是什么？（例如：北京大学 计算机科学）',
  ],
  SKILLS: [
    '你掌握哪些技能？可以多选：\n\nA 数据分析\nB AI开发\nC Python编程\nD 自动化办公\nE 其他',
    '在{education}阶段，你主要学习了哪些技能？\n\n可以用一句话描述，例如：「Python编程、数据分析、机器学习」',
  ],
  EXPERIENCE: [
    '你有几年的工作经验？\n\nA 应届生\nB 1-2年\nC 3-5年\nD 5年以上',
    '能简要描述一下最近的工作经历吗？\n\n例如：「在XX公司做数据分析师，负责用户行为分析」',
  ],
  LOCATION: [
    '你希望在哪个城市工作？\n\nA 北京\nB 上海\nC 深圳\nD 广州\nE 杭州\nF 其他',
    '目标城市是哪里？也可以说「不限」或「远程优先」',
  ],
  SALARY: [
    '你的期望薪资范围是多少？\n\nA 8-12K\nB 12-18K\nC 18-25K\nD 25-35K\nE 35K以上',
    '期望月薪是多少？可以是一个范围，例如「15-20K」',
  ],
  GOAL: [
    '你未来3年的职业目标是什么？\n\nA 技术专家（深耕技术）\nB 技术管理（带团队）\nC 产品经理\nD 创业/自由职业',
    '你希望往哪个方向发展？可以简单描述，例如「成为AI应用工程师」',
  ],
  COMPLETE: [],
}

// ─── 信息提取函数 ───

function extractName(message: string): string {
  const namePatterns = [
    /(?:我叫|我是|称呼我|叫我)\s*([^\s,，。！!？?]+)/,
    /^([^\s,，。！!？?]{2,4})$/,
  ]
  for (const pattern of namePatterns) {
    const match = message.match(pattern)
    if (match) return match[1].trim()
  }
  // 不要 fallback 到原始消息
  return ''
}

function extractEducation(message: string): { education: string; major: string } {
  const eduMap: Record<string, string> = {
    '本科': '本科', '学士': '本科', 'bachelor': '本科',
    '硕士': '硕士', '研究生': '硕士', 'master': '硕士',
    '博士': '博士', 'phd': '博士', 'doctor': '博士',
    '大专': '大专', '专科': '大专', 'associate': '大专',
    '高中': '高中', '中专': '高中', 'high school': '高中',
  }

  let education = ''
  for (const [key, value] of Object.entries(eduMap)) {
    if (message.includes(key)) {
      education = value
      break
    }
  }

  // 提取专业
  const majorMatch = message.match(/(?:专业|主修|学习|学的?是)\s*([^\s,，。！!？?]+)/)
  const major = majorMatch ? majorMatch[1] : ''

  // 不要 fallback 到原始消息，避免污染数据
  return { education, major }
}

function extractSkills(message: string): string[] {
  const skillKeywords = [
    'python', 'java', 'javascript', 'typescript', 'go', 'rust', 'c++', 'c#',
    '数据分析', '机器学习', '深度学习', 'ai', '人工智能', '大模型', 'langchain',
    'sql', 'mysql', 'postgresql', 'mongodb', 'redis',
    'react', 'vue', 'angular', 'node', 'django', 'flask', 'spring',
    'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp',
    '自动化', '办公', 'excel', 'ppt', '项目管理',
    '产品经理', '产品', '运营', '市场', '销售', '人事', '财务',
  ]

  const lowerMsg = message.toLowerCase()
  const skills: string[] = []

  for (const skill of skillKeywords) {
    if (lowerMsg.includes(skill.toLowerCase())) {
      skills.push(skill)
    }
  }

  // 仅返回匹配到的关键词，不用原始消息分割（避免污染）
  return [...new Set(skills)]
}

function extractExperienceYears(message: string): number {
  if (message.includes('应届') || message.includes('无经验') || message.includes('没有经验')) return 0
  const yearMatch = message.match(/(\d+)\s*年/)
  if (yearMatch) return parseInt(yearMatch[1])
  if (message.includes('1-2年') || message.includes('一到两')) return 1.5
  if (message.includes('3-5年') || message.includes('三到五')) return 4
  if (message.includes('5年以上') || message.includes('超过5')) return 6
  return 0
}

function extractCity(message: string): string {
  const cities = ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '南京', '苏州', '西安', '长沙', '重庆', '天津', '青岛', '大连', '宁波', '厦门', '无锡', '佛山', '东莞']
  for (const city of cities) {
    if (message.includes(city)) return city
  }
  if (message.includes('不限') || message.includes('远程')) return '不限'
  // 不要 fallback 到原始消息
  return ''
}

function extractSalaryRange(message: string): { min: number; max: number } {
  // 匹配 "15-20K", "15K-20K", "15000-20000", "15-20k"
  const kMatch = message.match(/(\d+)[-~](\d+)\s*[kK]/)
  if (kMatch) return { min: parseInt(kMatch[1]), max: parseInt(kMatch[2]) }

  const numMatch = message.match(/(\d+)\s*[kK]/)
  if (numMatch) {
    const val = parseInt(numMatch[1])
    return { min: val, max: val + 5 }
  }

  // 匹配纯数字（假设是元/月）
  const yuanMatch = message.match(/(\d{4,5})[-~](\d{4,5})/)
  if (yuanMatch) return { min: Math.round(parseInt(yuanMatch[1]) / 1000), max: Math.round(parseInt(yuanMatch[2]) / 1000) }

  return { min: 0, max: 0 }
}

function extractCareerGoal(message: string): string {
  if (message.includes('技术专家') || message.includes('深耕技术')) return '技术专家'
  if (message.includes('管理') || message.includes('带团队')) return '技术管理'
  if (message.includes('产品经理') || message.includes('产品')) return '产品经理'
  if (message.includes('创业') || message.includes('自由职业')) return '创业/自由职业'
  if (message.includes('AI应用') || message.includes('AI开发') || message.includes('人工智能')) return 'AI应用工程师'
  if (message.includes('数据分析师') || message.includes('数据分析')) return '数据分析师'
  if (message.includes('Python') || message.includes('python')) return 'Python开发工程师'
  // 不要 fallback 到原始消息
  return ''
}

// ─── 画像完整度计算 ───

function calculateCompleteness(profile: Partial<CandidateProfile>): number {
  const fields = [
    { key: 'name', weight: 10 },
    { key: 'education', weight: 15 },
    { key: 'skills', weight: 20 },
    { key: 'experience', weight: 15 },
    { key: 'city', weight: 15 },
    { key: 'salaryMin', weight: 10 },
    { key: 'careerGoal', weight: 15 },
  ]

  let total = 0
  for (const { key, weight } of fields) {
    const val = profile[key as keyof CandidateProfile]
    if (val && (typeof val === 'string' ? val.length > 0 : Array.isArray(val) ? val.length > 0 : val > 0)) {
      total += weight
    }
  }

  return Math.min(total, 100)
}

// ─── 核心引擎 ───

export class JobCareerEngine {
  private state: CareerInterviewState

  constructor(existingProfile?: Partial<CandidateProfile>) {
    this.state = {
      currentStage: existingProfile && Object.keys(existingProfile).length > 0 ? 'SKILLS' : 'EDUCATION',
      profile: existingProfile || {},
      messageCount: 0,
      lastUserMessage: '',
      stageHistory: [],
    }
  }

  /**
   * 获取欢迎消息（首次进入）
   */
  getWelcomeMessage(): string {
    if (this.state.profile.name) {
      return `欢迎回来，${this.state.profile.name}！👋\n\n上次你的目标：${this.state.profile.careerGoal || '待定'}\n\n有什么新的进展想告诉我吗？`
    }
    return STAGE_QUESTIONS.GREETING[0]
  }

  /**
   * 处理用户消息，返回 Agent 回复
   */
  processMessage(message: string): {
    reply: string
    profile: CandidateProfile
    isComplete: boolean
    stage: InterviewStage
    careerAdvice?: {
      strengths: string[]
      suggestedDirection: string
      nextSteps: string
      potentialImprovement: string[]
    }
  } {
    this.state.lastUserMessage = message
    this.state.messageCount++

    // 根据当前阶段提取信息
    this.extractInfo(message)

    // 推进到下一阶段
    this.advanceStage()

    // 计算完整度
    this.state.profile.completeness = calculateCompleteness(this.state.profile)

    // 生成回复
    let reply: string
    let careerAdvice: any = undefined
    if (this.state.currentStage === 'COMPLETE') {
      reply = this.generateCompleteReply()
      careerAdvice = this.generateCareerAdvice()
    } else {
      reply = this.generateStageReply()
    }

    return {
      reply,
      profile: this.state.profile as CandidateProfile,
      isComplete: this.state.currentStage === 'COMPLETE',
      stage: this.state.currentStage,
      careerAdvice,
    }
  }

  private extractInfo(message: string): void {
    const stage = this.state.currentStage
    const profile = this.state.profile

    // 始终尝试提取所有可用信息（用户可能在任意轮次提供多项信息）
    const name = extractName(message)
    if (name && !profile.name) profile.name = name

    const edu = extractEducation(message)
    if (edu.education && !profile.education) {
      profile.education = edu.education
      profile.major = edu.major
    }

    const skills = extractSkills(message)
    if (skills.length > 0) {
      profile.skills = [...new Set([...(profile.skills || []), ...skills])]
    }

    const years = extractExperienceYears(message)
    if (years > 0 && !profile.experienceYears) {
      profile.experience = message.trim()
      profile.experienceYears = years
    }

    const city = extractCity(message)
    if (city && !profile.city) profile.city = city

    const salary = extractSalaryRange(message)
    if (salary.min > 0 && !profile.salaryMin) {
      profile.salaryMin = salary.min
      profile.salaryMax = salary.max
    }

    const goal = extractCareerGoal(message)
    if (goal && !profile.careerGoal) profile.careerGoal = goal

    // 当前阶段强制覆盖（允许用户更新已填写的信息）
    switch (stage) {
      case 'GREETING':
        if (name) profile.name = name
        break
      case 'EDUCATION':
        if (edu.education) { profile.education = edu.education; profile.major = edu.major }
        break
      case 'SKILLS':
        if (skills.length > 0) profile.skills = [...new Set([...(profile.skills || []), ...skills])]
        break
      case 'EXPERIENCE':
        profile.experience = message.trim()
        profile.experienceYears = years || profile.experienceYears
        break
      case 'LOCATION':
        if (city) profile.city = city
        break
      case 'SALARY':
        if (salary.min > 0) { profile.salaryMin = salary.min; profile.salaryMax = salary.max }
        break
      case 'GOAL':
        if (goal) profile.careerGoal = goal
        break
    }
  }

  private advanceStage(): void {
    const currentIndex = STAGE_FLOW.indexOf(this.state.currentStage)
    if (currentIndex < STAGE_FLOW.length - 1) {
      this.state.stageHistory.push(this.state.currentStage)
      this.state.currentStage = STAGE_FLOW[currentIndex + 1]
    }
  }

  private generateStageReply(): string {
    const stage = this.state.currentStage
    const questions = STAGE_QUESTIONS[stage]
    if (!questions || questions.length === 0) return ''

    let question = questions[Math.floor(Math.random() * questions.length)]

    // 替换模板变量
    question = question.replace(/{name}/g, this.state.profile.name || '朋友')
    question = question.replace(/{education}/g, this.state.profile.education || '你的专业')

    // 添加进度提示（阶段式文案，非百分比）
    const completeness = this.state.profile.completeness || 0
    if (completeness > 0) {
      let stageText = ''
      if (completeness < 30) {
        stageText = '正在了解你的基础信息'
      } else if (completeness < 60) {
        stageText = '正在建立你的能力画像'
      } else if (completeness < 90) {
        stageText = '正在分析你的职业方向'
      } else {
        stageText = '职业画像完成，正在匹配最佳岗位'
      }
      question += `\n\n📊 ${stageText}`
    }

    return question
  }

  private generateCompleteReply(): string {
    const p = this.state.profile
    const advice = this.generateCareerAdvice()
    return `🎉 职业画像完成！\n\n你的职业画像：\n👤 姓名：${p.name || '未知'}\n🎓 学历：${p.education || '未知'}\n💡 技能：${p.skills?.join('、') || '待补充'}\n📍 目标城市：${p.city || '待定'}\n💰 期望薪资：${p.salaryMin}-${p.salaryMax}K\n🎯 职业目标：${p.careerGoal || '待定'}\n\n📋 职业建议：\n💪 职业优势：${advice.strengths.join('、') || '待挖掘'}\n📈 建议方向：${advice.suggestedDirection}\n🎯 未来3个月：${advice.nextSteps}\n\n正在为你匹配最合适的岗位...`
  }

  /**
   * 生成职业建议（Phase 1.5 增强）
   */
  generateCareerAdvice(): {
    strengths: string[]
    suggestedDirection: string
    nextSteps: string
    potentialImprovement: string[]
  } {
    const p = this.state.profile
    const strengths: string[] = []
    const potentialImprovement: string[] = []

    // 分析职业优势
    if (p.skills && p.skills.length > 0) {
      strengths.push(...p.skills.slice(0, 3))
    }
    if (p.education && ['本科', '硕士', '博士'].includes(p.education)) {
      strengths.push(`${p.education}学历`)
    }
    if (p.experienceYears && p.experienceYears >= 2) {
      strengths.push(`${p.experienceYears}年工作经验`)
    }
    if (p.city) {
      strengths.push(`${p.city}地区`)
    }

    // 能力差距分析
    const allSkills = ['python', '数据分析', '机器学习', 'ai', '大模型', 'langchain', 'sql']
    const profileSkills = (p.skills || []).map(s => s.toLowerCase())
    for (const skill of allSkills) {
      if (!profileSkills.some(ps => ps.includes(skill))) {
        potentialImprovement.push(skill)
      }
    }

    // 建议方向
    let suggestedDirection = p.careerGoal || '继续深耕当前领域'
    if (p.skills?.some(s => ['python', 'ai', '机器学习', '大模型'].includes(s.toLowerCase()))) {
      suggestedDirection = 'AI应用开发方向'
    } else if (p.skills?.some(s => ['数据分析', 'sql', 'excel'].includes(s.toLowerCase()))) {
      suggestedDirection = '数据分析方向'
    } else if (p.skills?.some(s => ['javascript', 'react', 'vue'].includes(s.toLowerCase()))) {
      suggestedDirection = '前端/全栈开发方向'
    }

    // 未来3个月建议
    const nextSteps = potentialImprovement.length > 0
      ? `学习${potentialImprovement.slice(0, 2).join('、')}，提升岗位匹配度`
      : '继续深耕核心技能，积累项目经验'

    return {
      strengths: strengths.length > 0 ? strengths : ['有成长潜力'],
      suggestedDirection,
      nextSteps,
      potentialImprovement: potentialImprovement.slice(0, 3),
    }
  }

  /**
   * 获取当前画像
   */
  getProfile(): CandidateProfile {
    return this.state.profile as CandidateProfile
  }

  /**
   * 获取当前阶段
   */
  getStage(): InterviewStage {
    return this.state.currentStage
  }
}
