/**
 * career-conversation-orchestrator.ts — Sprint-09A-05
 *
 * 职责：保留 JobCareerEngine 的阶段控制，将语义理解/推理/提取交给 Alice Hermes Runtime。
 *
 * 核心原则：
 * 1. Orchestrator 决定什么时候问什么、什么时候推进
 * 2. Alice (enterpriseAgentRuntime) 只负责理解语义、提取信息
 * 3. 不要将流程控制权交给 LLM
 * 4. API 不变：前端无感知
 *
 * 调用链：
 *   processMessage()
 *     → 检查当前阶段
 *     → 构造 task 指令（含 schema 约束）
 *     → enterpriseAgentRuntime.executeTask()
 *     → 解析结构化 JSON → 更新 profile
 *     → 判断阶段推进 / 生成回复
 *
 * Fallback: 当 Alice 不可用/未配置时，回退到 JobCareerEngine
 */

import { prisma } from '../../utils/index.js'
import { buildCareerAgentContext } from './context/career-context-builder.js';
import { JobCareerEngine, CandidateProfile } from '../../agents/job/job-career-engine.js';
import { enterpriseAgentRuntime } from '../enterprise/enterprise-agent-runtime.service.js';
import { agentAuditService } from '../enterprise/agent-audit.service.js';
import { careerAgentTaskService } from '../enterprise/career-agent-task.service.js';
import { employeeCapabilityService } from '../enterprise/employee-capability.service.js';
import { CareerAgentService } from '../enterprise/workflow/career-agent.service.js';

// ─── Sprint-10D: Career Conversation Profile 已降级 ─────
// CareerIdentityProfile (career-identity/) 是唯一 SSOT

// ─── Enums & Types ──────────────────────────────────────

export enum ConversationStage {
  GREETING = 'GREETING',
  EDUCATION = 'EDUCATION',
  SKILLS = 'SKILLS',
  EXPERIENCE = 'EXPERIENCE',
  GOALS = 'GOALS',
  COMPLETE = 'COMPLETE',
}

/** 对话中收集的轻量级画像数据 */
export interface CareerProfileData {
  name?: string
  educationLevel?: string
  school?: string
  major?: string
  skills?: string[]
  yearsOfExperience?: number
  workHistory?: string[]
  currentTitle?: string
  targetRole?: string
  targetIndustry?: string
  expectedSalary?: string
}

export interface ConversationState {
  conversationId: string
  userId: string
  stage: ConversationStage
  profile: CareerProfileData
  messages: Array<{ role: string; content: string }>
  completedFields: string[]
  /** Sprint-09E-05.1 Task 03: 统一职业身份卡注入 */
  identityCard?: import('./context/career-identity-card.js').CareerIdentityCard
  currentContext?: import('./context/career-identity-card.js').CurrentCareerContext
  // ─── Sprint-09E-05.2: 对话级实时身份状态 ───
  careerState: ConversationCareerState
}

// ─── Sprint-10D T03: SessionCareerState — 仅保存聊天过程状态 ───
//
// 不再保存长期职业事实。所有事实通过 CareerIdentityProfile 管理。
//
// 生命周期：
//   消息 → extractInfoViaLLM → mergeExtractedFields
//   → careerIdentityService.mergeExtraction() → 写入 DB
//   → 下一轮 Prompt 从 DB 读取
//
export interface ConversationCareerState {
  /** 当前对话阶段 */
  conversationStage: string
  /** 本轮待提取的字段列表 */
  pendingExtraction: string[]
  /** 上一轮 AI 回复摘要（供衔接使用） */
  lastTurnSummary: string
  /** 对话中身份卡引用（仅用于 Prompt 构建，不持久化长期事实） */
  identityCard?: import('./context/career-identity-card.js').CareerIdentityCard
}

export interface ProcessMessageResult {
  reply: string
  stage: ConversationStage
  profile?: CareerProfileData
  isComplete: boolean
  tokenUsage?: { input: number; output: number }
  taskId?: string
}

// ─── Stage Definitions ──────────────────────────────────

/**
 * Sprint-09E-05.1 Task 03: 构建身份卡注入段落
 * 当 identityCard 存在时，注入到 system prompt 中
 */
// ─── Sprint-10D T02: 使用 CareerIdentityProfile 唯一入口 ───
// 不再读取 conversationProfile，所有用户事实来自 CareerAgentContext
function buildIdentityCardSection(identityCard?: import('./context/career-identity-card.js').CareerIdentityCard): string {
  if (!identityCard) return ''

  const { identity, career, skills, education, workHistory, careerGoals } = identityCard

  const lines: string[] = []

  lines.push('')
  lines.push('== 用户职业身份卡（已确认的职业资产） ==')
  lines.push('以下信息是用户已经确认的职业事实。')
  lines.push('不要重复询问用户这些信息。')
  lines.push('如果用户提供新信息，更新你的记录即可。')
  lines.push('')

  if (identity?.name) lines.push(`姓名：${identity.name}`)
  if (identity?.location) lines.push(`所在地：${identity.location}`)
  if (career.currentRole) lines.push(`当前角色：${career.currentRole}`)
  if (career.experienceYears > 0) lines.push(`工作年限：${career.experienceYears}年`)
  if (career.direction) lines.push(`职业方向：${career.direction}`)
  if (career.level) lines.push(`当前级别：${career.level}`)
  if (career.industries.length > 0) lines.push(`涉及行业：${career.industries.join('、')}`)

  if (skills.length > 0) {
    lines.push(`技能：${skills.map(s => `${s.name}(${s.level})`).join('、')}`)
  }
  if (education.length > 0) {
    lines.push(`教育背景：${education.map(e => `${e.major || '—'} @ ${e.school}${e.degree ? ` (${e.degree})` : ''}`).join('；')}`)
  }
  if (workHistory.length > 0) {
    lines.push(`工作经历：${workHistory.slice(0, 3).map(w => `${w.title} @ ${w.company}${w.isCurrent ? '（当前）' : ''}`).join('；')}`)
  }
  if (careerGoals.length > 0) lines.push(`职业目标：${careerGoals.join('；')}`)

  lines.push('')
  lines.push('== 注意事项 ==')
  lines.push('- 如果用户问"你怎么知道我的信息？"，回答"你之前告诉我的啊，我都记着呢～"')
  lines.push('- 如果用户提供的信息与以上记录冲突，以用户最新的消息为准')
  lines.push('- 如果以上信息已完整，可以直接跳过对应阶段的询问')

  return lines.join('\n')
}

interface StageDefinition {
  fields: string[]
  description: string
}

/** LLM 提取结果（含 token 用量） */
interface ExtractionResult {
  data: Record<string, any> | null
  taskId?: string
  tokenInput: number
  tokenOutput: number
}

/** 回复生成结果（含 token 用量） */
interface ReplyResult {
  reply: string
  taskId?: string
  tokenInput: number
  tokenOutput: number
}

