/**
 * interview-agent.ts — AI 面试助手 Agent
 *
 * Phase 2-P2: 企业招聘面试能力
 * - 面试方案生成（LLM 动态生成，模板兜底）
 * - 面试评价报告（LLM 评估，公式兜底）
 * - 招聘流程增强
 *
 * Sprint-RECRUITMENT-REALITY-02:
 * - generateInterviewPlanWithLLM: 基于 JD+岗位要求+简历 动态生成题目（删除 Math.random 模板）
 * - generateEvaluationWithLLM: 基于回答内容 LLM 评分（删除前端 score 依赖）
 * - 旧模板方法保留为 fallback，LLM 失败时兜底并标记 aiSource=fallback
 */

// ─── 类型定义 ───

import { extractJSONObject } from './enterprise-recruit-agent.js'

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
  jobRequirements?: string[]
  questions: {
    id?: string
    category: string
    question: string
    score: number
    answer?: string
  }[]
  resumeStrengths: string[]
  resumeRisks: string[]
}

export interface QuestionScore {
  questionId: string
  score: number
  comment: string
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
  questionScores?: QuestionScore[]
  aiSource?: 'llm' | 'fallback'
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

export interface InterviewAgentContext {
  userId: string
  tenantId: string
}

// ─── InterviewAgent ───

export class InterviewAgent {

  /**
   * 生成面试方案 — LLM 动态生成（Task 02）
   * 输入 JD + 岗位要求 + 候选人简历 + 企业偏好 → LLM 动态出题
   * 解析失败降级模板（记录 aiSource=fallback）
   */
  async generateInterviewPlanWithLLM(
    job: JobContext,
    resume: ResumeContext,
    ctx: InterviewAgentContext,
  ): Promise<{ plan: InterviewPlan; aiSource: 'llm' | 'fallback' }> {
    const prompt = `你是一位资深技术面试官，请为以下候选人生成一份个性化面试方案。

## 岗位信息
- 岗位：${job.title}
- 级别：${job.level}
- 技能要求：${job.skills.join('、') || '未提供'}
- 薪资：${job.salary || '未提供'}
- 地点：${job.location || '不限'}
- 任职要求：${job.requirements.join('；') || '未提供'}

## 候选人简历
- 姓名：${resume.name}
- 技能：${resume.skills.join('、') || '未提供'}
- 经验年限：${resume.experienceYears}年
- 学历：${resume.education || '未提供'}
- 城市：${resume.city || '未提供'}
- 职业目标：${resume.careerGoal || '未提供'}
- 项目经历：${resume.projects || '未提供'}

## 要求
请针对该候选人**个性化出题**（不要用泛泛的模板问题）：
1. 技术问题：基于岗位技能要求，结合候选人简历中的项目/技能深入追问（如候选人做过支付系统，就问高并发数据一致性）
2. 项目问题：围绕候选人简历中的项目经历展开
3. 行为问题：考察沟通协作/抗压/成长性
4. 深挖问题：针对简历中的风险点（如技能缺失、经验不足）验证

请严格输出以下 JSON（不要输出其他任何文字，不要用 markdown 代码块包裹）：
{
  "title": "面试方案标题",
  "questions": [
    {
      "category": "technical 或 project 或 behavioral 或 deep",
      "question": "具体面试问题（必须结合简历/JD，个性化）",
      "expectedAnswer": "期望的回答要点",
      "followUp": "追问问题（可选）"
    }
  ],
  "focusAreas": ["重点考察领域，2-4条"],
  "riskAreas": ["风险关注点，1-3条"]
}

题目数量：技术 2-3 题、项目 1-2 题、行为 1 题、深挖 1 题，总计 5-7 题。`

    try {
      const result = await this.executeAgentLLM(prompt, ctx)
      const parsed = extractJSONObject(result.content)
      if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        console.warn('[InterviewAgent] LLM plan parse failed, falling back to template')
        return { plan: this.generateInterviewPlan(job, resume), aiSource: 'fallback' }
      }

      const questions = parsed.questions
        .filter((q: any) => q && typeof q.question === 'string' && q.question.trim())
        .slice(0, 8)
        .map((q: any) => ({
          category: ['technical', 'project', 'behavioral', 'deep'].includes(q.category) ? q.category : 'technical',
          question: q.question.trim(),
          expectedAnswer: q.expectedAnswer || '',
          followUp: q.followUp || undefined,
        }))

      if (questions.length === 0) {
        return { plan: this.generateInterviewPlan(job, resume), aiSource: 'fallback' }
      }

      const plan: InterviewPlan = {
        title: parsed.title || `${job.title} - ${resume.name} 面试方案`,
        totalQuestions: questions.length,
        estimatedDuration: questions.length * 5 + 10,
        questions,
        focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.slice(0, 4) : [],
        riskAreas: Array.isArray(parsed.riskAreas) ? parsed.riskAreas.slice(0, 3) : [],
      }
      return { plan, aiSource: 'llm' }
    } catch (e: any) {
      console.warn(`[InterviewAgent] LLM plan failed (${e.message}), falling back to template`)
      return { plan: this.generateInterviewPlan(job, resume), aiSource: 'fallback' }
    }
  }

