/**
 * enterprise-recruit-agent.ts — 企业 AI 招聘代理
 *
 * Phase 2: 企业 AI 招聘部门
 * - AI 生成 JD（LLM 生成，模板兜底）
 * - 岗位优化建议
 * - 招聘需求分析
 * - 人才匹配（统一走 TalentMatchingEngine，权重 0.40/0.30/0.15/0.15）
 *
 * Sprint-RECRUITMENT-REALITY-02:
 * - generateJDWithLLM: 真实 LLM 生成（走 executeViaGateway + 企业 LLM 配置）
 * - generateJD: 保留为 fallback（仅 LLM 不可用/解析失败时兜底，记录 aiSource=fallback）
 * - matchCandidates: 删除私有评分公式，改调统一匹配引擎（simple-match.adapter）
 */

// ─── 类型定义 ───

import { matchSimpleCandidates } from '../../services/matching/simple-match.adapter.js'

// ─── JSON 解析辅助 ───

/**
 * 从 LLM 输出中提取 JSON 对象（容错：去代码块/去首尾噪声）
 */
export function extractJSONObject(content: string): any | null {
  if (!content) return null
  let text = content.trim()
  // 去 markdown 代码块
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence) text = fence[1].trim()
  try {
    return JSON.parse(text)
  } catch {
    // 尝试提取第一个 { ... } 平衡块
    const start = text.indexOf('{')
    if (start === -1) return null
    let depth = 0
    let inStr = false
    let escape = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (inStr) {
        if (escape) escape = false
        else if (ch === '\\') escape = true
        else if (ch === '"') inStr = false
        continue
      }
      if (ch === '"') inStr = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1))
          } catch {
            return null
          }
        }
      }
    }
    return null
  }
}