const STAGE_DEFINITIONS: Record<ConversationStage, StageDefinition> = {
  [ConversationStage.GREETING]: {
    fields: [],
    description: '开场问候',
  },
  [ConversationStage.EDUCATION]: {
    fields: ['educationLevel', 'school', 'major'],
    description: '教育背景',
  },
  [ConversationStage.SKILLS]: {
    fields: ['skills', 'yearsOfExperience'],
    description: '技能与经验',
  },
  [ConversationStage.EXPERIENCE]: {
    fields: ['workHistory', 'currentTitle'],
    description: '工作经验',
  },
  [ConversationStage.GOALS]: {
    fields: ['targetRole', 'targetIndustry', 'expectedSalary'],
    description: '职业目标',
  },
  [ConversationStage.COMPLETE]: {
    fields: [],
    description: '完成，自由对话',
  },
}

const STAGE_ORDER: ConversationStage[] = [
  ConversationStage.GREETING,
  ConversationStage.EDUCATION,
  ConversationStage.SKILLS,
  ConversationStage.EXPERIENCE,
  ConversationStage.GOALS,
  ConversationStage.COMPLETE,
]

// ─── Schema Helpers ─────────────────────────────────────

/** 当前阶段需要的 JSON Schema（指导 LLM 输出） */
function getStageSchema(stage: ConversationStage): string {
  switch (stage) {
    case ConversationStage.GREETING:
      return JSON.stringify({ name: 'string (用户称呼，从对话中推断)' })
    case ConversationStage.EDUCATION:
      return JSON.stringify({
        educationLevel: 'string (最高学历: 博士/硕士/本科/大专/高中)',
        school: 'string (毕业院校)',
        major: 'string (专业)',
      })
    case ConversationStage.SKILLS:
      return JSON.stringify({
        skills: 'string[] (掌握的技能列表)',
        yearsOfExperience: 'number (工作年限，若无经验为0)',
      })
    case ConversationStage.EXPERIENCE:
      return JSON.stringify({
        workHistory: 'string[] (工作经历列表，每条包含公司+职位+简要)',
        currentTitle: 'string (当前职位)',
      })
    case ConversationStage.GOALS:
      return JSON.stringify({
        targetRole: 'string (目标职位)',
        targetIndustry: 'string (目标行业)',
        expectedSalary: 'string (期望薪资，如"15-20K")',
      })
    default:
      return '{}'
  }
}

/** 用户在前几个阶段已经收集到的字段摘要 */
function getCollectedSummary(profile: CareerProfileData, currentStage: ConversationStage): string {
  const parts: string[] = []
  if (profile.name) parts.push(`姓名: ${profile.name}`)
  if (profile.educationLevel) parts.push(`学历: ${profile.educationLevel}`)
  if (profile.school) parts.push(`学校: ${profile.school}`)
  if (profile.major) parts.push(`专业: ${profile.major}`)
  if (profile.skills && profile.skills.length > 0) parts.push(`技能: ${profile.skills.join(', ')}`)
  if (profile.yearsOfExperience !== undefined) parts.push(`经验年限: ${profile.yearsOfExperience}`)
  if (profile.workHistory && profile.workHistory.length > 0) parts.push(`工作经历: ${profile.workHistory.join('; ')}`)
  if (profile.currentTitle) parts.push(`当前职位: ${profile.currentTitle}`)
  if (profile.targetRole) parts.push(`目标职位: ${profile.targetRole}`)
  if (profile.targetIndustry) parts.push(`目标行业: ${profile.targetIndustry}`)
  if (profile.expectedSalary) parts.push(`期望薪资: ${profile.expectedSalary}`)
  return parts.length > 0 ? `已收集的信息：\n${parts.join('\n')}` : '尚无已收集的信息'
}

// ─── Fallback Engine Adapter ────────────────────────────

/**
 * 将 ConversationState 转换为 JobCareerEngine 的 CandidateProfile
 * 用于 fallback 路径
 */
function toCandidateProfile(state: ConversationState): Partial<CandidateProfile> {
  const p = state.profile
  return {
    name: p.name || '',
    education: p.educationLevel || '',
    major: p.major || '',
    skills: p.skills || [],
    experience: p.workHistory?.join('; ') || '',
    experienceYears: p.yearsOfExperience || 0,
    city: '',
    salaryMin: 0,
    salaryMax: 0,
    careerGoal: p.targetRole || p.targetIndustry || '',
    completeness: 0,
  }
}

/** 将 JobCareerEngine 的 InterviewStage 映射回 ConversationStage */
function mapEngineStage(engineStage: string): ConversationStage {
  const map: Record<string, ConversationStage> = {
    'GREETING': ConversationStage.GREETING,
    'EDUCATION': ConversationStage.EDUCATION,
    'SKILLS': ConversationStage.SKILLS,
    'EXPERIENCE': ConversationStage.EXPERIENCE,
    'LOCATION': ConversationStage.GOALS,
    'SALARY': ConversationStage.GOALS,
    'GOAL': ConversationStage.GOALS,
    'COMPLETE': ConversationStage.COMPLETE,
  }
  return map[engineStage] || ConversationStage.GREETING
}

// ─── System Prompts ─────────────────────────────────────

function getExtractionSystemPrompt(stage: ConversationStage, profile: CareerProfileData, identityCard?: import('./context/career-identity-card.js').CareerIdentityCard): string {
  const schema = getStageSchema(stage)
  const collected = getCollectedSummary(profile, stage)
  const identitySection = buildIdentityCardSection(identityCard)

  return `你是镜心，用户的 AI 职业伙伴，正在与用户进行对话式的职业访谈。
你的任务是从用户的对话中提取职业画像信息。

当前阶段：${STAGE_DEFINITIONS[stage].description}

${collected}
${identitySection}

请严格按以下 JSON Schema 提取信息。只返回 JSON，不要包含其他文字。
如果某字段在当前消息中没有出现，则不包含该字段。

Schema:
${schema}

注意：
- 不要编造信息，只提取用户明确说的内容
- 学历信息从用户的描述中推断，如果提到"本科"就设置 educationLevel="本科"
- 技能列表：如果用户说"做过 React 开发"则包含 "React"
- 工作年限：从 "5年" → 5, "1-2年" → 1.5
- 如果是 GREETING 阶段，尝试推断用户的称呼`
}