  /**
   * 生成面试评价报告 — LLM 评估（Task 01）
   * 输入题目+候选人回答+岗位要求 → LLM 逐题评分 + 综合评估
   * 解析失败降级公式（记录 aiSource=fallback）
   */
  async generateEvaluationWithLLM(
    input: InterviewEvaluationInput,
    ctx: InterviewAgentContext,
  ): Promise<InterviewEvaluationResult> {
    // 健壮性：resumeStrengths / resumeRisks 可缺省（调用方可能不传）
    const strengths = input.resumeStrengths || []
    const risks = input.resumeRisks || []
    const qaText = input.questions.map(q => {
      const answer = q.answer && q.answer.trim() ? q.answer.trim() : '（未回答）'
      return `题目[id=${q.id || 'unknown'}] [${q.category}]：${q.question}\n回答：${answer.slice(0, 500)}`
    }).join('\n\n')

    const prompt = `你是一位严格的资深面试官，请根据候选人的实际回答进行专业评估。

## 岗位
${input.jobTitle}
岗位要求：${input.jobRequirements?.join('；') || '未提供'}

## 面试问答记录
${qaText || '（无问答记录）'}

## 评估要求
根据回答的实际质量评分（不是平均分，而是基于回答内容判断）：
- 回答具体、有深度、有量化结果 → 高分（85+）
- 回答一般、泛泛而谈 → 中分（60-80）
- 回答空洞、答非所问或未回答 → 低分（<60）

请严格输出以下 JSON（不要输出其他任何文字，不要用 markdown 代码块包裹）：
{
  "overallScore": 0-100 整数,
  "technicalScore": 0-100 整数,
  "communicationScore": 0-100 整数,
  "cultureScore": 0-100 整数,
  "strengths": ["优势，2-4条"],
  "risks": ["风险点，1-3条"],
  "recommendation": "强烈推荐录用 或 建议进入下一轮面试 或 可以考虑，但需进一步评估 或 不建议录用",
  "summary": "综合评价（2-3句话）",
  "nextSteps": ["下一步建议，1-3条"],
  "questionScores": [
    {"questionId": "对应题目的 id（必须使用上面问答记录中 [id=xxx] 的真实 id，不能自己编）", "score": 0-100 整数, "comment": "该题评价"}
  ]
}`

    try {
      const result = await this.executeAgentLLM(prompt, ctx)
      const parsed = extractJSONObject(result.content)
      if (!parsed) {
        console.warn('[InterviewAgent] LLM evaluation parse failed, falling back to formula')
        return { ...this.generateEvaluation(input), aiSource: 'fallback' }
      }

      const num = (v: any, fb: number) => {
        const n = typeof v === 'number' ? Math.round(v) : NaN
        return Number.isNaN(n) ? fb : Math.min(100, Math.max(0, n))
      }
      const strArr = (v: any, fb: string[]) => Array.isArray(v) && v.length > 0 ? v.map(String) : fb

      const questionScores: QuestionScore[] = Array.isArray(parsed.questionScores)
        ? parsed.questionScores
            .filter((qs: any) => qs && qs.questionId)
            .map((qs: any) => ({
              questionId: String(qs.questionId),
              score: num(qs.score, 70),
              comment: qs.comment || '',
            }))
        : []

      return {
        overallScore: num(parsed.overallScore, this.generateEvaluation(input).overallScore),
        technicalScore: num(parsed.technicalScore, 70),
        communicationScore: num(parsed.communicationScore, 70),
        cultureScore: num(parsed.cultureScore, 70),
        strengths: strArr(parsed.strengths, ['基础能力达标']),
        risks: strArr(parsed.risks, ['暂无明显风险']),
        recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '可以考虑，但需进一步评估',
        summary: typeof parsed.summary === 'string' ? parsed.summary : `${input.jobTitle}候选人面试评估完成`,
        nextSteps: strArr(parsed.nextSteps, ['安排下一轮面试']),
        questionScores,
        aiSource: 'llm' as const,
      }
    } catch (e: any) {
      console.warn(`[InterviewAgent] LLM evaluation failed (${e.message}), falling back to formula`)
      return { ...this.generateEvaluation(input), aiSource: 'fallback' }
    }
  }

  /**
   * 执行 LLM（executeViaGateway + 企业 LLM 配置，与 talent-agent 一致）
   */
  private async executeAgentLLM(prompt: string, ctx: InterviewAgentContext): Promise<{ content: string }> {
    const { executeViaGateway } = await import('../../runtime/runtime-gateway.js')
    const { prisma } = await import('../../utils/index.js')

    const enterpriseLlm = await prisma.enterpriseLlmConfig.findFirst({
      where: { tenantId: ctx.tenantId, status: 'active', enabled: true, credentialOwner: 'enterprise' },
    })

    if (!enterpriseLlm) {
      throw new Error('ENTERPRISE_LLM_NOT_CONFIGURED')
    }

    const result = await executeViaGateway('llm', {
      prompt,
      maxTokens: 2048,
      temperature: 0.7,
    }, {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      provider: enterpriseLlm.provider,
      model: enterpriseLlm.modelName,
    })

    return { content: result.content || '' }
  }

  /**
   * 生成面试方案（模板引擎，保留为 fallback）
   * @deprecated Sprint-RECRUITMENT-REALITY-02 — 仅 LLM 不可用时兜底
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
   * 生成面试评价报告（公式引擎，保留为 fallback）
   * @deprecated Sprint-RECRUITMENT-REALITY-02 — 仅 LLM 不可用时兜底
   */
  generateEvaluation(input: InterviewEvaluationInput): InterviewEvaluationResult {
    const { jobTitle, questions, resumeStrengths = [], resumeRisks = [] } = input

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
