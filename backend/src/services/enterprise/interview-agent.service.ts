/**
 * interview-agent.service.ts — AI 面试官 Service
 * Sprint-07B-3: Interview Agent MVP
 *
 * 三个核心能力：
 * 1. generateQuestions — 基于岗位和候选人生成面试问题
 * 2. suggestFollowUp — 基于回答建议追问方向
 * 3. summarizeInterview — 生成面试总结和评估报告
 *
 * 架构：EnterpriseLlmConfig → executeViaGateway
 * 数据权限：只读本企业面试记录和候选人
 */

import { PrismaClient } from '@prisma/client'

export interface InterviewResult {
  type: 'question_generation' | 'follow_up_suggestion' | 'interview_summary'
  generatedAt: string
  agentId: string
  agentName: string
  tenantId: string
  content: string
  dataSources: string[]
  metadata: {
    model: string
    tokensUsed: number
    durationMs: number
    provider: string
  }
}

export class InterviewAgentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 确保企业有 Interview Agent Profile
   */
  async ensureInterviewAgent(tenantId: string): Promise<{ id: string; name: string } | null> {
    let profile = await this.prisma.enterpriseAgentProfile.findFirst({
      where: { tenantId, agentType: 'interview_agent' },
      select: { id: true, name: true },
    })

    if (profile) return profile

    profile = await this.prisma.enterpriseAgentProfile.create({
      data: {
        tenantId,
        name: 'AI 面试官',
        role: 'interviewer',
        agentType: 'interview_agent',
        description: '企业招聘团队的智能面试评估专家。生成面试问题、辅助面试评估、输出结构化报告。',
        goal: '帮助企业高效、客观地评估候选人',
        status: 'active',
        capabilities: JSON.stringify(['question_generation', 'interview_assist', 'interview_summary']),
        tools: JSON.stringify(['read_interviews', 'read_candidates', 'read_jobs']),
        knowledgeScope: JSON.stringify(['interview_records', 'candidate_profiles', 'job_requirements']),
      },
      select: { id: true, name: true },
    })

    return profile
  }

  /**
   * 1. 生成面试问题
   */
  async generateQuestions(
    tenantId: string,
    userId: string,
    profileId: string,
    jobId: string,
    candidateId: string,
  ): Promise<InterviewResult> {
    const startTime = Date.now()

    // 验证岗位和候选人属于本企业
    const job = await this.prisma.jobPosting.findFirst({
      where: { id: jobId, enterpriseId: tenantId },
    })
    if (!job) return this.errorResult('JOB_NOT_FOUND', startTime)

    const candidate = await this.prisma.careerProfile.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        candidateId: true,
        fullName: true,
        headline: true,
        bio: true,
        city: true,
        careerDirection: true,
        skills: { select: { name: true } },
        workExperiences: { orderBy: { startDate: 'desc' }, take: 1, select: { title: true, company: true } },
        educations: { orderBy: { startDate: 'desc' }, take: 1, select: { degree: true, field: true } },
      },
    })
    if (!candidate) {
      return this.errorResult('CANDIDATE_NOT_IN_TENANT', startTime)
    }

    // 通过 CareerProfile.candidateId 查询匹配记录
    const matches = await this.prisma.candidateMatch.findMany({
      where: { candidateId: candidate.candidateId, jobId },
      take: 1,
    })
    if (matches.length === 0) {
      return this.errorResult('CANDIDATE_NOT_IN_TENANT', startTime)
    }

    const skills = candidate.skills?.map(s => s.name).join(', ') || '未提供'
    const experience = candidate.workExperiences?.[0]
      ? `${candidate.workExperiences[0].title} @ ${candidate.workExperiences[0].company || '未提供'}`
      : (candidate.headline || '未提供')
    const education = candidate.educations?.[0]
      ? `${candidate.educations[0].degree || ''} ${candidate.educations[0].field || ''}`.trim() || '未提供'
      : '未提供'

    const prompt = `请基于以下岗位和候选人信息，生成一套完整的面试问题：

## 岗位：${job.title}
- 岗位要求：${job.requirements || '未填写'}
- 薪资：${job.salaryExpectation || '未填写'}
- 地点：${job.location || '未填写'}
- 经验要求：${job.experienceMin ? job.experienceMin + '年+' : '未填写'}

## 候选人
- 姓名：${candidate.fullName || '求职者'}
- 学历：${education}
- 技能：${skills}
- 经验：${experience}
- 城市：${candidate.city || '未提供'}
- 求职目标：${candidate.careerDirection || candidate.bio || '未提供'}
- 当前匹配度：${matches[0].matchScore}%

请生成以下类别的面试问题（每个类别 2-3 题）：

### 一、技术能力（Technical）
- 标注难度（基础/进阶/专家）
- 标注考察点
- 给出期望答案方向

### 二、项目经验（Experience）
- 基于候选人经历深挖
- 使用 STAR 原则

### 三、行为面试（Behavioral）
- 团队协作、冲突处理、压力应对

### 四、文化匹配（Culture）
- 工作价值观、职业规划

请用清晰的 Markdown 格式输出。`

    const result = await this.executeAgentLLM(userId, profileId, tenantId, prompt)

    return {
      type: 'question_generation',
      generatedAt: new Date().toISOString(),
      agentId: profileId,
      agentName: 'AI 面试官',
      tenantId,
      content: result.content,
      dataSources: ['job_posting', 'job_candidate', 'candidate_match'],
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
      },
    }
  }

  /**
   * 2. 追问建议
   */
  async suggestFollowUp(
    tenantId: string,
    userId: string,
    profileId: string,
    sessionId: string,
    lastQuestion: string,
    lastAnswer: string,
  ): Promise<InterviewResult> {
    const startTime = Date.now()

    // 验证面试属于本企业
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        job: { select: { title: true, requirements: true } },
        questions: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })

    if (!session) return this.errorResult('SESSION_NOT_FOUND', startTime)

    const job = await this.prisma.jobPosting.findFirst({
      where: { id: session.jobId, enterpriseId: tenantId },
    })
    if (!job) return this.errorResult('SESSION_NOT_IN_TENANT', startTime)

    const prompt = `请基于以下面试对话，给出追问建议：

## 岗位：${session.job.title}
- 岗位要求：${session.job.requirements || '未填写'}

## 候选人：${session.candidateName}

## 最近一轮问答
**面试官提问：**
${lastQuestion}

**候选人回答：**
${lastAnswer}

请输出：
1. **回答质量评估**（优秀/良好/一般/不足 + 一句话理由）
2. **追问方向**（至少 2 个具体追问问题）
3. **深挖建议**（候选人回答中值得进一步了解的点）

请以简洁、可操作的方式输出。`

    const result = await this.executeAgentLLM(userId, profileId, tenantId, prompt)

    return {
      type: 'follow_up_suggestion',
      generatedAt: new Date().toISOString(),
      agentId: profileId,
      agentName: 'AI 面试官',
      tenantId,
      content: result.content,
      dataSources: ['interview_session', 'interview_question'],
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
      },
    }
  }

  /**
   * 3. 面试总结
   */
  async summarizeInterview(
    tenantId: string,
    userId: string,
    profileId: string,
    sessionId: string,
  ): Promise<InterviewResult> {
    const startTime = Date.now()

    // 验证面试属于本企业
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        job: { select: { title: true, requirements: true } },
        questions: { orderBy: { createdAt: 'asc' } },
        evaluation: true,
      },
    })

    if (!session) return this.errorResult('SESSION_NOT_FOUND', startTime)

    const job = await this.prisma.jobPosting.findFirst({
      where: { id: session.jobId, enterpriseId: tenantId },
    })
    if (!job) return this.errorResult('SESSION_NOT_IN_TENANT', startTime)

    // 构建面试对话记录
    const qaText = session.questions.map((q, i) => `
### 问题 ${i + 1}（${q.category}）
**问：** ${q.question}
**答：** ${q.answer || '未回答'}
**评分：** ${q.score ?? '未评分'}/10
${q.followUp ? `**追问：** ${q.followUp}` : ''}
`).join('\n')

    const existingEval = session.evaluation ? `
## 现有评估
- 总分：${session.evaluation.overallScore}/100
- 技术：${session.evaluation.technicalScore}/100
- 沟通：${session.evaluation.communicationScore}/100
- 文化：${session.evaluation.cultureScore}/100
- 建议：${session.evaluation.recommendation}
` : ''

    const prompt = `请基于以下完整面试记录，生成面试总结报告：

## 岗位：${session.job.title}
- 岗位要求：${session.job.requirements || '未填写'}

## 候选人：${session.candidateName}

## 面试问答记录
${qaText}

${existingEval}

请输出：

### 一、能力评估（百分制）
- 技术能力：XX/100（依据：...）
- 沟通表达：XX/100（依据：...）
- 岗位匹配：XX/100（依据：...）
- 文化契合：XX/100（依据：...）

### 二、核心优势（至少 2 条，引用具体回答）

### 三、风险点（至少 1 条，引用具体表现）

### 四、录用建议
- 强烈推荐 / 推荐 / 观望 / 不推荐
- 一句话理由

### 五、后续建议
- 下一步：进入下一轮 / 补充技术面 / 不建议继续
- 注意要点

请用结构化 Markdown 输出。`

    const result = await this.executeAgentLLM(userId, profileId, tenantId, prompt)

    return {
      type: 'interview_summary',
      generatedAt: new Date().toISOString(),
      agentId: profileId,
      agentName: 'AI 面试官',
      tenantId,
      content: result.content,
      dataSources: ['interview_session', 'interview_question', 'interview_evaluation'],
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
      },
    }
  }

  // ─── Private Helpers ───────────────────────────────────────

  private async executeAgentLLM(
    userId: string,
    profileId: string,
    tenantId: string,
    prompt: string,
  ): Promise<{ content: string; model: string; tokensUsed: number }> {
    const { executeViaGateway } = await import('../../runtime/runtime-gateway.js')

    const enterpriseLlm = await this.prisma.enterpriseLlmConfig.findFirst({
      where: { tenantId, status: 'active', enabled: true, credentialOwner: 'enterprise' },
    })

    if (!enterpriseLlm) {
      return {
        content: '⚠️ 企业未配置 LLM 模型。请联系管理员在「企业设置 → AI 模型」中配置。',
        model: 'none',
        tokensUsed: 0,
      }
    }

    const result = await executeViaGateway('llm', {
      systemPrompt: undefined,
      prompt,
      maxTokens: 4096,
      temperature: 0.7,
    }, {
      userId,
      tenantId,
      provider: enterpriseLlm.provider,
      model: enterpriseLlm.modelName,
    })

    return {
      content: result.content || '生成失败，请重试',
      model: enterpriseLlm.modelName,
      tokensUsed: result.totalTokens || 0,
    }
  }

  private errorResult(code: string, startTime: number): InterviewResult {
    const messages: Record<string, string> = {
      JOB_NOT_FOUND: '未找到岗位信息',
      CANDIDATE_NOT_IN_TENANT: '该候选人不属于本企业',
      SESSION_NOT_FOUND: '未找到面试记录',
      SESSION_NOT_IN_TENANT: '该面试不属于本企业',
    }

    return {
      type: 'question_generation',
      generatedAt: new Date().toISOString(),
      agentId: '',
      agentName: 'AI 面试官',
      tenantId: '',
      content: `⚠️ ${messages[code] || code}`,
      dataSources: [],
      metadata: { model: 'none', tokensUsed: 0, durationMs: Date.now() - startTime, provider: 'none' },
    }
  }
}

import { prisma } from '../../utils/index.js'
export const interviewAgentService = new InterviewAgentService(prisma)