function clampScore(score: any, fallback: number): number {
  const n = typeof score === 'number' ? Math.round(score) : NaN
  if (Number.isNaN(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

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
  // Sprint-RECRUITMENT-REALITY-02: LLM 增强输出（岗位定位/画像/关键词/面试重点/风险）
  positioning?: string
  targetProfile?: string[]
  keywords?: string[]
  interviewFocus?: string[]
  risks?: string[]
  // 来源标记: llm | fallback
  aiSource?: 'llm' | 'fallback'
}

export interface JDAgentContext {
  userId: string
  tenantId: string
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
    skill: number
    experience: number
    education: number
    career: number
  }
  reasons: string[]
  risks: string[]
  evidence?: {
    evidenceType: string
    claim: string
    sourceType: string
    sourceId: string
    confidence: number
  }[]
  matchedSkills?: string[]
  missingSkills?: string[]
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
   * AI 生成 JD — LLM 真实生成
   * Sprint-RECRUITMENT-REALITY-02 Task 03:
   * 输入招聘目标/岗位名称/企业文化/团队情况/薪资范围 → LLM 输出完整 JD + 招聘策略
   * 走 executeViaGateway + 企业 LLM 配置（与 Carol 一致），失败降级模板并标记 aiSource=fallback
   */
  async generateJDWithLLM(input: JDGenerationInput, ctx: JDAgentContext): Promise<JDGenerationResult> {
    const { companyName, position, industry, scale, salaryRange, location, requirements, benefits } = input

    const prompt = `请为一家企业生成一份专业、有吸引力的招聘 JD，并输出招聘策略。

## 企业信息
- 公司名称：${companyName || '贵公司'}
- 行业：${industry || '未提供'}
- 规模：${scale || '未提供'}
- 地点：${location || '未提供'}

## 岗位信息
- 岗位名称：${position}
- 薪资范围：${salaryRange || '未提供（请给出合理建议）'}
- 已知要求：${(requirements || []).join('、') || '未提供'}
- 已知福利：${(benefits || []).join('、') || '未提供'}

请严格输出以下 JSON（不要输出任何其他文字，不要用 markdown 代码块包裹）：
{
  "title": "岗位名称",
  "description": "岗位描述（3-5句话，突出企业亮点和发展空间）",
  "requirements": ["任职要求数组，5-8条，具体可验证"],
  "responsibilities": ["岗位职责数组，4-6条"],
  "salarySuggestion": "薪资建议字符串（如 18-25K）",
  "benefits": ["福利数组，4-6条"],
  "positioning": "岗位定位（1-2句话：这个岗位在团队中的角色与价值）",
  "targetProfile": ["目标候选人画像，2-4条（经验/背景/特质）"],
  "keywords": ["筛选关键词，5-10个（用于简历筛选）"],
  "interviewFocus": ["面试重点考察点，3-5条"],
  "risks": ["潜在风险点，1-3条（如市场稀缺/薪资竞争力不足）"],
  "qualityScore": 0-100 的整数,
  "improvements": ["改进建议数组，1-3条"]
}`

    try {
      const result = await this.executeAgentLLM(prompt, ctx)
      const parsed = extractJSONObject(result.content)
      if (!parsed) {
        console.warn(`[RecruitAgent] LLM JD parse failed, falling back to template. position=${position}`)
        return { ...this.generateJD(input), aiSource: 'fallback' as const }
      }

      return {
        title: parsed.title || position,
        description: parsed.description || this.buildDescription(input),
        requirements: Array.isArray(parsed.requirements) ? parsed.requirements : this.buildRequirements(input),
        responsibilities: Array.isArray(parsed.responsibilities) ? parsed.responsibilities : this.buildResponsibilities(input),
        salarySuggestion: parsed.salarySuggestion || salaryRange || this.getSalarySuggestion(position),
        benefits: Array.isArray(parsed.benefits) && parsed.benefits.length > 0 ? parsed.benefits : (benefits || ['五险一金', '带薪年假', '弹性工作', '餐补/交通补', '定期团建', '学习基金']),
        qualityScore: clampScore(parsed.qualityScore, this.calculateJDQuality(input)),
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : this.suggestJDImprovements(input),
        positioning: parsed.positioning || '',
        targetProfile: Array.isArray(parsed.targetProfile) ? parsed.targetProfile : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        interviewFocus: Array.isArray(parsed.interviewFocus) ? parsed.interviewFocus : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        aiSource: 'llm' as const,
      }
    } catch (e: any) {
      console.warn(`[RecruitAgent] LLM JD failed (${e.message}), falling back to template`)
      return { ...this.generateJD(input), aiSource: 'fallback' as const }
    }
  }

  /**
   * 执行 LLM（executeViaGateway + 企业 LLM 配置，与 talent-agent 一致）
   */
  private async executeAgentLLM(prompt: string, ctx: JDAgentContext): Promise<{ content: string; totalTokens: number; model: string }> {
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

    return {
      content: result.content || '',
      totalTokens: result.totalTokens || 0,
      model: enterpriseLlm.modelName,
    }
  }

  private getSalarySuggestion(position: string): string {
    const benchmark = getSalaryBenchmark(position)
    return `${benchmark.low}-${benchmark.high}K`
  }

  /**
   * AI 生成 JD（模板引擎，保留为 fallback）
   * @deprecated Sprint-RECRUITMENT-REALITY-02 — 仅 LLM 不可用时兜底
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
   * 人才匹配 — 统一匹配引擎
   * Sprint-RECRUITMENT-REALITY-02 Task 04:
   * 不再使用私有权重公式（0.35/0.2/0.2/0.15/0.1），
   * 统一走 TalentMatchingEngine（skill 0.40 / exp 0.30 / edu 0.15 / career 0.15）
   */
  matchCandidates(input: CandidateMatchInput): CandidateMatchResult[] {
    const { jobSkills, jobLocation, candidates } = input
    const jobReq = {
      jobId: input.jobId,
      jobSkills,
      experienceMin: 0,
      location: jobLocation || undefined,
    }

    const results = matchSimpleCandidates(
      candidates.map(c => ({
        id: c.id,
        name: c.name,
        skills: c.skills || [],
        experience: c.experience,
        city: c.city,
        education: c.education,
      })),
      jobReq,
    )

    return results.map(r => {
      const nameMap = new Map(candidates.map(c => [c.id, c.name]))
      const reasons: string[] = []
      const risks: string[] = []

      // 从证据生成可读 reasons（LLM 不参与，全确定性）
      const dimLabels: Record<string, string> = { skill: '技能', experience: '经验', education: '学历', career: '方向' }
      for (const [dim, label] of Object.entries(dimLabels)) {
        const score = r.breakdown[dim as keyof typeof r.breakdown] || 0
        if (score >= 80) reasons.push(`${label}匹配度高（${score}分）`)
        else if (score < 50) risks.push(`${label}匹配不足（${score}分）`)
      }
      if (reasons.length === 0 && risks.length === 0) reasons.push('综合匹配度适中')

      return {
        candidateId: r.candidateId,
        name: nameMap.get(r.candidateId) || '求职者',
        matchScore: r.score,
        matchBreakdown: {
          skill: r.breakdown.skill,
          experience: r.breakdown.experience,
          education: r.breakdown.education,
          career: r.breakdown.career,
        },
        reasons,
        risks,
        evidence: r.evidence.map(e => ({
          evidenceType: e.evidenceType,
          claim: e.claim,
          sourceType: e.sourceType,
          sourceId: e.sourceId,
          confidence: e.confidence,
        })),
        matchedSkills: r.matchedSkills?.map((s: any) => s.skillName || s.name || String(s)) || [],
        missingSkills: r.missingSkills?.map((s: any) => s.skillName || s.name || String(s)) || [],
      }
    })
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
