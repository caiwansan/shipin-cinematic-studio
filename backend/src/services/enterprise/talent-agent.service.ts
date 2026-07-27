/**
 * talent-agent.service.ts — AI 猎聘顾问 Service
 * Sprint-07B-2: Talent Agent MVP
 *
 * 提供三个核心能力：
 * 1. analyzeCandidate — 候选人深度分析
 * 2. explainMatch — 匹配分解释
 * 3. searchCandidates — 候选人搜索推荐
 *
 * 架构：
 * - 使用 EnterpriseAgentRuntimeService 执行 LLM
 * - 模型配置走 EnterpriseLlmConfig（企业 AI 员工）
 * - 数据权限：只读本企业候选人
 */

import { PrismaClient } from '@prisma/client'
import { enterpriseAgentRuntime } from './enterprise-agent-runtime.service.js'

export interface TalentAnalysisResult {
  type: 'candidate_analysis' | 'match_explanation' | 'search_recommendation'
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

export class TalentAgentService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 确保企业有 Talent Agent Profile（不存在则创建）
   */
  async ensureTalentAgent(tenantId: string): Promise<{ id: string; name: string } | null> {
    // 1. 查找已有的 talent_agent profile
    let profile = await this.prisma.enterpriseAgentProfile.findFirst({
      where: { tenantId, agentType: 'talent_agent' },
      select: { id: true, name: true },
    })

    if (profile) return profile

    // 2. 创建 talent_agent profile
    profile = await this.prisma.enterpriseAgentProfile.create({
      data: {
        tenantId,
        name: 'AI 猎聘顾问',
        role: 'talent_consultant',
        agentType: 'talent_agent',
        description: '企业招聘团队的智能人才搜寻专家。分析候选人、解释匹配度、推荐最优人才。',
        goal: '帮助企业快速找到最合适的候选人',
        status: 'active',
        capabilities: JSON.stringify(['candidate_analysis', 'match_explanation', 'talent_search']),
        tools: JSON.stringify(['read_candidates', 'read_matches', 'read_jobs']),
        knowledgeScope: JSON.stringify(['candidate_profiles', 'job_requirements', 'match_data']),
      },
      select: { id: true, name: true },
    })

    return profile
  }

