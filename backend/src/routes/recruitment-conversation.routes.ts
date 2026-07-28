/**
 * Sprint-08B: Recruitment Conversation Domain
 * 
 * 招聘会话 API — 企业 AI 主动发起招聘会话的核心接口
 * 
 * Conversation Ownership:
 * - Recruiter Agent 拥有会话创建和回答权
 * - Career Agent 只能作为幕后 Advisor（通过 metadata.advisorInput 注入）
 * - HR 通过 Human Review Queue 接管
 * 
 * Status Lifecycle:
 * DISCOVERED → INVITED → CHATTING → AI_EVALUATING → WAITING_HR_REVIEW → HR_CONTACTING → INTERVIEW → OFFER → HIRED / REJECTED
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { resolveCurrentEnterprise, requireEnterpriseWorkspaceContext } from '../services/enterprise-context.service.js'
import { prisma } from '../utils/index.js'

// Sprint 13: Security P0 — 改用共享 PrismaClient 单例，替代独立 new PrismaClient()

// ─── Status Constants ───
const STATUS = {
  DISCOVERED: 'DISCOVERED',
  INVITED: 'INVITED',
  CHATTING: 'CHATTING',
  AI_EVALUATING: 'AI_EVALUATING',
  WAITING_HR_REVIEW: 'WAITING_HR_REVIEW',
  HR_CONTACTING: 'HR_CONTACTING',
  INTERVIEW: 'INTERVIEW',
  OFFER: 'OFFER',
  HIRED: 'HIRED',
  REJECTED: 'REJECTED',
} as const

const VALID_TRANSITIONS: Record<string, string[]> = {
  DISCOVERED: ['INVITED', 'REJECTED'],
  INVITED: ['CHATTING', 'REJECTED'],
  CHATTING: ['AI_EVALUATING', 'REJECTED'],
  AI_EVALUATING: ['WAITING_HR_REVIEW', 'CHATTING', 'REJECTED'],
  WAITING_HR_REVIEW: ['HR_CONTACTING', 'REJECTED'],
  HR_CONTACTING: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['OFFER', 'REJECTED'],
  OFFER: ['HIRED', 'REJECTED'],
  HIRED: [],
  REJECTED: [],
}

// ─── Helpers ───

function getWorkspaceId(req: FastifyRequest): string {
  return (req.query as any)?.workspaceId || (req.body as any)?.workspaceId || ''
}

/**
 * Sprint 1B-5: 用标准 resolveCurrentEnterprise + requireEnterpriseWorkspaceContext 替代自制 helper
 */

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// ─── Routes ───