function getReplySystemPrompt(stage: ConversationStage, profile: CareerProfileData, identityCard?: import('./context/career-identity-card.js').CareerIdentityCard): string {
  const stageDef = STAGE_DEFINITIONS[stage]
  const collected = getCollectedSummary(profile, stage)
  const identitySection = buildIdentityCardSection(identityCard)

  const stagePrompt: Record<ConversationStage, string> = {
    [ConversationStage.GREETING]: '用户刚进入职业访谈。请热情问候，让用户介绍自己或说说想找什么样的工作。语气亲切自然。',
    [ConversationStage.EDUCATION]: '请确认用户的教育背景信息，如有缺失则询问。语气自然，不要像填表。',
    [ConversationStage.SKILLS]: '请确认用户的核心技能和经验年限。可以根据已填写的信息给一些建议。不要问选择题。',
    [ConversationStage.EXPERIENCE]: '请确认用户的工作经历。可以根据技能和经验提供一些职业洞察。',
    [ConversationStage.GOALS]: '请确认用户的职业目标。提供一些行业/岗位建议。',
    [ConversationStage.COMPLETE]: '画像已完成！可以提供综合的职业建议、岗位推荐方向，或回答用户的自由提问。',
  }

  return `你是镜心，用户的 AI 职业伙伴，正在与用户进行对话访谈。

${stagePrompt[stage]}

当前阶段：${stageDef.description}

${collected}
${identitySection}

请以自然、温暖、专业的语气回复。不要用 JSON 回复。可以：
- 总结用户提供的信息并确认是否正确
- 如果信息完整，表示已经记下并询问下一部分
- 如果信息不完整，友善地追问
- 给出有洞察力的建议

使用中文回复。`
}

// ─── Orchestrator ───────────────────────────────────────

export class CareerConversationOrchestrator {
  private careerAgentService: CareerAgentService
  /** 内存中的会话状态（快速访问） */
  private stateCache = new Map<string, ConversationState>()
  private contextCache = new Map<string, { profileId: string; instanceId: string; tenantId: string }>()

  constructor() {
    this.careerAgentService = new CareerAgentService(prisma)
  }

  // ─── Public API ──────────────────────────────────────

  /**
   * 获取或创建会话状态
   */
  async getOrCreateState(conversationId: string, userId: string): Promise<ConversationState> {
    const cacheKey = `${userId}:${conversationId}`

    // 1. 尝试缓存
    const cached = this.stateCache.get(cacheKey)
    if (cached) return cached

    // 2. 尝试从 Alice 的 Profile metadata 恢复
    const ctx = await this.getOrCreateAgentContext(userId)
    if (ctx) {
      const savedState = await this.restoreStateFromProfile(ctx.profileId)
      if (savedState) {
        this.stateCache.set(cacheKey, savedState)
        return savedState
      }
    }

    // 3. 创建新状态
    const state: ConversationState = {
      conversationId,
      userId,
      stage: ConversationStage.GREETING,
      profile: {},
      messages: [],
      completedFields: [],
      careerState: {
        conversationStage: 'initial',
        pendingExtraction: [],
        lastTurnSummary: '',
      },
    }

    // Sprint-09E-05.1 Task 03: 加载职业身份卡注入新会话
    // 即使加载失败（无 CareerProfile 或 legacy 数据），不阻塞新会话创建
    try {
      const agentCtx = await buildCareerAgentContext(userId)
      state.identityCard = agentCtx.identityCard
      state.currentContext = agentCtx.currentContext
      // Sprint-09E-05.2: 从 DB 加载的身份卡同步到 careerState
      // ─── Sprint-10D T03: 身份卡从 DB 加载，不写入 careerState ───
      state.careerState.identityCard = agentCtx.identityCard
    } catch {
      // 无 CareerProfile 或 legacy 数据时不阻塞
    }

    this.stateCache.set(cacheKey, state)
    return state
  }

  /**
   * 处理用户消息，返回 AI 回复
   */
  async processMessage(
    conversationId: string,
    userId: string,
    message: string,
    history?: Array<{ role: string; content: string }>
  ): Promise<ProcessMessageResult> {
    const state = await this.getOrCreateState(conversationId, userId)

    // 添加用户消息到历史
    state.messages.push({ role: 'user', content: message })

    // 获取 Alice Agent 上下文
    const ctx = await this.getOrCreateAgentContext(userId)

    // Sprint-09A-15: 记录对话开始事件
    if (ctx && state.messages.length === 1) {
      await agentAuditService.log({
        tenantId: ctx.tenantId,
        agentId: ctx.profileId,
        action: 'conversation.started',
        resource: 'career_conversation',
        resourceId: conversationId,
        metadata: {
          conversationId,
          userId,
          stage: state.stage,
        },
      }).catch(() => {})
    }

    // ─── Alice 可用：走 Hermes Runtime ───
    if (ctx) {
      try {
        return await this.processWithAlice(state, message, ctx)
      } catch (err) {
        console.warn('[CareerOrchestrator] Alice processing failed, falling back to engine:', (err as Error).message)
        // Fall through to engine fallback
      }
    }

    // ─── Fallback: JobCareerEngine ───
    return this.processWithEngine(state, message)
  }

  // ─── Agent Context ───────────────────────────────────

  /**
   * 获取或创建 Alice Agent 上下文
   * 返回 { profileId, instanceId, tenantId } 或 null
   */
  /**
   * Sprint-09A-10: 确保 profile 已绑定 career_agent capability
   */

  /**
   * Sprint-10 T01: 读取 subscription provisioning 状态
   * 返回 provisioning 状态 + 错误信息（如有）
   * 'not_found' = 无订阅/套餐未配置
   * 'active' = 正常（含 legacy 无 metadata）
   */
  private async getProvisioningStatus(userId: string): Promise<{
    status: 'active' | 'failed' | 'pending' | 'provisioning' | 'not_found'
    error?: string
  }> {
    try {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { code: 'career_agent' } })
      if (!plan) return { status: 'not_found' }