  /**
   * 1. 候选人深度分析
   */
  async analyzeCandidate(
    tenantId: string,
    userId: string,
    profileId: string,
    candidateId: string,
  ): Promise<TalentAnalysisResult> {
    const startTime = Date.now()

    // 1. 获取候选人数据
    const candidate = await this.prisma.jobCandidate.findUnique({
      where: { id: candidateId },
      include: {
        matches: {
          include: { job: { select: { title: true } } },
          orderBy: { matchScore: 'desc' },
          take: 3,
        },
      },
    })

    if (!candidate) {
      return this.errorResult('CANDIDATE_NOT_FOUND', startTime)
    }

    // 2. 验证候选人属于本企业（通过 JobPosting → enterpriseId）
    const jobIds = candidate.matches.map(m => m.jobId)
    if (jobIds.length === 0) {
      return this.errorResult('NO_MATCHES_FOR_TENANT', startTime)
    }

    const jobs = await this.prisma.jobPosting.findMany({
      where: { id: { in: jobIds }, enterpriseId: tenantId },
      select: { id: true },
    })

    if (jobs.length === 0) {
      return this.errorResult('CANDIDATE_NOT_IN_TENANT', startTime)
    }

    // 3. 构建 prompt
    const candidateData = {
      education: candidate.education || '未提供',
      skills: candidate.skills?.join(', ') || '未提供',
      experience: candidate.experience || '未提供',
      city: candidate.city || '未提供',
      salaryExpectation: candidate.salaryExpectation || '未提供',
      careerGoal: candidate.careerGoal || '未提供',
      topMatches: candidate.matches.slice(0, 3).map(m => ({
        job: m.job.title,
        score: m.matchScore,
        status: m.status,
      })),
    }

    const prompt = `请分析以下候选人，给出专业评估报告：

## 候选人信息
- 学历：${candidateData.education}
- 技能：${candidateData.skills}
- 经验：${candidateData.experience}
- 城市：${candidateData.city}
- 期望薪资：${candidateData.salaryExpectation}
- 求职目标：${candidateData.careerGoal}

## 匹配记录
${candidateData.topMatches.map(m => `- ${m.job}：匹配度 ${m.score}%（${m.status}）`).join('\n')}

请输出：
1. 优势分析（至少2条）
2. 风险点（至少1条）
3. 综合评价（推荐/观望/不推荐 + 一句话理由）`

    // 4. 执行 LLM
    const result = await this.executeAgentLLM(userId, profileId, tenantId, prompt)

    return {
      type: 'candidate_analysis',
      generatedAt: new Date().toISOString(),
      agentId: profileId,
      agentName: 'AI 猎聘顾问',
      tenantId,
      content: result.content,
      dataSources: ['job_candidate', 'candidate_match'],
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
      },
    }
  }

  /**
   * 2. 匹配分解释
   */
  async explainMatch(
    tenantId: string,
    userId: string,
    profileId: string,
    matchId: string,
  ): Promise<TalentAnalysisResult> {
    const startTime = Date.now()

    // 1. 获取匹配记录
    const match = await this.prisma.candidateMatch.findUnique({
      where: { id: matchId },
      include: {
        candidate: true,
        job: { select: { title: true, requirements: true } },
      },
    })

    if (!match) {
      return this.errorResult('MATCH_NOT_FOUND', startTime)
    }

    // 2. 验证属于本企业
    const job = await this.prisma.jobPosting.findFirst({
      where: { id: match.jobId, enterpriseId: tenantId },
      select: { id: true },
    })

    if (!job) {
      return this.errorResult('MATCH_NOT_IN_TENANT', startTime)
    }

    // 3. 构建 prompt
    const prompt = `请解释以下候选人的匹配分数：

## 岗位：${match.job.title}
- 岗位要求：${match.job.requirements || '未填写'}

## 候选人
- 学历：${match.candidate.education || '未提供'}
- 技能：${match.candidate.skills?.join(', ') || '未提供'}
- 经验：${match.candidate.experience || '未提供'}
- 城市：${match.candidate.city || '未提供'}
- 期望薪资：${match.candidate.salaryExpectation || '未提供'}
- 求职目标：${match.candidate.careerGoal || '未提供'}

## 匹配分数：${match.matchScore}%
匹配状态：${match.status}

请输出：
1. 匹配分解读（为什么是这个分数）
2. 核心匹配点（技能/经验/学历哪些维度匹配）
3. 差距分析（失分在哪里）
4. 建议（是否推荐面试 + 理由）`

    // 4. 执行 LLM
    const result = await this.executeAgentLLM(userId, profileId, tenantId, prompt)

    return {
      type: 'match_explanation',
      generatedAt: new Date().toISOString(),
      agentId: profileId,
      agentName: 'AI 猎聘顾问',
      tenantId,
      content: result.content,
      dataSources: ['candidate_match', 'job_posting'],
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
      },
    }
  }

  /**
   * 3. 候选人搜索推荐
   */
  async searchCandidates(
    tenantId: string,
    userId: string,
    profileId: string,
    jobId: string,
    limit: number = 5,
  ): Promise<TalentAnalysisResult> {
    const startTime = Date.now()

    // 1. 验证岗位属于本企业
    const job = await this.prisma.jobPosting.findFirst({
      where: { id: jobId, enterpriseId: tenantId },
    })

    if (!job) {
      return this.errorResult('JOB_NOT_FOUND', startTime)
    }

    // 2. 获取该岗位的匹配候选人
    const matches = await this.prisma.candidateMatch.findMany({
      where: { jobId },
      orderBy: { matchScore: 'desc' },
      take: limit,
      include: {
        candidate: true,
      },
    })

    if (matches.length === 0) {
      return this.errorResult('NO_MATCHES_FOR_JOB', startTime)
    }

    // 3. 构建 prompt
    const candidatesText = matches.map((m, i) => `
### 候选人 ${i + 1}（匹配度 ${m.matchScore}%）
- 学历：${m.candidate.education || '未提供'}
- 技能：${m.candidate.skills?.join(', ') || '未提供'}
- 经验：${m.candidate.experience || '未提供'}
- 城市：${m.candidate.city || '未提供'}
- 期望薪资：${m.candidate.salaryExpectation || '未提供'}
- 求职目标：${m.candidate.careerGoal || '未提供'}
- 匹配状态：${m.status}
`).join('\n')

    const prompt = `请根据以下岗位要求，对候选人进行排序推荐：

## 岗位：${job.title}
- 岗位要求：${job.requirements || '未填写'}
- 薪资：${job.salaryExpectation || '未填写'}
- 地点：${job.location || '未填写'}
- 经验要求：${job.experienceMin ? job.experienceMin + '年+' : '未填写'}

## 候选人列表
${candidatesText}

请输出：
1. **推荐排序**（按匹配度从高到低，编号引用上面的候选人）
2. **推荐理由**（每个候选人一句话核心优势）
3. **风险提示**（哪些候选人有潜在问题）
4. **面试建议**（推荐进入面试的候选人编号 + 理由）`

    // 4. 执行 LLM
    const result = await this.executeAgentLLM(userId, profileId, tenantId, prompt)

    return {
      type: 'search_recommendation',
      generatedAt: new Date().toISOString(),
      agentId: profileId,
      agentName: 'AI 猎聘顾问',
      tenantId,
      content: result.content,
      dataSources: ['job_posting', 'candidate_match'],
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        provider: 'gateway',
      },
    }
  }

  // ─── Private Helpers ───────────────────────────────────────

  /**
   * 执行 LLM 调用（通过 EnterpriseAgentRuntimeService）
   * 使用 executeViaGateway + tenantId（EnterpriseLlmConfig）
   */
  private async executeAgentLLM(
    userId: string,
    profileId: string,
    tenantId: string,
    prompt: string,
  ): Promise<{ content: string; model: string; tokensUsed: number }> {
    const { executeViaGateway } = await import('../../runtime/runtime-gateway.js')

    // 获取企业 LLM 配置
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
      systemPrompt: undefined, // 使用默认 prompt
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

  private errorResult(code: string, startTime: number): TalentAnalysisResult {
    const errorMessages: Record<string, string> = {
      CANDIDATE_NOT_FOUND: '未找到候选人信息',
      NO_MATCHES_FOR_TENANT: '该候选人没有匹配记录',
      CANDIDATE_NOT_IN_TENANT: '该候选人不属于本企业',
      MATCH_NOT_FOUND: '未找到匹配记录',
      MATCH_NOT_IN_TENANT: '该匹配记录不属于本企业',
      JOB_NOT_FOUND: '未找到岗位信息',
      NO_MATCHES_FOR_JOB: '该岗位暂无匹配候选人',
    }

    return {
      type: 'candidate_analysis',
      generatedAt: new Date().toISOString(),
      agentId: '',
      agentName: 'AI 猎聘顾问',
      tenantId: '',
      content: `⚠️ ${errorMessages[code] || code}`,
      dataSources: [],
      metadata: { model: 'none', tokensUsed: 0, durationMs: Date.now() - startTime, provider: 'none' },
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────
import { prisma } from '../../utils/index.js'
export const talentAgentService = new TalentAgentService(prisma)
