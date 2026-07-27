/**
 * Sprint-08C: Recruitment Campaign Domain
 * 
 * AI 宣发官的核心工作对象 — Campaign
 * 
 * Architecture (CTO Frozen):
 *   Campaign → PublishingTask → Channel Adapter
 *   AI 宣发官管理 Campaign，不直接管理平台
 *   微信、Boss、LinkedIn、小红书都只是 Channel Adapter
 * 
 * Status Lifecycle:
 *   Campaign: draft → generating → pending_review → approved → publishing → published → paused → closed
 *   Task: pending → scheduled → publishing → published | failed | cancelled
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Status Constants ───
const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  GENERATING: 'generating',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  PAUSED: 'paused',
  CLOSED: 'closed',
} as const

const TASK_STATUS = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

const CAMPAIGN_TRANSITIONS: Record<string, string[]> = {
  draft: ['generating', 'closed'],
  generating: ['pending_review', 'draft', 'closed'],
  pending_review: ['approved', 'draft', 'closed'],
  approved: ['publishing', 'closed'],
  publishing: ['published', 'paused', 'closed'],
  published: ['paused', 'closed'],
  paused: ['publishing', 'published', 'closed'],
  closed: [],
}

// ─── Helpers ───

function getWorkspaceId(req: FastifyRequest): string {
  return (req.query as any)?.workspaceId || (req.body as any)?.workspaceId || ''
}

function isValidTransition(from: string, to: string): boolean {
  return CAMPAIGN_TRANSITIONS[from]?.includes(to) ?? false
}

// ─── Routes ───

export default async function recruitmentCampaignRoutes(fastify: FastifyInstance) {

  /**
   * GET /api/enterprise/recruitment-campaign
   * 列出当前 workspace 的所有 Campaign
   * Query: workspaceId, status?, limit?, offset?
   */
  fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = getWorkspaceId(req)
    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })

    const { status, limit = '50', offset = '0' } = req.query as any
    const where: any = { workspaceId }
    if (status) where.status = status

    const [campaigns, total] = await Promise.all([
      prisma.recruitmentCampaign.findMany({
        where,
        include: {
          jobPosting: { select: { id: true, title: true } },
          publishingTasks: { select: { id: true, status: true, channelId: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.min(parseInt(limit), 100),
        skip: parseInt(offset),
      }),
      prisma.recruitmentCampaign.count({ where }),
    ])

    return reply.send({ success: true, data: { campaigns, total } })
  })

  /**
   * GET /api/enterprise/recruitment-campaign/:id
   * 获取 Campaign 详情（含 Publishing Tasks + Channel 信息）
   */
  fastify.get('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const workspaceId = getWorkspaceId(req)

    const campaign = await prisma.recruitmentCampaign.findFirst({
      where: { id, ...(workspaceId ? { workspaceId } : {}) },
      include: {
        jobPosting: { select: { id: true, title: true, description: true, salary: true, location: true, requirements: true } },
        publishingTasks: {
          include: { channel: { select: { id: true, name: true, type: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!campaign) return reply.status(404).send({ success: false, message: 'Campaign not found' })

    return reply.send({ success: true, data: campaign })
  })

  /**
   * POST /api/enterprise/recruitment-campaign
   * 创建 Campaign（AI Marketing Agent 发起）
   * Body: { workspaceId, jobPostingId, marketingAgentId, title?, description?, targetChannelIds? }
   */
  fastify.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any
    const { workspaceId, jobPostingId, marketingAgentId, title, description, targetChannelIds } = body

    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })
    if (!jobPostingId) return reply.status(400).send({ success: false, message: 'jobPostingId required' })
    if (!marketingAgentId) return reply.status(400).send({ success: false, message: 'marketingAgentId required' })

    // Validate workspace
    const ws = await prisma.enterpriseJobWorkspace.findUnique({ where: { id: workspaceId } })
    if (!ws) return reply.status(404).send({ success: false, message: 'Workspace not found' })

    // Validate job posting belongs to workspace's enterprise
    const job = await prisma.jobPosting.findFirst({
      where: { id: jobPostingId, enterpriseId: ws.enterpriseId },
    })
    if (!job) return reply.status(404).send({ success: false, message: 'Job posting not found' })

    // Validate marketing agent exists in workspace
    const agent = await prisma.enterpriseAgentWorkforce.findFirst({
      where: { id: marketingAgentId, workspaceId },
    })
    if (!agent) return reply.status(404).send({ success: false, message: 'Marketing agent not found in workspace' })

    // Create campaign
    const campaign = await prisma.recruitmentCampaign.create({
      data: {
        workspaceId,
        enterpriseId: ws.enterpriseId,
        jobPostingId,
        marketingAgentId,
        title: title || `Campaign for ${job.title}`,
        description: description || null,
        status: CAMPAIGN_STATUS.DRAFT,
        targetChannelIds: targetChannelIds || [],
      },
    })

    return reply.status(201).send({ success: true, data: campaign })
  })

  /**
   * POST /api/enterprise/recruitment-campaign/:id/generate
   * AI 生成宣传内容（文案 + 图片描述）
   * 调用 LLM 生成 promotionalText 和 aiGeneratedContent
   * 
   * 当前版本：使用模板生成（不调用真实 LLM，预留接口）
   * 未来：调用 Marketing Agent LLM
   */
  fastify.post('/:id/generate', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const workspaceId = getWorkspaceId(req)

    const campaign = await prisma.recruitmentCampaign.findFirst({
      where: { id, ...(workspaceId ? { workspaceId } : {}) },
      include: { jobPosting: true },
    })
    if (!campaign) return reply.status(404).send({ success: false, message: 'Campaign not found' })

    if (!isValidTransition(campaign.status, CAMPAIGN_STATUS.GENERATING)) {
      return reply.status(409).send({ success: false, message: `Cannot generate from status: ${campaign.status}` })
    }

    // ── AI Content Generation (Template-based, LLM interface reserved) ──
    const job = campaign.jobPosting
    const salaryText = job.salary ? `${job.salary}` : '薪资面议'
    const locationText = job.location || '地点灵活'

    const promotionalText = [
      `🔥 ${job.title} — 虚位以待！`,
      ``,
      `📋 岗位亮点：`,
      `• 薪资：${salaryText}`,
      `• 地点：${locationText}`,
      job.description ? `• 职责：${job.description.slice(0, 100)}` : ``,
      ``,
      `💡 加入我们，与行业顶尖人才共事，打造影响千万用户的产品。`,
      ``,
      `#招聘 #${job.title} #高薪 #加入我们`,
    ].filter(Boolean).join('\n')

    const aiGeneratedContent = {
      headline: `${job.title} — 诚聘精英`,
      body: promotionalText,
      hashtags: ['招聘', job.title, '高薪', '加入我们'],
      callToAction: '点击投递简历，期待与你相遇！',
      generatedAt: new Date().toISOString(),
      source: 'template', // 'template' | 'llm'
    }

    // Update campaign
    const updated = await prisma.recruitmentCampaign.update({
      where: { id },
      data: {
        promotionalText,
        aiGeneratedContent: aiGeneratedContent as any,
        status: CAMPAIGN_STATUS.PENDING_REVIEW,
        reviewStatus: 'pending',
        updatedAt: new Date(),
      },
    })

    return reply.send({ success: true, data: updated })
  })

  /**
   * PATCH /api/enterprise/recruitment-campaign/:id/status
   * Campaign 状态流转
   * Body: { status, reason? }
   */
  fastify.patch('/:id/status', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { status: newStatus, reason } = body

    const campaign = await prisma.recruitmentCampaign.findUnique({ where: { id } })
    if (!campaign) return reply.status(404).send({ success: false, message: 'Campaign not found' })

    if (!isValidTransition(campaign.status, newStatus)) {
      return reply.status(409).send({
        success: false,
        message: `Invalid transition: ${campaign.status} → ${newStatus}. Allowed: ${(CAMPAIGN_TRANSITIONS[campaign.status] || []).join(', ')}`,
      })
    }

    const updateData: any = { status: newStatus, updatedAt: new Date() }
    if (newStatus === CAMPAIGN_STATUS.PUBLISHED) updateData.publishedAt = new Date()
    if (newStatus === CAMPAIGN_STATUS.CLOSED) updateData.closedAt = new Date()

    const updated = await prisma.recruitmentCampaign.update({
      where: { id },
      data: updateData,
    })

    return reply.send({ success: true, data: updated })
  })

  /**
   * PATCH /api/enterprise/recruitment-campaign/:id/review
   * HR/管理员审核 Campaign
   * Body: { decision, reviewNote?, reviewedBy }
   * decision: approve | reject | needs_revision
   */
  fastify.patch('/:id/review', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { decision, reviewNote, reviewedBy } = body

    const VALID_DECISIONS = ['approve', 'reject', 'needs_revision']
    if (!VALID_DECISIONS.includes(decision)) {
      return reply.status(400).send({ success: false, message: `decision must be one of: ${VALID_DECISIONS.join(', ')}` })
    }

    const campaign = await prisma.recruitmentCampaign.findUnique({ where: { id } })
    if (!campaign) return reply.status(404).send({ success: false, message: 'Campaign not found' })

    const reviewStatusMap: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
      needs_revision: 'needs_revision',
    }

    const updateData: any = {
      reviewStatus: reviewStatusMap[decision],
      reviewedBy: reviewedBy || null,
      reviewedAt: new Date(),
      reviewNote: reviewNote || null,
      updatedAt: new Date(),
    }

    // If approved, move campaign to approved status
    if (decision === 'approve') {
      updateData.status = CAMPAIGN_STATUS.APPROVED
    } else if (decision === 'reject') {
      updateData.status = CAMPAIGN_STATUS.CLOSED
      updateData.closedAt = new Date()
    } else {
      // needs_revision → back to draft
      updateData.status = CAMPAIGN_STATUS.DRAFT
    }

    const updated = await prisma.recruitmentCampaign.update({
      where: { id },
      data: updateData,
    })

    return reply.send({ success: true, data: updated })
  })

  /**
   * POST /api/enterprise/recruitment-campaign/:id/publish
   * 发布 Campaign — 创建 Publishing Task 并执行
   * Body: { scheduledAt? }
   * 
   * 流程：approved → publishing → (创建 Tasks) → published
   * 每个 targetChannel 创建一个 PublishingTask
   */
  fastify.post('/:id/publish', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const scheduledAt = body?.scheduledAt ? new Date(body.scheduledAt) : null

    const campaign = await prisma.recruitmentCampaign.findUnique({
      where: { id },
      include: { publishingTasks: true },
    })
    if (!campaign) return reply.status(404).send({ success: false, message: 'Campaign not found' })

    if (!isValidTransition(campaign.status, CAMPAIGN_STATUS.PUBLISHING)) {
      return reply.status(409).send({ success: false, message: `Cannot publish from status: ${campaign.status}` })
    }

    if (!campaign.promotionalText) {
      return reply.status(422).send({ success: false, message: 'Campaign has no content. Run /generate first.' })
    }

    if (campaign.targetChannelIds.length === 0) {
      return reply.status(422).send({ success: false, message: 'No target channels configured.' })
    }

    // Create Publishing Tasks for each target channel
    const channels = await prisma.recruitmentChannel.findMany({
      where: { id: { in: campaign.targetChannelIds } },
    })

    const tasks = await Promise.all(
      channels.map((channel: { id: string; name: string }) =>
        prisma.publishingTask.create({
          data: {
            campaignId: id,
            channelId: channel.id,
            content: campaign.promotionalText!,
            imageUrl: null,
            status: scheduledAt ? TASK_STATUS.SCHEDULED : TASK_STATUS.PENDING,
            scheduledAt,
          },
        })
      )
    )

    // Update campaign status
    const updated = await prisma.recruitmentCampaign.update({
      where: { id },
      data: {
        status: scheduledAt ? CAMPAIGN_STATUS.PUBLISHING : CAMPAIGN_STATUS.PUBLISHED,
        publishedAt: scheduledAt ? null : new Date(),
        updatedAt: new Date(),
      },
    })

    return reply.send({
      success: true,
      data: {
        campaign: updated,
        tasksCreated: tasks.length,
        tasks: tasks.map((t: { id: string; channelId: string; status: string }) => ({
          id: t.id,
          channelId: t.channelId,
          status: t.status,
        })),
      },
    })
  })

  /**
   * POST /api/enterprise/recruitment-campaign/:id/tasks/:taskId/retry
   * 重试失败的 Task
   */
  fastify.post('/:id/tasks/:taskId/retry', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, taskId } = req.params as any

    const task = await prisma.publishingTask.findFirst({
      where: { id: taskId, campaignId: id },
    })
    if (!task) return reply.status(404).send({ success: false, message: 'Task not found' })

    if (task.status !== TASK_STATUS.FAILED) {
      return reply.status(409).send({ success: false, message: `Cannot retry from status: ${task.status}` })
    }

    const updated = await prisma.publishingTask.update({
      where: { id: taskId },
      data: {
        status: TASK_STATUS.PENDING,
        retryCount: { increment: 1 },
        failReason: null,
        failedAt: null,
        updatedAt: new Date(),
      },
    })

    return reply.send({ success: true, data: updated })
  })

  /**
   * GET /api/enterprise/recruitment-campaign/:id/tasks
   * 获取 Campaign 的所有 Publishing Tasks
   */
  fastify.get('/:id/tasks', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any

    const tasks = await prisma.publishingTask.findMany({
      where: { campaignId: id },
      include: { channel: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({ success: true, data: tasks })
  })

  /**
   * GET /api/enterprise/recruitment-campaign/channels
   * 获取可用的招聘渠道列表
   * Query: workspaceId, type?
   */
  fastify.get('/channels', async (req: FastifyRequest, reply: FastifyReply) => {
    const { type } = req.query as any
    const where: any = { enabled: true }
    if (type) where.type = type

    const channels = await prisma.recruitmentChannel.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })

    return reply.send({ success: true, data: channels })
  })

  /**
   * GET /api/enterprise/recruitment-campaign/stats
   * Campaign 统计（Dashboard 用）
   * Query: workspaceId
   */
  fastify.get('/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = getWorkspaceId(req)
    if (!workspaceId) return reply.status(400).send({ success: false, message: 'workspaceId required' })

    const [
      total,
      byStatus,
      totalViews,
      totalClicks,
      totalApplications,
      taskStats,
    ] = await Promise.all([
      prisma.recruitmentCampaign.count({ where: { workspaceId } }),
      prisma.recruitmentCampaign.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { status: true },
      }),
      prisma.recruitmentCampaign.aggregate({ where: { workspaceId }, _sum: { viewCount: true } }),
      prisma.recruitmentCampaign.aggregate({ where: { workspaceId }, _sum: { clickCount: true } }),
      prisma.recruitmentCampaign.aggregate({ where: { workspaceId }, _sum: { applicationCount: true } }),
      prisma.publishingTask.groupBy({
        by: ['status'],
        where: { campaign: { workspaceId } },
        _count: { status: true },
      }),
    ])

    const statusCounts: Record<string, number> = {}
    for (const row of byStatus) statusCounts[row.status] = row._count.status

    const taskStatusCounts: Record<string, number> = {}
    for (const row of taskStats) taskStatusCounts[row.status] = row._count.status

    return reply.send({
      success: true,
      data: {
        total,
        byStatus: statusCounts,
        totalViews: totalViews._sum?.viewCount || 0,
        totalClicks: totalClicks._sum?.clickCount || 0,
        totalApplications: totalApplications._sum?.applicationCount || 0,
        tasks: taskStatusCounts,
      },
    })
  })

  /**
   * PUT /api/enterprise/recruitment-campaign/:id
   * 更新 Campaign 基本信息（仅 draft 状态可编辑）
   * Body: { title?, description?, targetChannelIds? }
   */
  fastify.put('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any
    const body = req.body as any
    const { title, description, targetChannelIds } = body

    const campaign = await prisma.recruitmentCampaign.findUnique({ where: { id } })
    if (!campaign) return reply.status(404).send({ success: false, message: 'Campaign not found' })

    if (campaign.status !== CAMPAIGN_STATUS.DRAFT) {
      return reply.status(409).send({ success: false, message: `Cannot edit in status: ${campaign.status}. Only draft campaigns are editable.` })
    }

    const updateData: any = { updatedAt: new Date() }
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (targetChannelIds !== undefined) updateData.targetChannelIds = targetChannelIds

    const updated = await prisma.recruitmentCampaign.update({
      where: { id },
      data: updateData,
    })

    return reply.send({ success: true, data: updated })
  })

  /**
   * DELETE /api/enterprise/recruitment-campaign/:id
   * 删除 Campaign（仅 draft/closed 状态可删除）
   */
  fastify.delete('/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as any

    const campaign = await prisma.recruitmentCampaign.findUnique({ where: { id } })
    if (!campaign) return reply.status(404).send({ success: false, message: 'Campaign not found' })

    const deletable = ['draft', 'closed']
    if (!deletable.includes(campaign.status)) {
      return reply.status(409).send({
        success: false,
        message: `Cannot delete campaign in status: ${campaign.status}. Allowed: ${deletable.join(', ')}`,
      })
    }

    // PublishingTasks will cascade delete
    await prisma.recruitmentCampaign.delete({ where: { id } })

    return reply.send({ success: true, message: 'Campaign deleted' })
  })
}
