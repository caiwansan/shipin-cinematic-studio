/**
 * interview-agent.ts — AI 面试助手 Agent
 *
 * Phase 2-P2: 企业招聘面试能力
 * - 面试方案生成
 * - 面试评价报告
 * - 招聘流程增强
 */

// ─── 类型定义 ───

export interface JobContext {
  title: string
  skills: string[]
  salary: string
  location: string
  requirements: string[]
  level: string  // junior/mid/senior/lead
}

export interface ResumeContext {
  name: string
  skills: string[]
  experienceYears: number
  education: string
  city: string
  careerGoal: string
  projects: string
}

export interface InterviewQuestionSet {
  category: 'technical' | 'project' | 'behavioral' | 'deep'
  question: string
  expectedAnswer: string
  followUp?: string
}

export interface InterviewPlan {
  title: string
  totalQuestions: number
  estimatedDuration: number  // 分钟
  questions: InterviewQuestionSet[]
  focusAreas: string[]
  riskAreas: string[]
}

export interface InterviewEvaluationInput {
  jobTitle: string
  questions: {
    category: string
    question: string
    score: number
    answer?: string
  }[]
  resumeStrengths: string[]
  resumeRisks: string[]
}

export interface InterviewEvaluationResult {
  overallScore: number
  technicalScore: number
  communicationScore: number
  cultureScore: number
  strengths: string[]
  risks: string[]
  recommendation: string
  summary: string
  nextSteps: string[]
}

// ─── 面试题库模板 ───

const TECHNICAL_TEMPLATES: Record<string, string[]> = {
  python: [
    '请解释 Python 的 GIL 是什么，以及对多线程程序的影响。',
    '你如何管理 Python 项目的依赖和虚拟环境？',
    '请描述你使用过的 Python 异步编程方式（asyncio）。',
    'Python 中装饰器的原理是什么？请举一个你实际使用的例子。',
  ],
  ai: [
    '请解释 Transformer 模型的核心机制。',
    '你在实际项目中如何选择合适的模型架构？',
    '请描述你对 RAG（检索增强生成）的理解和实践经验。',
    '如何评估一个大模型生成结果的质量？',
  ],
  langchain: [
    '请介绍 LangChain 中 Agent 和 Chain 的区别。',
    '你如何设计一个 Agent 的记忆系统？',
    'LangChain 中 Tools 是如何工作的？请举一个自定义 Tool 的例子。',
    '你在 LangChain 项目中遇到过哪些常见坑？',
  ],
  'machine-learning': [
    '请解释过拟合和欠拟合，以及你如何解决。',
    '你在项目中如何进行特征工程？',
    '请描述你对模型评估和选择的经验。',
    '你如何处理数据不平衡问题？',
  ],
  web: [
    '请描述 React/Vue 的响应式原理。',
    '你如何优化前端性能？',
    '请描述你对微前端/模块化开发的实践。',
    '你在项目中如何处理跨域和安全问题？',
  ],
  data: [
    '请描述你常用的数据分析流程。',
    '你如何处理大规模数据？',
    '请介绍你使用过的数据可视化方案。',
    '你如何确保数据分析结果的准确性？',
  ],
  default: [
    '请描述你最近参与的一个技术项目，你在其中的角色和贡献。',
    '你是如何学习新技术的？最近在学习什么？',
    '请描述你遇到过的一个技术难题，以及如何解决的。',
    '你如何与团队成员进行技术协作？',
  ],
}

const PROJECT_TEMPLATES = [
  '请介绍你简历中提到的项目，你的具体职责是什么？',
  '在这个项目中，你遇到的最大技术挑战是什么？你是如何解决的？',
  '如果让你重新设计这个项目，你会做哪些改进？',
  '请描述项目中你是如何与团队成员分工协作的？',
  '这个项目最终取得了什么成果？你如何衡量它的成功？',
  '在项目中，你是如何做技术选型的？',
]

const BEHAVIORAL_TEMPLATES = [
  '请描述一次你与团队成员产生意见分歧的经历，你是如何处理的？',
  '你如何在多个优先级冲突的任务中进行取舍？',
  '请描述一次你主动承担责任/领导力的经历。',
  '你如何应对紧迫的 Deadline 和压力？',
  '你如何看待持续学习？最近一年你学到了什么新技能？',
  '你为什么想离开当前/上一家公司？',
]

// ─── InterviewAgent ───

export class InterviewAgent {