export default async function recruitmentConversationRoutes(fastify: FastifyInstance) {

  // Sprint-02 Fix: JWT 认证
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // Sprint 1B-5: Tenant boundary — 用 requireEnterpriseWorkspaceContext 替代自制 workspace 归属验证
  fastify.addHook('preHandler', async (request, reply) => {
    const workspaceId = getWorkspaceId(request)
    if (!workspaceId) return // 没有 workspaceId 则跳过

    const userId = (request.user as any)?.id || (request.user as any)?.userId
    if (!userId) {
      return reply.status(401).send({ error: '用户未认证' })
    }

    const wsc = await requireEnterpriseWorkspaceContext(userId, workspaceId)
    if (!wsc) {
      return reply.status(404).send({ error: '招聘空间不存在 or 无权限' })
    }
  })

  /**
   * GET /api/enterprise/recruitment-conversation
   * 列出当前 workspace 的所有会话
   * Query: workspaceId, status?, limit?, offset?
   */
  fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = getWorkspaceId(req)
    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })

    const { status, limit = '50', offset = '0' } = req.query as any

    const where: any = { workspaceId }
    if (status) where.status = status

    const [conversations, total] = await Promise.all([
      prisma.recruitmentConversation.findMany({
        where,
        include: {
          jobPosting: { select: { id: true, title: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, role: true, content: true, createdAt: true } },
          briefs: { orderBy: { version: 'desc' }, take: 1 },
          humanReview: { select: { id: true, status: true, priority: true } },
        },
        orderBy: [{ reviewPriority: 'desc' }, { updatedAt: 'desc' }],
        take: Math.min(parseInt(limit), 100),
        skip: parseInt(offset),
      }),
      prisma.recruitmentConversation.count({ where }),
    ])

    return reply.send({
      success: true,
      data: {
        conversations,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    })
  })

  /**
   * GET /api/enterprise/recruitment-conversation/:id
   * 获取单个会话详情（含消息历史 + 最新 Brief）
   */
  fastify.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const workspaceId = getWorkspaceId(req)

    const conversation = await prisma.recruitmentConversation.findFirst({
      where: id ? { id, ...(workspaceId ? { workspaceId } : {}) } : undefined,
      include: {
        jobPosting: { select: { id: true, title: true, salary: true, location: true } },
        pipeline: { select: { id: true, candidateName: true, stage: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        briefs: { orderBy: { version: 'desc' }, take: 1 },
        humanReview: true,
      },
    })

    if (!conversation) return reply.status(404).send({ success: false, message: 'Conversation not found' })

    return reply.send({ success: true, data: conversation })
  })

  /**
   * POST /api/enterprise/recruitment-conversation
   * 创建新会话（Recruiter Agent 发起）
   * Body: { workspaceId, jobPostingId?, candidateId?, recruiterAgentId, initialMessage? }
   */
  fastify.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any
    const { workspaceId, jobPostingId, candidateId, recruiterAgentId, initialMessage } = body

    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })
    if (!recruiterAgentId) return reply.status(400).send({ success: false, message: 'recruiterAgentId required' })

    // Sprint 1B-5: Tenant boundary — 用 requireEnterpriseWorkspaceContext 替代 validateWorkspaceAccess
    const initUserId = (request.user as any)?.id || (request as any)?.userId
    if (initUserId) {
      const wsc = await requireEnterpriseWorkspaceContext(initUserId, workspaceId)
      if (!wsc) return reply.status(404).send({ success: false, message: 'Workspace not found' })
    }

    // Validate recruiter agent exists
    const agent = await prisma.enterpriseAgentWorkforce.findFirst({
      where: { id: recruiterAgentId, workspaceId },
    })
    if (!agent) return reply.status(404).send({ success: false, message: 'Recruiter agent not found in workspace' })

    // Create conversation
    const conversation = await prisma.recruitmentConversation.create({
      data: {
        workspaceId,
        enterpriseId: wsCheck.enterpriseId!,
        jobPostingId: jobPostingId || null,
        candidateId: candidateId || null,
        recruiterAgentId,
        status: STATUS.DISCOVERED,
        stage: 'discovered',
      },
    })

    // Add initial system message
    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'system',
        content: `Recruiter Agent "${agent.displayName}" created conversation for job: ${jobPostingId || 'general'}`,
        metadata: { source: 'system', agentType: agent.agentType },
      },
    })

    // Add initial recruiter message if provided
    if (initialMessage) {
      await prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'recruiter_agent',
          content: initialMessage,
          metadata: { source: 'recruiter_agent' },
        },
      })
    }

    const result = await prisma.recruitmentConversation.findUnique({
      where: { id: conversation.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })

    return reply.status(201).send({ success: true, data: result })
  })

  /**
   * POST /api/enterprise/recruitment-conversation/:id/messages
   * 发送消息（Recruiter Agent 或 Candidate）
   * Body: { role, content, metadata? }
   * 
   * Ownership: role 必须是 recruiter_agent | candidate | system | hr
   * career_agent 的输入通过 metadata.advisorInput 注入，不作为独立 role
   */
  fastify.post('/:id/messages', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { role, content, metadata } = body

    if (!content) return reply.status(400).send({ success: false, message: 'content required' })

    const ALLOWED_ROLES = ['recruiter_agent', 'candidate', 'system', 'hr']
    if (!ALLOWED_ROLES.includes(role)) {
      return reply.status(400).send({ success: false, message: `role must be one of: ${ALLOWED_ROLES.join(', ')}` })
    }

    const conversation = await prisma.recruitmentConversation.findUnique({ where: { id } })
    if (!conversation) return reply.status(404).send({ success: false, message: 'Conversation not found' })

    if (['HIRED', 'REJECTED'].includes(conversation.status)) {
      return reply.status(409).send({ success: false, message: 'Conversation is closed' })
    }

    // Create message
    const message = await prisma.conversationMessage.create({
      data: {
        conversationId: id,
        role,
        content,
        tokenCount: Math.ceil(content.length / 4),  // rough estimate
        metadata: metadata || null,
      },
    })

    // Update conversation status if needed
    if (conversation.status === STATUS.DISCOVERED && role === 'recruiter_agent') {
      await prisma.recruitmentConversation.update({
        where: { id },
        data: { status: STATUS.INVITED, invitedAt: new Date() },
      })
    } else if (conversation.status === STATUS.INVITED && role === 'candidate') {
      await prisma.recruitmentConversation.update({
        where: { id },
        data: { status: STATUS.CHATTING, chattingStartedAt: new Date() },
      })
    }

    // Touch updatedAt
    await prisma.recruitmentConversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    return reply.status(201).send({ success: true, data: message })
  })

  /**
   * PATCH /api/enterprise/recruitment-conversation/:id/status
   * 状态流转
   * Body: { status, reason? }
   */
  fastify.patch('/:id/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { status: newStatus, reason } = body

    const conversation = await prisma.recruitmentConversation.findUnique({ where: { id } })
    if (!conversation) return reply.status(404).send({ success: false, message: 'Conversation not found' })

    if (!isValidTransition(conversation.status, newStatus)) {
      return reply.status(409).send({
        success: false,
        message: `Invalid transition: ${conversation.status} → ${newStatus}. Allowed: ${(VALID_TRANSITIONS[conversation.status] || []).join(', ')}`,
      })
    }

    const updateData: any = { status: newStatus, updatedAt: new Date() }

    // Set timestamps based on target status
    if (newStatus === STATUS.INVITED) updateData.invitedAt = new Date()
    if (newStatus === STATUS.CHATTING) updateData.chattingStartedAt = new Date()
    if (newStatus === STATUS.WAITING_HR_REVIEW) updateData.reviewSubmittedAt = new Date()
    if (['HIRED', 'REJECTED'].includes(newStatus)) updateData.closedAt = new Date()

    const updated = await prisma.recruitmentConversation.update({
      where: { id },
      data: updateData,
    })

    // If transitioning to WAITING_HR_REVIEW, auto-create HumanReviewItem
    if (newStatus === STATUS.WAITING_HR_REVIEW) {
      const latestBrief = await prisma.candidateBrief.findFirst({
        where: { conversationId: id },
        orderBy: { version: 'desc' },
      })
      const job = conversation.jobPostingId
        ? await prisma.jobPosting.findUnique({ where: { id: conversation.jobPostingId } })
        : null

      await prisma.humanReviewItem.create({
        data: {
          conversationId: id,
          workspaceId: conversation.workspaceId,
          enterpriseId: conversation.enterpriseId,
          candidateName: latestBrief?.candidateName,
          jobTitle: job?.title,
          matchScore: conversation.matchScore,
          overallScore: latestBrief?.overallScore,
          briefSummary: latestBrief?.aiSummary,
          aiRecommendation: latestBrief?.overallScore && latestBrief.overallScore >= 80
            ? 'recommend_final'
            : latestBrief?.overallScore && latestBrief.overallScore >= 60
              ? 'suggest_contact'
              : 'needs_more_info',
          priority: latestBrief?.overallScore && latestBrief.overallScore >= 85 ? 3 : 2,
        },
      })
    }

    // Log event
    await prisma.conversationMessage.create({
      data: {
        conversationId: id,
        role: 'system',
        content: `Status: ${conversation.status} → ${newStatus}${reason ? ` (${reason})` : ''}`,
        metadata: { source: 'status_transition', from: conversation.status, to: newStatus, reason },
      },
    })

    return reply.send({ success: true, data: updated })
  })

  /**
   * POST /api/enterprise/recruitment-conversation/:id/brief
   * 创建/更新 Candidate Brief（AI 持续生成）
   * Body: { candidateName?, skills?, experience?, ..., changeSummary? }
   * 
   * 每次调用自动 version+1，旧版本保留
   */
  fastify.post('/:id/brief', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any

    const conversation = await prisma.recruitmentConversation.findUnique({ where: { id } })
    if (!conversation) return reply.status(404).send({ success: false, message: 'Conversation not found' })

    // Get latest version number
    const latestBrief = await prisma.candidateBrief.findFirst({
      where: { conversationId: id },
      orderBy: { version: 'desc' },
    })
    const nextVersion = (latestBrief?.version || 0) + 1

    // Create new brief version
    const brief = await prisma.candidateBrief.create({
      data: {
        conversationId: id,
        candidateName: body.candidateName || latestBrief?.candidateName || null,
        skills: body.skills || latestBrief?.skills || [],
        experience: body.experience || latestBrief?.experience || null,
        experienceYears: body.experienceYears ?? latestBrief?.experienceYears ?? null,
        education: body.education || latestBrief?.education || null,
        city: body.city || latestBrief?.city || null,
        salaryMin: body.salaryMin ?? latestBrief?.salaryMin ?? null,
        salaryMax: body.salaryMax ?? latestBrief?.salaryMax ?? null,
        skillMatch: body.skillMatch ?? latestBrief?.skillMatch ?? null,
        cultureFit: body.cultureFit ?? latestBrief?.cultureFit ?? null,
        stabilityScore: body.stabilityScore ?? latestBrief?.stabilityScore ?? null,
        growthPotential: body.growthPotential ?? latestBrief?.growthPotential ?? null,
        overallScore: body.overallScore ?? latestBrief?.overallScore ?? null,
        strengths: body.strengths || latestBrief?.strengths || [],
        risks: body.risks || latestBrief?.risks || [],
        redFlags: body.redFlags || latestBrief?.redFlags || [],
        aiSummary: body.aiSummary || latestBrief?.aiSummary || null,
        jobUnderstanding: body.jobUnderstanding || latestBrief?.jobUnderstanding || null,
        communicationScore: body.communicationScore ?? latestBrief?.communicationScore ?? null,
        version: nextVersion,
        changeSummary: body.changeSummary || null,
        sourceMessageIds: body.sourceMessageIds || [],
      },
    })

    // Update conversation's briefSnapshotId
    await prisma.recruitmentConversation.update({
      where: { id },
      data: { briefSnapshotId: brief.id, updatedAt: new Date() },
    })

    return reply.status(201).send({ success: true, data: brief })
  })

  /**
   * GET /api/enterprise/recruitment-conversation/:id/briefs
   * 获取所有版本的 Candidate Brief
   */
  fastify.get('/:id/briefs', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any

    const briefs = await prisma.candidateBrief.findMany({
      where: { conversationId: id },
      orderBy: { version: 'desc' },
    })

    return reply.send({ success: true, data: briefs })
  })

  // ═══════════════════════════════════════════════════════════════
  // Human Review Queue
  // ═══════════════════════════════════════════════════════════════

  /**
   * GET /api/enterprise/recruitment-conversation/review-queue
   * 获取 HR 审核队列
   * Query: workspaceId, status?, priority?
   */
  fastify.get('/review-queue', async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = getWorkspaceId(req)
    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })

    const { status, priority } = req.query as any
    const where: any = { workspaceId }
    if (status) where.status = status
    if (priority) where.priority = parseInt(priority)

    const [items, total] = await Promise.all([
      prisma.humanReviewItem.findMany({
        where,
        include: {
          conversation: {
            select: {
              id: true,
              status: true,
              matchScore: true,
              messages: { orderBy: { createdAt: 'desc' }, take: 3, select: { role: true, content: true } },
            },
          },
        },
        orderBy: [{ priority: 'desc' }, { submittedAt: 'asc' }],
      }),
      prisma.humanReviewItem.count({ where }),
    ])

    return reply.send({ success: true, data: { items, total } })
  })

  /**
   * PATCH /api/enterprise/recruitment-conversation/:id/review
   * HR 审核决策
   * Body: { decision, reviewNote?, reviewedBy }
   * decision: approve | reject | request_more_info
   */
  fastify.patch('/:id/review', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { decision, reviewNote, reviewedBy } = body

    const VALID_DECISIONS = ['approve', 'reject', 'request_more_info']
    if (!VALID_DECISIONS.includes(decision)) {
      return reply.status(400).send({ success: false, message: `decision must be one of: ${VALID_DECISIONS.join(', ')}` })
    }

    const conversation = await prisma.recruitmentConversation.findUnique({ where: { id } })
    if (!conversation) return reply.status(404).send({ success: false, message: 'Conversation not found' })

    // Update review item
    const reviewItem = await prisma.humanReviewItem.findUnique({ where: { conversationId: id } })
    if (reviewItem) {
      await prisma.humanReviewItem.update({
        where: { conversationId: id },
        data: {
          status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'in_review',
          decision,
          reviewNote: reviewNote || null,
          reviewedBy: reviewedBy || null,
          reviewedAt: new Date(),
        },
      })
    }

    // Update conversation
    const convUpdate: any = {
      reviewDecision: decision,
      reviewNote: reviewNote || null,
      reviewedBy: reviewedBy || null,
      updatedAt: new Date(),
    }

    // If approved, move to HR_CONTACTING
    if (decision === 'approve') {
      convUpdate.status = STATUS.HR_CONTACTING
    } else if (decision === 'reject') {
      convUpdate.status = STATUS.REJECTED
      convUpdate.closedAt = new Date()
    }

    const updated = await prisma.recruitmentConversation.update({
      where: { id },
      data: convUpdate,
    })

    // Log
    await prisma.conversationMessage.create({
      data: {
        conversationId: id,
        role: 'system',
        content: `HR Review: ${decision}${reviewNote ? ` — ${reviewNote}` : ''}`,
        metadata: { source: 'hr_review', decision, reviewedBy },
      },
    })

    return reply.send({ success: true, data: updated })
  })

  /**
   * POST /api/enterprise/recruitment-conversation/:id/submit-for-review
   * AI 提交人工审核（从 AI_EVALUATING → WAITING_HR_REVIEW）
   * Body: { priority? }
   */
  fastify.post('/:id/submit-for-review', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const priority = body?.priority || 2

    const conversation = await prisma.recruitmentConversation.findUnique({ where: { id } })
    if (!conversation) return reply.status(404).send({ success: false, message: 'Conversation not found' })

    if (!isValidTransition(conversation.status, STATUS.WAITING_HR_REVIEW)) {
      return reply.status(409).send({
        success: false,
        message: `Cannot submit for review from status: ${conversation.status}`,
      })
    }

    // Use the status transition endpoint logic
    const updateData: any = {
      status: STATUS.WAITING_HR_REVIEW,
      reviewPriority: priority,
      reviewSubmittedAt: new Date(),
      updatedAt: new Date(),
    }

    const updated = await prisma.recruitmentConversation.update({
      where: { id },
      data: updateData,
    })

    // Create HumanReviewItem
    const latestBrief = await prisma.candidateBrief.findFirst({
      where: { conversationId: id },
      orderBy: { version: 'desc' },
    })
    const job = conversation.jobPostingId
      ? await prisma.jobPosting.findUnique({ where: { id: conversation.jobPostingId } })
      : null

    await prisma.humanReviewItem.upsert({
      where: { conversationId: id },
      create: {
        conversationId: id,
        workspaceId: conversation.workspaceId,
        enterpriseId: conversation.enterpriseId,
        candidateName: latestBrief?.candidateName,
        jobTitle: job?.title,
        matchScore: conversation.matchScore,
        overallScore: latestBrief?.overallScore,
        briefSummary: latestBrief?.aiSummary,
        aiRecommendation: latestBrief?.overallScore && latestBrief.overallScore >= 80
          ? 'recommend_final'
          : latestBrief?.overallScore && latestBrief.overallScore >= 60
            ? 'suggest_contact'
            : 'needs_more_info',
        priority,
      },
      update: {
        priority,
        status: 'pending',
        submittedAt: new Date(),
      },
    })

    return reply.send({ success: true, data: updated })
  })

  /**
   * GET /api/enterprise/recruitment-conversation/stats
   * 会话统计（Dashboard 用）
   * Query: workspaceId
   */
  fastify.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = getWorkspaceId(req)
    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })

    const [
      total,
      byStatus,
      reviewQueueCount,
      avgScore,
    ] = await Promise.all([
      prisma.recruitmentConversation.count({ where: { workspaceId } }),
      prisma.recruitmentConversation.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { status: true },
      }),
      prisma.humanReviewItem.count({ where: { workspaceId, status: 'pending' } }),
      prisma.candidateBrief.aggregate({
        where: { conversation: { workspaceId } },
        _avg: { overallScore: true },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    for (const row of byStatus) {
      statusCounts[row.status] = row._count.status
    }

    return reply.send({
      success: true,
      data: {
        total,
        byStatus: statusCounts,
        reviewQueueCount,
        avgOverallScore: Math.round(avgScore._avg?.overallScore || 0),
      },
    })
  })
}