      const sub = await prisma.subscription.findFirst({
        where: { tenantId: userId, planId: plan.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
      })
      if (!sub) return { status: 'not_found' }
      if (!sub.metadata) return { status: 'active' } // legacy: 无 metadata 视为 active

      let meta: any = {}
      try { meta = JSON.parse(sub.metadata) } catch { return { status: 'active' } }

      const ps = meta.provisioningStatus
      if (ps === 'failed') {
        return { status: 'failed', error: meta.provisioningError || 'Agent 创建失败，请联系客服重试' }
      }
      if (ps === 'pending' || ps === 'provisioning') {
        return { status: ps }
      }
      return { status: 'active' }
    } catch {
      return { status: 'not_found' }
    }
  }

  private async ensureCapabilityBound(ctx: { profileId: string; tenantId: string }): Promise<void> {
    try {
      // 1. 确保 capability 定义存在
      const existingDef = await employeeCapabilityService.getCapability('career_agent')
      if (!existingDef) {
        await employeeCapabilityService.createCapability({
          code: 'career_agent',
          name: 'AI 职业顾问',
          category: 'agent',
          description: 'Career conversation AI agent capability',
        })
      }

      // 2. 检查是否已绑定
      const hasCap = await employeeCapabilityService.hasCapability(ctx.profileId, 'career_agent')
      if (hasCap) return

      // 3. 绑定 career_agent capability
      // Sprint-09B-2B: career_agent 是平台级能力（镜心基础服务），跳过企业套餐检查
      const bound = await employeeCapabilityService.bindCapability({
        tenantId: ctx.tenantId,
        employeeId: ctx.profileId,
        capabilityCode: 'career_agent',
        grantedBy: 'orchestrator_auto_bind',
        skipEntitlementCheck: true,
      })

      if (bound) {
        // Audit: capability bound
        await agentAuditService.log({
          tenantId: ctx.tenantId,
          agentId: ctx.profileId,
          action: 'capability.bound',
          resource: 'employee_capability_binding',
          metadata: { capability: 'career_agent', source: 'orchestrator_auto_bind' },
        })
      }
    } catch (err: any) {
      // Audit: capability bind failed
      await agentAuditService.log({
        tenantId: ctx.tenantId,
        agentId: ctx.profileId,
        action: 'capability.bind_failed',
        resource: 'employee_capability_binding',
        metadata: { capability: 'career_agent', error: err.message, source: 'orchestrator_auto_bind' },
      }).catch(() => {})
      console.warn('[CareerOrchestrator] ensureCapabilityBound failed:', err.message)
    }
  }

  private async getOrCreateAgentContext(userId: string): Promise<{ profileId: string; instanceId: string; tenantId: string } | null> {
    // 检查已有缓存
    if (this.contextCache.has(userId)) {
      return this.contextCache.get(userId)!
    }

    try {
      // Sprint-10 T01: 检查 provisioning 状态 — 已失败时不再自动重试
      const provStatus = await this.getProvisioningStatus(userId)
      if (provStatus.status === 'failed') {
        console.warn(`[CareerOrchestrator] provisioning 已失败，不自动重试: userId=${userId.slice(0, 8)}, error=${provStatus.error}`)
        return null
      }

      // 查找已存在的 Career Agent
      const agent = await this.careerAgentService.getCareerAgent(userId)
      if (agent && agent.status === 'active') {
        // Verify instance is active
        const instance = await prisma.enterpriseAgentInstance.findUnique({
          where: { employeeId: agent.profileId }
        })
        if (instance && instance.runtimeStatus === 'active' && instance.lifecycleState === 'ACTIVE') {
          const ctx = { profileId: agent.profileId, instanceId: agent.instanceId, tenantId: instance.tenantId }
          // Sprint-09A-10: 确保 career_agent capability 已绑定
          await this.ensureCapabilityBound(ctx)
          this.contextCache.set(userId, ctx)
          return ctx
        }
      }

      // Sprint-10 T01: pending/provisioning → 不自动重试，等待 provisioning 完成
      if (provStatus.status === 'pending' || provStatus.status === 'provisioning') {
        console.log(`[CareerOrchestrator] provisioning 进行中，跳过自动创建: userId=${userId.slice(0, 8)}, status=${provStatus.status}`)
        return null
      }

      // 无 provisioning 记录或未激活（legacy user）→ 尝试创建
      try {
        const newAgent = await this.careerAgentService.createAndDeploy({ userId })
        if (newAgent && newAgent.status === 'active') {
          const ctx = { profileId: newAgent.profileId, instanceId: newAgent.instanceId, tenantId: userId }
          await this.ensureCapabilityBound(ctx)
          this.contextCache.set(userId, ctx)
          return ctx
        }
      } catch (createErr) {
        console.warn(`[CareerOrchestrator] createAndDeploy 失败: userId=${userId.slice(0, 8)}, error=${(createErr as Error).message}`)
        return null
      }

      return null
    } catch (err) {
      console.warn('[CareerOrchestrator] getOrCreateAgentContext failed:', (err as Error).message)
      return null
    }
  }

  // ─── Alice Processing ────────────────────────────────

  private async processWithAlice(
    state: ConversationState,
    message: string,
    ctx: { profileId: string; instanceId: string; tenantId: string }
  ): Promise<ProcessMessageResult> {
    const cacheKey = `${state.userId}:${state.conversationId}`

    // Sprint-09A-15: 累积 token 用量
    let totalTokenInput = 0
    let totalTokenOutput = 0
    let lastTaskId: string | undefined

    // Step 1: 提取信息（通过 LLM）
    if (state.stage !== ConversationStage.COMPLETE) {
      const extractionResult = await this.extractInfoViaLLM(state, message, ctx)
      if (extractionResult) {
        totalTokenInput += extractionResult.tokenInput || 0
        totalTokenOutput += extractionResult.tokenOutput || 0
        lastTaskId = extractionResult.taskId
        this.mergeExtractedFields(state, extractionResult.data || {}, message, ctx)

        // ─── Sprint-10D T03: 事实提取由 career-identity 模块处理 ───
        // 不再写入 conversationProfile / careerState.confirmedFacts，所有事实通过 careerIdentityService
      }
    }

    // Step 2: 判断阶段推进
    const shouldAdvance = state.stage !== ConversationStage.COMPLETE && this.isStageComplete(state)
    if (shouldAdvance) {
      const prevStage = state.stage
      this.advanceStage(state)
      // Task 03: 阶段推进时同步到 CareerProfile（通过 ExtractionService 信任层）
      await this.syncToCareerProfile(state, message)
    }

    // Step 3: 生成回复（传入最新的 conversation identityCard）
    const replyResult = await this.generateReplyViaLLM(state, message, ctx)
    totalTokenInput += replyResult.tokenInput || 0
    totalTokenOutput += replyResult.tokenOutput || 0
    if (replyResult.taskId) lastTaskId = replyResult.taskId

    // Step 4: 添加回复到历史
    state.messages.push({ role: 'assistant', content: replyResult.reply })

    // Step 5: 如果完成，更新 CareerProfile（通过 ExtractionService 信任层）
    if (state.stage === ConversationStage.COMPLETE) {
      await this.syncToCareerProfile(state, message)

      // Sprint-09A-15: Task 3 — 会话级审计摘要
      await agentAuditService.log({
        tenantId: ctx.tenantId,
        agentId: ctx.profileId,
        action: 'conversation.completed',
        resource: 'career_conversation',
        resourceId: state.conversationId,
        metadata: {
          conversationId: state.conversationId,
          userId: state.userId,
          messageCount: state.messages.length,
          stagesCompleted: [...state.completedFields],
          fieldsCollected: Object.keys(state.profile).length,
          profile: state.profile,
        },
      }).catch(() => {})
    }

    // Step 6: 持久化
    await this.persistState(state, ctx)

    // 更新缓存
    this.stateCache.set(cacheKey, state)

    return {
      reply: replyResult.reply,
      stage: state.stage,
      profile: state.profile,
      isComplete: state.stage === ConversationStage.COMPLETE,
      tokenUsage: { input: totalTokenInput, output: totalTokenOutput },
      taskId: lastTaskId,
    }
  }

  /**
   * 通过 Alice Hermes Runtime 提取信息
   * 调用 enterpriseAgentRuntime.executeTask()
   */
  private async extractInfoViaLLM(
    state: ConversationState,
    message: string,
    ctx: { profileId: string; instanceId: string; tenantId: string }
  ): Promise<ExtractionResult | null> {
    const stage = state.stage
    const conversationIdentityCard = state.careerState.identityCard || state.identityCard
    const systemPrompt = getExtractionSystemPrompt(stage, state.profile, conversationIdentityCard)
    const instruction = `当前阶段：${STAGE_DEFINITIONS[stage].description}

${getCollectedSummary(state.profile, stage)}

用户消息：${message}

请提取 JSON。`

    try {
      // 创建 Task 记录
      const task = await prisma.enterpriseAgentTask.create({
        data: {
          tenantId: ctx.tenantId,
          agentInstanceId: ctx.instanceId,
          taskType: 'profile_extraction',
          inputSummary: instruction.slice(0, 500),
          status: 'running',
          startedAt: new Date(),
        }
      })

      // 通过 enterpriseAgentRuntime 执行（走 Hermes Runtime → LLM）
      const result = await enterpriseAgentRuntime.executeTask({
        taskId: task.id,
        profileId: ctx.profileId,
        tenantId: ctx.tenantId,
        organizationId: ctx.tenantId, // Sprint-10 T02: personal tenant orgId = tenantId
        userId: state.userId,
        taskType: 'profile_extraction',
        instruction,
        businessType: 'career_agent',
      })

      if (!result.success || !result.output) {
        console.warn('[CareerOrchestrator] LLM extraction returned no output')
        return null
      }

      // 解析 JSON（LLM 可能返回 markdown 包裹的 JSON）
      let jsonStr = result.output.trim()
      // 移除可能的 markdown code block
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
      }

      let parsed: Record<string, any>
      try {
        parsed = JSON.parse(jsonStr)
      } catch {
        // 尝试寻找 JSON 对象边界
        const firstBrace = jsonStr.indexOf('{')
        const lastBrace = jsonStr.lastIndexOf('}')
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          try {
            parsed = JSON.parse(jsonStr.slice(firstBrace, lastBrace + 1))
          } catch {
            console.warn('[CareerOrchestrator] Failed to parse LLM JSON output')
            return null
          }
        } else {
          return null
        }
      }

      // Sprint-09A-15: Task 2 — 创建 profile_extraction EnterpriseOutcome
      if (parsed && Object.keys(parsed).length > 0) {
        try {
          const decisionId = `prof_ext_${task.id.slice(0, 8)}`
          let rec = await prisma.enterpriseRecommendation.findUnique({ where: { id: decisionId } })
          if (!rec) {
            rec = await prisma.enterpriseRecommendation.create({
              data: {
                id: decisionId,
                tenantId: ctx.tenantId,
                category: 'profile_extraction',
                title: `画像提取: ${STAGE_DEFINITIONS[state.stage].description}`,
                status: 'completed',
                priority: 2,
              },
            })
          }
          const extractionAction = await prisma.enterpriseAction.create({
            data: {
              tenantId: ctx.tenantId,
              decisionId,
              title: `画像提取: ${STAGE_DEFINITIONS[state.stage].description}`,
              description: `提取了 ${Object.keys(parsed).length} 个字段: ${Object.keys(parsed).join(', ')}`,
              status: 'completed',
              ownerType: 'agent',
              ownerId: ctx.profileId,
            },
          })
          await prisma.enterpriseOutcome.create({
            data: {
              tenantId: ctx.tenantId,
              governanceTenantId: ctx.tenantId,
              actionId: extractionAction.id,
              outcomeType: 'profile_extraction',
              sourceType: 'agent',
              status: 'VERIFIED',
              summary: `提取了 ${Object.keys(parsed).length} 个字段: ${Object.keys(parsed).join(', ')}`,
              evidence: JSON.stringify({
                taskId: task.id,
                stage: state.stage,
                extractedFields: parsed,
                tokensUsed: result.tokenInput + result.tokenOutput,
                durationMs: result.durationMs,
              }),
              occurredAt: new Date(),
              verifiedAt: new Date(),
            },
          })
          // Audit: outcome generated for career extraction
          await agentAuditService.log({
            tenantId: ctx.tenantId,
            agentId: ctx.profileId,
            taskId: result.taskId,
            action: 'outcome.generated',
            resource: 'enterprise_outcome',
            resourceId: extractionAction.id,
            metadata: {
              outcomeType: 'profile_extraction',
              status: 'VERIFIED',
              fieldsExtracted: Object.keys(parsed).length,
              stage: state.stage,
            },
          }).catch(() => {})
        } catch (outcomeErr: any) {
          console.warn('[CareerOrchestrator] profile_extraction outcome creation failed:', outcomeErr.message)
        }
      }

      return { data: parsed, taskId: result.taskId, tokenInput: result.tokenInput, tokenOutput: result.tokenOutput }
    } catch (err) {
      console.warn('[CareerOrchestrator] extractInfoViaLLM error:', (err as Error).message)
      return null
    }
  }

  /**
   * 通过 Alice Hermes Runtime 生成回复
   */

  /**
   * Sprint-10 Step 3B T05: 注入最近自治任务结果到 Agent 上下文
   * 用户问"有什么新的机会"时，Agent 能感知到上次任务结果
   */
  private async injectTaskMemory(instanceId: string, prompt: string): Promise<string> {
    try {
      const recentTasks = await careerAgentTaskService.getRecentCompletedTasks(instanceId, 3)
      if (!recentTasks || recentTasks.length === 0) return prompt
      const lines = recentTasks.map((t: any) => {
        let summary = ''
        if (t.result) {
          try {
            const p = JSON.parse(t.result)
            summary = p.summary || (p.output ? p.output.slice(0, 300) : '')
          } catch { summary = t.result.slice(0, 300) }
        }
        return '-' + t.taskType + ' (' + new Date(t.createdAt).toLocaleDateString('zh-CN') + '): ' + (summary || '已完成')
      }).join('\\n')
      return prompt + '\\n\\n## 我最近执行的任务\\n' + lines + '\\n'
    } catch { return prompt }
  }

    private async generateReplyViaLLM(
    state: ConversationState,
    _message: string,
    ctx: { profileId: string; instanceId: string; tenantId: string }
  ): Promise<ReplyResult> {
    const conversationIdentityCard = state.careerState.identityCard || state.identityCard
    const basePrompt = getReplySystemPrompt(state.stage, state.profile, conversationIdentityCard)
    const systemPrompt = await this.injectTaskMemory(ctx.instanceId, basePrompt)

    try {
      const task = await prisma.enterpriseAgentTask.create({
        data: {
          tenantId: ctx.tenantId,
          agentInstanceId: ctx.instanceId,
          taskType: 'generate_reply',
          inputSummary: systemPrompt.slice(0, 500),
          status: 'running',
          startedAt: new Date(),
        }
      })

      const result = await enterpriseAgentRuntime.executeTask({
        taskId: task.id,
        profileId: ctx.profileId,
        tenantId: ctx.tenantId,
        organizationId: ctx.tenantId, // Sprint-10 T02: personal tenant orgId = tenantId
        userId: state.userId,
        taskType: 'generate_reply',
        instruction: systemPrompt,
        businessType: 'career_agent',
      })

      if (result.success && result.output) {
        return {
          reply: result.output.trim(),
          taskId: result.taskId,
          tokenInput: result.tokenInput,
          tokenOutput: result.tokenOutput,
        }
      }
    } catch (err) {
      console.warn('[CareerOrchestrator] generateReplyViaLLM error:', (err as Error).message)
    }

    // Fallback reply — no token usage available
    return {
      reply: this.generateFallbackReply(state),
      tokenInput: 0,
      tokenOutput: 0,
    }
  }

  /**
   * 合并 LLM 提取的字段到状态
   */
  /**
   * Sprint-09E-02: 合并 LLM 提取字段到内存状态
   * 应用 ExtractionService 信任过滤，仅将可信字段写入 state.profile。
   * DB 写入在 syncToCareerProfile 中再次校验。
   */
  private mergeExtractedFields(
    state: ConversationState,
    extracted: Record<string, any>,
    userMessage: string,
    ctx: { profileId: string }
  ): void {
    const stage = state.stage
    const profile = state.profile

    // 1️⃣ 信任过滤：检查提取字段的可信度
    const trustedFieldNames = this.filterTrustedFields(extracted, userMessage)

    // 2️⃣ 仅合并可信字段
    if (trustedFieldNames.has('name') && typeof extracted.name === 'string' && extracted.name && !profile.name) {
      profile.name = extracted.name
      this.markFieldCompleted(state, 'name')
    }

    // 阶段特定字段
    switch (stage) {
      case ConversationStage.EDUCATION:
      case ConversationStage.GREETING:
        if (trustedFieldNames.has('educationLevel') && typeof extracted.educationLevel === 'string' && extracted.educationLevel) {
          profile.educationLevel = extracted.educationLevel
          this.markFieldCompleted(state, 'educationLevel')
        }
        if (trustedFieldNames.has('school') && typeof extracted.school === 'string' && extracted.school) {
          profile.school = extracted.school
          this.markFieldCompleted(state, 'school')
        }
        if (trustedFieldNames.has('major') && typeof extracted.major === 'string' && extracted.major) {
          profile.major = extracted.major
          this.markFieldCompleted(state, 'major')
        }
        break

      case ConversationStage.SKILLS:
        if (trustedFieldNames.has('skills') && Array.isArray(extracted.skills) && extracted.skills.length > 0) {
          profile.skills = [...new Set([...(profile.skills || []), ...extracted.skills])]
          this.markFieldCompleted(state, 'skills')
        }
        if (trustedFieldNames.has('yearsOfExperience') && typeof extracted.yearsOfExperience === 'number') {
          profile.yearsOfExperience = extracted.yearsOfExperience
          this.markFieldCompleted(state, 'yearsOfExperience')
        }
        break

      case ConversationStage.EXPERIENCE:
        if (trustedFieldNames.has('workHistory') && Array.isArray(extracted.workHistory) && extracted.workHistory.length > 0) {
          profile.workHistory = [...new Set([...(profile.workHistory || []), ...extracted.workHistory])]
          this.markFieldCompleted(state, 'workHistory')
        }
        if (trustedFieldNames.has('currentTitle') && typeof extracted.currentTitle === 'string' && extracted.currentTitle) {
          profile.currentTitle = extracted.currentTitle
          this.markFieldCompleted(state, 'currentTitle')
        }
        break

      case ConversationStage.GOALS:
        if (trustedFieldNames.has('targetRole') && typeof extracted.targetRole === 'string' && extracted.targetRole) {
          profile.targetRole = extracted.targetRole
          this.markFieldCompleted(state, 'targetRole')
        }
        if (trustedFieldNames.has('targetIndustry') && typeof extracted.targetIndustry === 'string' && extracted.targetIndustry) {
          profile.targetIndustry = extracted.targetIndustry
          this.markFieldCompleted(state, 'targetIndustry')
        }
        if (trustedFieldNames.has('expectedSalary') && typeof extracted.expectedSalary === 'string' && extracted.expectedSalary) {
          profile.expectedSalary = extracted.expectedSalary
          this.markFieldCompleted(state, 'expectedSalary')
        }
        break
    }
  }

  /**
   * 信任过滤器：对 LLM 提取的字段应用规则，只通过可信字段
   */
  private filterTrustedFields(
    extracted: Record<string, any>,
    userMessage: string
  ): Set<string> {
    const trusted = new Set<string>()

    for (const [key, value] of Object.entries(extracted)) {
      // 基础存在性检查
      if (value === undefined || value === null) continue

      switch (key) {
        case 'name':
        case 'fullName':
          // name 必须有用户名表达
          if (/我叫|我是|名字|姓名/.test(userMessage)) trusted.add(key)
          break

        case 'yearsOfExperience':
        case 'yearsExperience': {
          const numVal = Number(value)
          if (isNaN(numVal)) break
          // 检测年龄混淆：消息中有年龄表达且值接近年龄
          const ageMatch = userMessage.match(/(\d{1,2})(?:岁|周岁)/)
          if (ageMatch && numVal >= parseInt(ageMatch[1]) - 5) break
          // 有明确的年限表达才信任
          if (/年经验|年工作|年从业|年做/.test(userMessage)) trusted.add(key)
          break
        }

        case 'industry':
        case 'targetIndustry':
          // industry 只信任用户显式说的
          if (/行业|做.*的|从事/.test(userMessage)) trusted.add(key)
          break

        case 'skills': {
          if (!Array.isArray(value)) break
          // 至少有一个技能在用户消息中出现过
          const userMentioned = value.filter((s: unknown) =>
            typeof s === 'string' && userMessage.includes(s)
          )
          if (userMentioned.length > 0) trusted.add(key)
          break
        }

        case 'workHistory': {
          if (!Array.isArray(value)) break
          // 检测编造公司名
          const fakeDetected = value.some((w: any) => {
            const company = w?.company || ''
            return /某公司|某企业|示例|测试/.test(company)
          })
          if (fakeDetected) break
          // 用户消息中有公司/工作相关表达
          if (/公司|工作|做.*项目|负责|担任/.test(userMessage)) trusted.add(key)
          break
        }

        case 'educationLevel':
          if (/本科|硕士|博士|大专|学历/.test(userMessage)) trusted.add(key)
          break

        case 'school':
        case 'major':
          if (typeof value === 'string' && userMessage.includes(value)) trusted.add(key)
          break

        case 'targetRole':
        case 'currentTitle':
        case 'headline':
          // 通用表达信任
          if (typeof value === 'string' && userMessage.includes(value)) trusted.add(key)
          break

        case 'expectedSalary':
          if (/薪资|薪水|工资|期望/.test(userMessage)) trusted.add(key)
          break

        default:
          // 未知字段保守处理：仅在消息中有值时信任
          if (typeof value === 'string' && userMessage.includes(value)) trusted.add(key)
          break
      }
    }

    // 日志：汇报被过滤的字段
    const rejected = Object.keys(extracted).filter(k => !trusted.has(k))
    if (rejected.length > 0) {
      console.log(`[ExtractTrust] filtered fields: ${rejected.join(', ')} from msg: ${userMessage.slice(0, 50)}`)
    }

    return trusted
  }

  /**
   * 标记字段已完成收集
   */
  private markFieldCompleted(state: ConversationState, field: string): void {
    if (!state.completedFields.includes(field)) {
      state.completedFields.push(field)
    }
  }

  // ─── Stage Control ───────────────────────────────────

  /**
   * 判断当前阶段是否已完成字段收集
   */
  private isStageComplete(state: ConversationState): boolean {
    const stageDef = STAGE_DEFINITIONS[state.stage]

    // GREETING: 用户首次回复后自动推进
    if (state.stage === ConversationStage.GREETING) {
      return state.messages.some(m => m.role === 'user')
    }

    // COMPLETE: 永远完成
    if (state.stage === ConversationStage.COMPLETE) {
      return true
    }

    // 其他阶段：所有必填字段都已收集
    for (const field of stageDef.fields) {
      if (!state.completedFields.includes(field)) {
        return false
      }
    }

    return true
  }

  /**
   * 推进到下一阶段
   */
  private advanceStage(state: ConversationState): void {
    const currentIndex = STAGE_ORDER.indexOf(state.stage)
    if (currentIndex < STAGE_ORDER.length - 1) {
      state.stage = STAGE_ORDER[currentIndex + 1]
    }
  }

  // ─── CareerProfile Sync ─────────────────────────────

  /**
   * Task 03: 将对话中收集的画像数据同步到 CareerProfile 表
   * 在阶段推进或对话结束时调用
   */
  /**
   * Sprint-09E-02: 通过 ExtractionService 信任层同步到 CareerProfile
   * 不再直接写 DB — 只将 Confirmed Facts 写入 CareerProfile，
   * AI 推断进入 Derived Insights。
   */
  private async syncToCareerProfile(state: ConversationState, lastUserMessage?: string): Promise<void> {
    if (state.userId === 'anonymous') return

    try {
      const p = state.profile

      // 将 profile 中的字段转为统一提取格式
      const rawFields: Array<{ name: string; value: unknown }> = []
      if (p.name) rawFields.push({ name: 'fullName', value: p.name })
      if (p.currentTitle) rawFields.push({ name: 'headline', value: p.currentTitle })
      if (p.targetRole) rawFields.push({ name: 'careerDirection', value: p.targetRole })
      if (p.targetIndustry) rawFields.push({ name: 'industry', value: p.targetIndustry })
      if (p.yearsOfExperience !== undefined) rawFields.push({ name: 'yearsExperience', value: p.yearsOfExperience })
      if (p.educationLevel) rawFields.push({ name: 'educationLevel', value: p.educationLevel })
      if (p.school) rawFields.push({ name: 'school', value: p.school })
      if (p.major) rawFields.push({ name: 'major', value: p.major })
      if (p.skills && p.skills.length > 0) rawFields.push({ name: 'skills', value: p.skills })
      if (p.workHistory && p.workHistory.length > 0) rawFields.push({ name: 'workHistory', value: p.workHistory })

      if (rawFields.length === 0) return

      // 通过 ExtractionService 信任过滤
      const { CareerExtractionService } = require('./career-extraction.service.js')
      const extractionService = new CareerExtractionService()
      const existing = await prisma.careerProfile.findFirst({ where: { userId: state.userId } })
      const result = await extractionService.processExtraction(
        rawFields,
        lastUserMessage || '（同步）',
        existing as any
      )

      // 写入 Confirmed Facts
      await extractionService.writeToProfile(state.userId, result)

      // 添加 Derived Insights
      await extractionService.addDerivedInsights(state.userId, result)

      // 日志：汇报过滤结果
      if (result.ignored.length > 0 || result.derivedSuggestions.length > 0) {
        console.log(`[CareerOrchestrator] syncToProfile: ${
          result.confirmedFacts.length} written, ${
          result.derivedSuggestions.length} suggested, ${
          result.ignored.length} ignored`)
      }

      // Sprint-09E-05.1 Task 04: 同步 CandidateCard（人才市场卡片）
      // 遵循「不要复制数据，只引用 careerProfileId」原则
      await this.syncCandidateCard(state.userId).catch(err => {
        console.warn('[CareerOrchestrator] syncCandidateCard error:', (err as Error).message)
      })
    } catch (err) {
      console.warn('[CareerOrchestrator] syncToCareerProfile error:', (err as Error).message)
    }
  }

  /**
   * Sprint-09E-05.1 Task 04: 同步人才市场卡片
   * 基于 CareerProfile 最新数据，创建或更新 CandidateCard
   * 遵循「不要复制数据，只引用 careerProfileId」原则
   */
  private async syncCandidateCard(userId: string): Promise<void> {
    const profile = await prisma.careerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        headline: true,
        yearsExperience: true,
        city: true,
        currentLevel: true,
        skills: {
          select: {
            skill: { select: { name: true } },
          },
          take: 10,
          orderBy: { level: 'desc' as const },
        },
        workExperiences: {
          select: { company: true, title: true },
          where: { isCurrent: true },
          take: 1,
        },
      },
    })

    if (!profile) return

    const currentWork = profile.workExperiences[0]
    const skillNames = profile.skills.map(s => s.skill.name)

    await prisma.candidateCard.upsert({
      where: { profileId: profile.id },
      create: {
        profileId: profile.id,
        headline: profile.headline || currentWork?.title || '',
        skillTags: skillNames,
        yearsExperience: profile.yearsExperience,
        currentCity: profile.city || undefined,
        currentCompany: currentWork?.company || undefined,
        currentTitle: currentWork?.title || profile.currentLevel || undefined,
      },
      update: {
        headline: profile.headline || currentWork?.title || '',
        skillTags: skillNames,
        yearsExperience: profile.yearsExperience,
        currentCity: profile.city || undefined,
        currentCompany: currentWork?.company || undefined,
        currentTitle: currentWork?.title || profile.currentLevel || undefined,
      },
    })
  }

  // ─── State Persistence ───────────────────────────────

  /**
   * 保存会话状态到 EnterpriseAgentProfile.metadata
   */
  private async persistState(state: ConversationState, ctx: { profileId: string }): Promise<void> {
    try {
      const profile = await prisma.enterpriseAgentProfile.findUnique({
        where: { id: ctx.profileId },
        select: { metadata: true },
      })
      if (!profile) return

      let metadata: Record<string, any> = {}
      try {
        metadata = JSON.parse(profile.metadata || '{}')
      } catch { /* ignore */ }

      // Sprint-10D T03: 仅保存对话过程状态，不保存长期事实
      metadata.careerConversation = {
        conversationId: state.conversationId,
        userId: state.userId,
        stage: state.stage,
        profile: state.profile,
        completedFields: state.completedFields,
        // 只保存最后 10 条消息（避免 metadata 膨胀）
        messages: state.messages.slice(-10),
        updatedAt: new Date().toISOString(),
        careerState: {
          conversationStage: state.careerState.conversationStage,
          pendingExtraction: state.careerState.pendingExtraction,
          lastTurnSummary: state.careerState.lastTurnSummary,
        },
      }

      await prisma.enterpriseAgentProfile.update({
        where: { id: ctx.profileId },
        data: { metadata: JSON.stringify(metadata) },
      })
    } catch (err) {
      console.warn('[CareerOrchestrator] persistState error:', (err as Error).message)
    }
  }

  /**
   * 从 EnterpriseAgentProfile.metadata 恢复会话状态
   */
  private async restoreStateFromProfile(profileId: string): Promise<ConversationState | null> {
    try {
      const profile = await prisma.enterpriseAgentProfile.findUnique({
        where: { id: profileId },
        select: { metadata: true },
      })
      if (!profile) return null

      const metadata: Record<string, any> = JSON.parse(profile.metadata || '{}')
      const saved = metadata.careerConversation
      if (!saved) return null

      return {
        conversationId: saved.conversationId,
        userId: saved.userId,
        stage: saved.stage || ConversationStage.GREETING,
        profile: saved.profile || {},
        messages: saved.messages || [],
        completedFields: saved.completedFields || [],
        careerState: saved.careerState || {
          conversationStage: 'initial',
          pendingExtraction: [],
          lastTurnSummary: '',
        },
      }
    } catch {
      return null
    }
  }

  // ─── Fallback: JobCareerEngine ────────────────────────

  /**
   * 使用 JobCareerEngine 处理（fallback 路径）
   */
  private async processWithEngine(state: ConversationState, message: string): Promise<ProcessMessageResult> {
    const engine = new JobCareerEngine(toCandidateProfile(state))
    const result = engine.processMessage(message)

    // 将 engine 的结果映射回我们的状态
    state.profile = {
      name: result.profile.name || state.profile.name,
      educationLevel: result.profile.education || state.profile.educationLevel,
      major: result.profile.major || state.profile.major,
      skills: result.profile.skills || state.profile.skills,
      yearsOfExperience: result.profile.experienceYears || state.profile.yearsOfExperience,
      workHistory: result.profile.experience ? [result.profile.experience] : state.profile.workHistory,
      currentTitle: result.profile.careerGoal || state.profile.currentTitle,
      targetRole: result.profile.careerGoal || state.profile.targetRole,
      targetIndustry: state.profile.targetIndustry,
      expectedSalary: result.profile.salaryMin ? `${result.profile.salaryMin}-${result.profile.salaryMax}K` : state.profile.expectedSalary,
    }

    // 更新阶段
    const mappedStage = mapEngineStage(result.stage)
    state.stage = mappedStage

    // 更新完成字段（简单处理）
    this.updateCompletedFieldsFromEngine(state, result.profile)

    state.messages.push({ role: 'assistant', content: result.reply })

    return {
      reply: result.reply,
      stage: mappedStage,
      profile: state.profile,
      isComplete: result.isComplete,
    }
  }

  private updateCompletedFieldsFromEngine(state: ConversationState, profile: CandidateProfile): void {
    if (profile.name) this.markFieldCompleted(state, 'name')
    if (profile.education) this.markFieldCompleted(state, 'educationLevel')
    if (profile.major) this.markFieldCompleted(state, 'major')
    if (profile.skills && profile.skills.length > 0) this.markFieldCompleted(state, 'skills')
    if (profile.experienceYears > 0) this.markFieldCompleted(state, 'yearsOfExperience')
    if (profile.experience) this.markFieldCompleted(state, 'workHistory')
    if (profile.city) this.markFieldCompleted(state, 'targetRole')
  }

  // ─── Reply Generator (Fallback) ──────────────────────

  private generateFallbackReply(state: ConversationState): string {
    const stage = state.stage
    const p = state.profile

    switch (stage) {
      case ConversationStage.GREETING:
        return '你好！我是镜心，你的 AI 职业伙伴 🪞\n\n我会通过几个问题了解你的情况，帮你发现最适合的职业机会。\n\n先告诉我，你希望我怎么称呼你？'

      case ConversationStage.EDUCATION: {
        const name = p.name || '朋友'
        if (!p.educationLevel) return `${name}，你的最高学历是什么？（本科/硕士/博士/大专）`
        if (!p.school || !p.major) return `${name}，你毕业的院校和专业是什么？`
        return `好的${name}，${p.educationLevel}学历，${p.school} ${p.major}专业，记下了！接下来聊聊你的技能情况吧。`
      }

      case ConversationStage.SKILLS: {
        if (!p.skills || p.skills.length === 0) return '你掌握哪些技能？比如编程语言、工具、框架等，可以列举一下。'
        if (p.yearsOfExperience === undefined) return '你有几年的工作经验？'
        return `技能方面我记下了：${p.skills.join('、')}，${p.yearsOfExperience}年经验。接下来聊聊你的工作经历吧。`
      }

      case ConversationStage.EXPERIENCE: {
        if (!p.workHistory || p.workHistory.length === 0) return '能简单介绍一下你的工作经历吗？在哪些公司做过什么岗位？'
        if (!p.currentTitle) return '你当前的职位是什么？'
        return '工作经历了解了！接下来聊聊你的职业目标吧。'
      }

      case ConversationStage.GOALS: {
        const name = p.name || '朋友'
        if (!p.targetRole) return `${name}，你未来想做什么方向的岗位？`
        if (!p.targetIndustry) return `你对哪个行业比较感兴趣？`
        if (!p.expectedSalary) return `你的期望薪资大概是多少？`
        return `太棒了！我已经收集完了你的职业信息，正在为你匹配最合适的岗位...`
      }

      case ConversationStage.COMPLETE:
        return '你的职业画像已经完成了！有什么想问的吗？我可以帮你推荐岗位、分析简历，或者聊聊职业规划。'

      default:
        return '请继续说说你的情况吧。'
    }
  }

  // ─── Cleanup ─────────────────────────────────────────

  /**
   * 清除缓存的会话状态
   */
  clearCache(userId?: string): void {
    if (userId) {
      // 清除该用户的所有缓存
      for (const key of this.stateCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.stateCache.delete(key)
        }
      }
      this.contextCache.delete(userId)
    } else {
      this.stateCache.clear()
      this.contextCache.clear()
    }
  }
}

// ─── Singleton ──────────────────────────────────────────

export const careerConversationOrchestrator = new CareerConversationOrchestrator()