  /**
   * 生成面试方案
   */
  generateInterviewPlan(job: JobContext, resume: ResumeContext): InterviewPlan {
    const questions: InterviewQuestionSet[] = []
    const focusAreas: string[] = []
    const riskAreas: string[] = []

    // ─── 根据岗位技能生成技术问题 ───
    const matchedTemplates = this.getMatchedTemplates(job.skills)
    const techCount = job.level === 'senior' || job.level === 'lead' ? 3 : 2
    const techQuestions = matchedTemplates.slice(0, techCount)

    for (const q of techQuestions) {
      questions.push({
        category: 'technical',
        question: q,
        expectedAnswer: this.generateExpectedAnswer(q, job.level),
      })
    }

    // ─── 项目问题（根据候选人经历定制） ───
    if (resume.projects && resume.projects.length > 20) {
      questions.push({
        category: 'project',
        question: `请详细介绍你在简历中提到的项目：${resume.projects.slice(0, 100)}。你的具体技术贡献是什么？`,
        expectedAnswer: '能清晰描述项目背景、技术选型、个人贡献和量化成果',
      })
    }
    questions.push({
      category: 'project',
      question: PROJECT_TEMPLATES[Math.floor(Math.random() * PROJECT_TEMPLATES.length)],
      expectedAnswer: '能展示项目思维和解决问题的能力',
    })

    // ─── 深挖问题 ───
    const deepQuestions = this.generateDeepQuestions(job, resume)
    for (const dq of deepQuestions) {
      questions.push(dq)
    }

    // ─── 行为问题 ───
    const behaviorCount = job.level === 'lead' ? 2 : 1
    const behaviorQs = BEHAVIORAL_TEMPLATES.slice(0, behaviorCount)
    for (const bq of behaviorQs) {
      questions.push({
        category: 'behavioral',
        question: bq,
        expectedAnswer: '展示良好的沟通、协作和职业素养',
      })
    }

    // ─── 重点领域 ───
    for (const skill of job.skills.slice(0, 3)) {
      focusAreas.push(`验证${skill}实际能力`)
    }
    if (resume.experienceYears < 2 && job.level !== 'junior') {
      riskAreas.push('经验可能不足，需重点验证学习能力')
    }
    if (resume.city !== job.location && job.location !== '不限') {
      riskAreas.push('城市匹配度需确认')
    }

    return {
      title: `${job.title} - ${resume.name} 面试方案`,
      totalQuestions: questions.length,
      estimatedDuration: questions.length * 5 + 10,
      questions,
      focusAreas,
      riskAreas,
    }
  }

  /**
   * 生成面试评价报告
   */
  generateEvaluation(input: InterviewEvaluationInput): InterviewEvaluationResult {
    const { jobTitle, questions, resumeStrengths, resumeRisks } = input

    // 计算各维度分数
    const techQuestions = questions.filter(q => q.category === 'technical')
    const projectQuestions = questions.filter(q => q.category === 'project')
    const behavioralQuestions = questions.filter(q => q.category === 'behavioral')

    const technicalScore = this.avgScore(techQuestions)
    const projectScore = this.avgScore(projectQuestions)
    const communicationScore = this.avgScore(behavioralQuestions)

    // 沟通能力基于行为问题分数 + 答案质量
    const commScore = behavioralQuestions.length > 0
      ? Math.min(95, communicationScore + 5)
      : 75

    // 综合评分（加权）
    const overallScore = Math.round(
      technicalScore * 0.35 +
      projectScore * 0.3 +
      commScore * 0.2 +
      this.cultureFitScore(questions) * 0.15
    )

    // 优势
    const strengths: string[] = []
    if (technicalScore >= 80) strengths.push('技术能力扎实')
    if (projectScore >= 80) strengths.push('项目经验丰富')
    if (commScore >= 80) strengths.push('沟通能力良好')
    if (resumeStrengths.length > 0) {
      for (const s of resumeStrengths.slice(0, 2)) {
        strengths.push(s)
      }
    }
    if (strengths.length === 0) strengths.push('基础能力达标')

    // 风险点
    const risks: string[] = []
    if (technicalScore < 60) risks.push('技术能力需进一步验证')
    if (projectScore < 60) risks.push('项目经验可能不足')
    if (commScore < 60) risks.push('沟通能力有待观察')
    for (const r of resumeRisks.slice(0, 2)) {
      risks.push(r)
    }
    if (risks.length === 0) risks.push('暂无明显风险')

    // 录用建议
    let recommendation: string
    if (overallScore >= 85) {
      recommendation = '强烈推荐录用'
    } else if (overallScore >= 70) {
      recommendation = '建议进入下一轮面试'
    } else if (overallScore >= 55) {
      recommendation = '可以考虑，但需进一步评估'
    } else {
      recommendation = '不建议录用'
    }

    // 综合评价
    const summary = this.generateSummary(overallScore, jobTitle, strengths, risks)

    // 下一步建议
    const nextSteps: string[] = []
    if (overallScore >= 85) {
      nextSteps.push('安排 HR 谈薪')
      nextSteps.push('准备 Offer 审批')
    } else if (overallScore >= 70) {
      nextSteps.push('安排下一轮技术面试')
      nextSteps.push('深入验证项目经验')
    } else if (overallScore >= 55) {
      nextSteps.push('安排补充面试')
      nextSteps.push('验证具体技能点')
    } else {
      nextSteps.push('结束面试流程')
      nextSteps.push('寻找其他候选人')
    }

    return {
      overallScore,
      technicalScore,
      communicationScore: commScore,
      cultureScore: Math.round(this.cultureFitScore(questions)),
      strengths,
      risks,
      recommendation,
      summary,
      nextSteps,
    }
  }

