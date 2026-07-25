/**
 * enterprise-pipeline.routes.ts — 招聘 Pipeline MVP API
 * Phase 5-A3: Kanban + Timeline + AI Actions + Dashboard Sync
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { InterviewAgent } from '../agents/job/interview-agent.js'

// ─── 有效的 Pipeline 阶段 ───
const VALID_STAGES = ['discovered', 'screening', 'interview', 'offer', 'hired', 'rejected']
const KANBAN_STAGES = ['discovered', 'screening', 'interview', 'offer', 'hired']

export async function enterprisePipelineRoutes(fastify: FastifyInstance) {

  // 所有 Pipeline 接口都需要 JWT 认证
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // ─── 获取 Kanban 全量数据 ───
  fastify.get('/api/pipeline/kanban', async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId?: string }
    if (!workspaceId) return reply.status(400).send({ error: 'workspaceId required' })

    const pipelines = await prisma.recruitmentPipeline.findMany({
      where: { workspaceId },
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 10 },
        job: { select: { title: true } },
      },
      orderBy: { lastActivityAt: 'desc' },
    })

    // 按阶段分组
    const columns: Record<string, any[]> = {}
    for (const stage of KANBAN_STAGES) {
      columns[stage] = []
    }
    for (const p of pipelines) {
      const stage = KANBAN_STAGES.includes(p.stage) ? p.stage : 'discovered'
      columns[stage].push({
        id: p.id,
        candidateName: p.candidateName,
        jobTitle: p.job?.title || '未知职位',
        stage: p.stage,
        screeningScore: p.screeningScore,
        interviewCount: p.interviewCount,
        autoCreated: p.autoCreated,
        lastActivityAt: p.lastActivityAt,
        createdAt: p.createdAt,
        recentEvents: p.events.slice(0, 3),
      })
    }

    return {
      workspaceId,
      columns,
      counts: Object.fromEntries(KANBAN_STAGES.map(s => [s, columns[s].length])),
      total: pipelines.length,
    }
  })

  // ─── 创建 Pipeline 记录 ───
  fastify.post('/api/pipeline', async (request, reply) => {
    const body = request.body as {
      workspaceId: string
      candidateName: string
      jobId: string
      resumeId?: string
      source?: string
    }
    if (!body.workspaceId || !body.candidateName || !body.jobId) {
      return reply.status(400).send({ error: 'workspaceId, candidateName, jobId required' })
    }

    const pipeline = await prisma.recruitmentPipeline.create({
      data: {
        workspaceId: body.workspaceId,
        candidateName: body.candidateName,
        jobId: body.jobId,
        resumeId: body.resumeId || null,
        stage: 'discovered',
        lastActivityAt: new Date(),
      },
    })

    // 创建初始事件
    await prisma.pipelineEvent.create({
      data: {
        pipelineId: pipeline.id,
        type: 'stage_change',
        toStage: 'discovered',
        actor: 'system',
        metadata: { source: body.source || 'manual' },
      },
    })

    return { success: true, pipeline }
  })

  // ─── 阶段移动（Kanban 拖拽）───
  fastify.patch('/api/pipeline/:id/stage', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { stage: string; actor?: string }

    if (!body.stage || !VALID_STAGES.includes(body.stage)) {
      return reply.status(400).send({ error: `无效阶段: ${body.stage}. 有效: ${VALID_STAGES.join(', ')}` })
    }

    const existing = await prisma.recruitmentPipeline.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Pipeline not found' })

    const oldStage = existing.stage

    // 更新阶段
    const updated = await prisma.recruitmentPipeline.update({
      where: { id },
      data: {
        stage: body.stage,
        lastActivityAt: new Date(),
        // 自动更新面试计数
        interviewCount: body.stage === 'interview' ? { increment: 1 } : undefined,
      },
    })

    // 记录事件
    await prisma.pipelineEvent.create({
      data: {
        pipelineId: id,
        type: 'stage_change',
        fromStage: oldStage,
        toStage: body.stage,
        actor: body.actor || 'user',
      },
    })

    return { success: true, pipeline: updated, oldStage }
  })

  // ─── 候选人时间线 ───
  fastify.get('/api/pipeline/:id/timeline', async (request, reply) => {
    const { id } = request.params as { id: string }

    const pipeline = await prisma.recruitmentPipeline.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        job: { select: { title: true } },
        interviewSessions: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!pipeline) return reply.status(404).send({ error: 'Not found' })

    return {
      pipelineId: id,
      candidateName: pipeline.candidateName,
      jobTitle: pipeline.job?.title,
      currentStage: pipeline.stage,
      screeningScore: pipeline.screeningScore,
      createdAt: pipeline.createdAt,
      events: pipeline.events.map((e: any) => ({
        id: e.id,
        type: e.type,
        fromStage: e.fromStage,
        toStage: e.toStage,
        actor: e.actor,
        metadata: e.metadata,
        time: e.createdAt,
      })),
      interviews: pipeline.interviewSessions.map((i: any) => ({
        id: i.id,
        status: i.status,
        score: i.overallScore,
        createdAt: i.createdAt,
      })),
    }
  })

  // ─── AI 重新评分 ───
  fastify.post('/api/pipeline/:id/ai-rescore', async (request, reply) => {
    const { id } = request.params as { id: string }

    // ⚠️ BETA PLACEHOLDER — 当前使用简单公式，非真实 AI
    // TODO: Sprint-09 接入 ModelRouter 替换
    const pipeline = await prisma.recruitmentPipeline.findUnique({
      where: { id },
      include: { job: true },
    })
    if (!pipeline) return reply.status(404).send({ error: 'Not found' })

    let score = 60

    try {
      if (pipeline.resumeId) {
        const resumeProfile = await prisma.resumeProfile.findUnique({
          where: { resumeId: pipeline.resumeId },
        })
        if (resumeProfile) {
          const skills = resumeProfile.skills?.length || 0
          const exp = resumeProfile.experience ? resumeProfile.experience.length : 0
          score = Math.min(95, 50 + skills * 5 + Math.min(exp / 10, 20))
        }
      }
      score = Math.min(98, Math.max(40, score + Math.floor(Math.random() * 15) - 7))
    } catch { /* 失败时保持默认分 */ }

    await prisma.recruitmentPipeline.update({
      where: { id },
      data: { screeningScore: score, lastActivityAt: new Date() },
    })

    await prisma.pipelineEvent.create({
      data: {
        pipelineId: id,
        type: 'ai_score',
        actor: 'ai',
        metadata: { score, placeholder: true },
      },
    })

    return { 
      success: true, 
      score,
      beta: true,
      disclaimer: '当前为 Beta 评分（基于简历特征公式），真实 AI 评分将在 Sprint-09 接入'
    }
  })

  // ─── AI 生成面试题 ───
  fastify.post('/api/pipeline/:id/ai-interview', async (request, reply) => {
    const { id } = request.params as { id: string }

    const pipeline = await prisma.recruitmentPipeline.findUnique({
      where: { id },
      include: { job: true },
    })
    if (!pipeline) return reply.status(404).send({ error: 'Not found' })

    const agent = new InterviewAgent()
    let questions: Array<{ question: string; purpose: string }> = []

    try {
      // 尝试获取简历信息
      let resumeProfile: any = null
      if (pipeline.resumeId) {
        resumeProfile = await prisma.resumeProfile.findUnique({
          where: { resumeId: pipeline.resumeId },
        })
      }

      if (pipeline.job && resumeProfile) {
        const plan = agent.generateInterviewPlan(
          {
            title: pipeline.job.title,
            skills: pipeline.job.skillRequirements || [],
            salary: pipeline.job.salary || '',
            location: pipeline.job.location || '',
            requirements: pipeline.job.requirements ? pipeline.job.requirements.split(/[,，、\n]/).map((s: string) => s.trim()).filter(Boolean) : [],
            level: '',
          },
          {
            name: resumeProfile.name || pipeline.candidateName,
            skills: resumeProfile.skills || [],
            experienceYears: resumeProfile.experienceYears || 0,
            education: resumeProfile.education || '',
            city: resumeProfile.city || '',
            careerGoal: resumeProfile.careerGoal || '',
            projects: resumeProfile.projects || '',
          }
        )
        questions = plan.questions.map(q => ({
          question: q.question,
          purpose: q.category,
        }))
      }
    } catch {
      // 失败时使用默认题目
    }

    if (questions.length === 0) {
      questions = [
        { question: `请介绍您与${pipeline.job?.title || '该职位'}相关的经验。`, purpose: '岗位匹配度' },
        { question: '您如何处理工作中的挑战？', purpose: '问题解决能力' },
        { question: '您的职业目标是什么？', purpose: '发展规划' },
      ]
    }

    // 记录事件
    await prisma.pipelineEvent.create({
      data: {
        pipelineId: id,
        type: 'ai_interview',
        actor: 'ai',
        metadata: { questionCount: questions.length },
      },
    })

    return { success: true, questions }
  })

  // ─── AI 发送邀约 ───
  fastify.post('/api/pipeline/:id/ai-invite', async (request, reply) => {
    const { id } = request.params as { id: string }

    // ⚠️ BETA PLACEHOLDER — 仅改阶段，未真正发送邀约
    // TODO: Sprint-09 接入真实消息发送
    const pipeline = await prisma.recruitmentPipeline.findUnique({ where: { id } })
    if (!pipeline) return reply.status(404).send({ error: 'Not found' })

    await prisma.recruitmentPipeline.update({
      where: { id },
      data: { stage: 'interview', lastActivityAt: new Date() },
    })

    await prisma.pipelineEvent.create({
      data: {
        pipelineId: id,
        type: 'ai_invite',
        fromStage: pipeline.stage,
        toStage: 'interview',
        actor: 'ai',
        metadata: { message: 'AI 已自动发送面试邀约', placeholder: true },
      },
    })

    return { 
      success: true, 
      message: '面试邀约已发送（Beta：仅标记阶段，未真正发送）',
      beta: true,
      disclaimer: '当前为 Beta 功能，仅标记面试状态，真实邀约发送将在 Sprint-09 接入'
    }
  })

  // ─── AI 生成 Offer ───
  fastify.post('/api/pipeline/:id/ai-offer', async (request, reply) => {
    const { id } = request.params as { id: string }

    const pipeline = await prisma.recruitmentPipeline.findUnique({
      where: { id },
      include: { job: true },
    })
    if (!pipeline) return reply.status(404).send({ error: 'Not found' })

    // ⚠️ BETA PLACEHOLDER — 基于评分的固定模板，非真实 AI
    // TODO: Sprint-09 接入 ModelRouter 生成真实 Offer
    const score = pipeline.screeningScore || 70
    const salaryBase = score >= 85 ? '25-35K' : score >= 70 ? '18-25K' : '12-18K'
    const offerContent = `📋 Offer 建议（Beta 模板）

候选人：${pipeline.candidateName}
职位：${pipeline.job?.title || '未知'}
AI 评分：${score}/100

建议薪资范围：${salaryBase}
入职时间：2周内
特别条款：${score >= 80 ? '建议给予股票期权激励' : '标准offer package'}

⚠️ 当前为 Beta 模板生成，真实 AI Offer 将在 Sprint-09 接入
生成时间：${new Date().toLocaleString('zh-CN')}`

    await prisma.recruitmentPipeline.update({
      where: { id },
      data: { stage: 'offer', lastActivityAt: new Date() },
    })

    await prisma.pipelineEvent.create({
      data: {
        pipelineId: id,
        type: 'ai_offer',
        fromStage: pipeline.stage,
        toStage: 'offer',
        actor: 'ai',
        metadata: { content: offerContent, placeholder: true },
      },
    })

    return { 
      success: true, 
      content: offerContent,
      beta: true,
      disclaimer: '当前为 Beta 模板生成（基于评分区间），真实 AI Offer 将在 Sprint-09 接入'
    }
  })

  // ─── Sprint-02: Candidate 详情 ───
  fastify.get('/api/pipeline/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const pipeline = await prisma.recruitmentPipeline.findUnique({
      where: { id },
      include: {
        job: { select: { title: true, location: true, salary: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
        candidateNotes: { orderBy: { createdAt: 'desc' } },
        interviewSessions: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!pipeline) return reply.status(404).send({ error: 'Candidate not found' })

    // 单独查询 Resume（因为 RecruitmentPipeline 没有 resume 关系）
    let resumeData = null
    if (pipeline.resumeId) {
      const resume = await prisma.resume.findUnique({
        where: { id: pipeline.resumeId },
        select: {
          fileName: true,
          fileType: true,
          fileSize: true,
          createdAt: true,
          profile: {
            select: {
              name: true, email: true, phone: true,
              education: true, major: true, skills: true,
              experienceYears: true, city: true, qualityScore: true,
            },
          },
        },
      })
      if (resume) {
        resumeData = {
          fileName: resume.fileName,
          fileType: resume.fileType,
          fileSize: resume.fileSize,
          uploadedAt: resume.createdAt,
          profile: resume.profile,
        }
      }
    }

    return {
      candidate: {
        id: pipeline.id,
        candidateName: pipeline.candidateName,
        jobTitle: pipeline.job?.title || '',
        jobLocation: pipeline.job?.location || '',
        jobSalary: pipeline.job?.salary || '',
        stage: pipeline.stage,
        screeningScore: pipeline.screeningScore,
        interviewCount: pipeline.interviewCount,
        autoCreated: pipeline.autoCreated,
        tags: pipeline.tags || [],
        offerStatus: pipeline.offerStatus,
        lastActivityAt: pipeline.lastActivityAt,
        createdAt: pipeline.createdAt,
        recentEvents: (pipeline as any).events?.slice(0, 5) || [],
        notes: (pipeline as any).candidateNotes || [],
        interviews: (pipeline as any).interviewSessions || [],
        resume: resumeData,
      },
    }
  })

  // ─── Sprint-02: Candidate 更新（tags, offerStatus）───
  fastify.patch('/api/pipeline/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { tags?: string[]; offerStatus?: string; candidateName?: string }

    const existing = await prisma.recruitmentPipeline.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Candidate not found' })

    const data: any = { lastActivityAt: new Date() }
    if (body.tags !== undefined) data.tags = body.tags
    if (body.offerStatus !== undefined) data.offerStatus = body.offerStatus
    if (body.candidateName !== undefined) data.candidateName = body.candidateName

    const updated = await prisma.recruitmentPipeline.update({ where: { id }, data })
    return { success: true, candidate: { id: updated.id, tags: updated.tags, offerStatus: updated.offerStatus } }
  })

  // ─── Sprint-02: Notes CRUD ───
  fastify.post('/api/pipeline/:id/notes', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { content: string }
    if (!body.content?.trim()) return reply.status(400).send({ error: 'Content required' })

    const pipeline = await prisma.recruitmentPipeline.findUnique({ where: { id } })
    if (!pipeline) return reply.status(404).send({ error: 'Candidate not found' })

    const note = await prisma.candidateNote.create({
      data: { pipelineId: id, content: body.content.trim() },
    })

    await prisma.recruitmentPipeline.update({
      where: { id },
      data: { lastActivityAt: new Date() },
    })

    return { success: true, note }
  })

  fastify.patch('/api/pipeline/notes/:noteId', async (request, reply) => {
    const { noteId } = request.params as { noteId: string }
    const body = request.body as { content: string }
    if (!body.content?.trim()) return reply.status(400).send({ error: 'Content required' })

    const existing = await prisma.candidateNote.findUnique({ where: { id: noteId } })
    if (!existing) return reply.status(404).send({ error: 'Note not found' })

    const updated = await prisma.candidateNote.update({
      where: { id: noteId },
      data: { content: body.content.trim() },
    })

    return { success: true, note: updated }
  })

  fastify.delete('/api/pipeline/notes/:noteId', async (request, reply) => {
    const { noteId } = request.params as { noteId: string }
    const existing = await prisma.candidateNote.findUnique({ where: { id: noteId } })
    if (!existing) return reply.status(404).send({ error: 'Note not found' })

    await prisma.candidateNote.delete({ where: { id: noteId } })
    return { success: true }
  })

  // ─── Sprint-02: Tags 管理 ───
  fastify.post('/api/pipeline/:id/tags', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { tag: string }
    if (!body.tag?.trim()) return reply.status(400).send({ error: 'Tag required' })

    const pipeline = await prisma.recruitmentPipeline.findUnique({ where: { id } })
    if (!pipeline) return reply.status(404).send({ error: 'Candidate not found' })

    const currentTags = pipeline.tags || []
    if (currentTags.includes(body.tag.trim())) {
      return reply.status(409).send({ error: 'Tag already exists' })
    }

    const updated = await prisma.recruitmentPipeline.update({
      where: { id },
      data: { tags: [...currentTags, body.tag.trim()], lastActivityAt: new Date() },
    })

    return { success: true, tags: updated.tags }
  })

  fastify.delete('/api/pipeline/:id/tags/:tag', async (request, reply) => {
    const { id, tag } = request.params as { id: string; tag: string }
    const pipeline = await prisma.recruitmentPipeline.findUnique({ where: { id } })
    if (!pipeline) return reply.status(404).send({ error: 'Candidate not found' })

    const currentTags = pipeline.tags || []
    const updated = await prisma.recruitmentPipeline.update({
      where: { id },
      data: { tags: currentTags.filter(t => t !== tag), lastActivityAt: new Date() },
    })

    return { success: true, tags: updated.tags }
  })

  // ─── Sprint-02: 删除 Pipeline（级联删除 Notes + Events）───
  fastify.delete('/api/pipeline/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await prisma.recruitmentPipeline.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Candidate not found' })

    // 级联删除: Events → Notes → Pipeline
    await prisma.pipelineEvent.deleteMany({ where: { pipelineId: id } })
    await prisma.candidateNote.deleteMany({ where: { pipelineId: id } })
    await prisma.recruitmentPipeline.delete({ where: { id } })

    return { success: true, message: 'Candidate deleted' }
  })
}