  /**
   * 生成面试追问建议
   */
  generateFollowUp(question: string, answer: string): string {
    if (answer.length < 20) {
      return '能否更详细地描述一下？'
    }
    if (answer.includes('负责') || answer.includes('参与')) {
      return '你在这个环节的具体贡献是什么？能否量化？'
    }
    if (answer.includes('问题') || answer.includes('bug') || answer.includes('故障')) {
      return '你是如何定位和解决这个问题的？'
    }
    if (answer.includes('优化') || answer.includes('提升') || answer.includes('改进')) {
      return '优化前后对比数据是多少？'
    }
    if (answer.includes('设计') || answer.includes('架构')) {
      return '为什么选择这个方案？有没有考虑过其他方案？'
    }
    return '能否举一个更具体的例子？'
  }

  // ─── 私有方法 ───

  private getMatchedTemplates(skills: string[]): string[] {
    const templates: string[] = []
    const added = new Set<string>()

    for (const skill of skills) {
      const lower = skill.toLowerCase()
      for (const [key, questions] of Object.entries(TECHNICAL_TEMPLATES)) {
        if (lower.includes(key) || key.includes(lower)) {
          for (const q of questions) {
            if (!added.has(q)) {
              templates.push(q)
              added.add(q)
            }
          }
        }
      }
    }

    // 补充通用问题
    for (const q of TECHNICAL_TEMPLATES.default) {
      if (!added.has(q) && templates.length < 6) {
        templates.push(q)
        added.add(q)
      }
    }

    return templates.slice(0, 6)
  }

  private generateExpectedAnswer(question: string, level: string): string {
    if (level === 'senior' || level === 'lead') {
      return '期望深入的技术理解和架构思维，能结合实践经验进行分析'
    }
    return '期望掌握基础概念，能结合实际项目进行说明'
  }

  private generateDeepQuestions(job: JobContext, resume: ResumeContext): InterviewQuestionSet[] {
    const deepQs: InterviewQuestionSet[] = []

    if (resume.experienceYears >= 3) {
      deepQs.push({
        category: 'deep',
        question: '作为有经验的工程师，你是如何指导初级同事的？',
        expectedAnswer: '展示技术领导力和知识传承能力',
      })
    }

    if (job.level === 'senior' || job.level === 'lead') {
      deepQs.push({
        category: 'deep',
        question: '你如何评估一个技术方案的可行性和风险？',
        expectedAnswer: '系统性的技术分析能力，考虑性能、成本、维护性',
      })
    }

    return deepQs
  }

  private avgScore(questions: { score: number }[]): number {
    if (questions.length === 0) return 70
    return Math.round(
      questions.reduce((sum, q) => sum + (q.score || 70), 0) / questions.length
    )
  }

  private cultureFitScore(questions: { score: number }[]): number {
    if (questions.length === 0) return 70
    const avg = questions.reduce((sum, q) => sum + (q.score || 70), 0) / questions.length
    return Math.round(Math.min(95, avg + 5))
  }

  private generateSummary(score: number, jobTitle: string, strengths: string[], risks: string[]): string {
    let summary = `${jobTitle}候选人面试评估：`
    if (score >= 85) {
      summary += `综合表现优秀（${score}分），`
    } else if (score >= 70) {
      summary += `综合表现良好（${score}分），`
    } else if (score >= 55) {
      summary += `综合表现一般（${score}分），`
    } else {
      summary += `综合表现不达标（${score}分），`
    }

    summary += `主要优势：${strengths.slice(0, 2).join('、')}。`
    if (risks.length > 0) {
      summary += `需要关注：${risks.slice(0, 2).join('、')}。`
    }
    return summary
  }
}
