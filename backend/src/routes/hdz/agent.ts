/**
 * 混沌珠 — Agent 任务调度
 * orchestrator 的 API 入口：启动章节生成、查询任务、审批/修改
 * BYOK：所有 LLM 调用由 orchestrator 统一处理，不硬编码任何 Key
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { hdzOrchestrator } from '../../services/hdz/orchestrator.service.js'
import { reviewerService } from '../../services/hdz/reviewer.service.js'

export default async function hdzAgentRoutes(app: FastifyInstance) {
  // 全局认证拦截：所有 /api/hdz/agent/* 必须登录（含 PDF 下载，前端已改 fetch blob 带 Bearer）
  app.addHook('preHandler', async (request, reply) => {
    return app.authenticate(request, reply)
  })

  // POST /api/hdz/agent/generate — 启动章节生成 Planner
  // body: { projectId, chapterNo?, mode: 'single' | 'full' }
  app.post('/api/hdz/agent/generate', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterNo, mode = 'single' } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 创建 Agent 任务（从 planner 开始）
    const task = await prisma.hdzAgentTask.create({
      data: {
        projectId,
        agentType: 'planner',
        status: 'queued',
        input: { chapterNo: chapterNo || null, mode, userInput: (request.body as any).userInput || null },
      },
    })

    // ★ 异步执行编排器（不阻塞响应）
    hdzOrchestrator.executeTask(task.id).catch(err => {
      console.error(`[HDZ] Task ${task.id} orchestration failed:`, err)
    })

    return { success: true, data: task }
  })

  // POST /api/hdz/agent/write — 直接调用 Writer（写特定章节）
  app.post('/api/hdz/agent/write', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterNo, chapterId, mode, reviewNotes, userInput } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // ★ 重写模式：将评审意见注入 userInput，传给 writer service 识别
    const finalMode = mode || 'single'
    let finalUserInput = userInput || null
    if (finalMode === 'rewrite' && reviewNotes) {
      finalUserInput = `【评审意见—按评语重写】\n${reviewNotes}`
    }

    const task = await prisma.hdzAgentTask.create({
      data: {
        projectId,
        agentType: 'writer',
        status: 'queued',
        input: {
          chapterNo: chapterNo || 1,
          chapterId: chapterId || null,
          mode: finalMode,
          userInput: finalUserInput,
        },
      },
    })

    hdzOrchestrator.executeTask(task.id).catch(err => {
      console.error(`[HDZ] Write task ${task.id} failed:`, err)
    })

    return { success: true, data: task }
  })

  // ★ 02-B Task 3：批量入队生产——一次创建 N 章 Writer 任务，由生产队列后台消费（不阻塞 HTTP）
  app.post('/api/hdz/agent/batch-write', async (request, reply) => {
    const user = request.user as any
    const { projectId, from, to, mode } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }
    const start = Number(from)
    const end = Number(to)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
      return reply.status(400).send({ success: false, error: 'from/to 必须为合法章节区间（如 from=1, to=100）' })
    }
    if (end - start + 1 > 200) {
      return reply.status(400).send({ success: false, error: '单次批量最多 200 章' })
    }

    const finalMode = mode || 'single'
    const tasks = []
    for (let n = start; n <= end; n++) {
      const task = await prisma.hdzAgentTask.create({
        data: { projectId, agentType: 'writer', status: 'queued', input: { chapterNo: n, mode: finalMode } },
      })
      tasks.push(task.id)
      // 入队即生产（幂等；Sweeper 也会兜底）
      const { enqueueHdzTask } = await import('../../services/hdz/production-queue.service.js')
      enqueueHdzTask(task.id).catch((e: any) => console.warn(`[HDZ] enqueue ${task.id} 失败: ${e.message}`))
    }

    console.log(`[HDZ/Batch] 入队 ${tasks.length} 章（${start}-${end}, mode=${finalMode}）→ 生产队列后台消费`)
    return { success: true, data: { queued: tasks.length, range: [start, end], taskIds: tasks.slice(0, 5) } }
  })

  // POST /api/hdz/agent/review — 直接调用 Reviewer（审核特定章节）
  app.post('/api/hdz/agent/review', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterNo } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const task = await prisma.hdzAgentTask.create({
      data: {
        projectId,
        agentType: 'reviewer',
        status: 'queued',
        input: { chapterNo: chapterNo || 1, mode: 'single' },
      },
    })

    hdzOrchestrator.executeTask(task.id).catch(err => {
      console.error(`[HDZ] Review task ${task.id} failed:`, err)
    })

    return { success: true, data: task }
  })

  // GET /api/hdz/agent/tasks/:projectId — 获取项目所有任务
  app.get('/api/hdz/agent/tasks/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const tasks = await prisma.hdzAgentTask.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return { success: true, data: tasks }
  })

  // POST /api/hdz/agent/approve — 审批/修改/拒绝 Agent 输出
  // body: { taskId, action: 'approved' | 'rejected' | 'modified', note?, modifiedOutput? }
  app.post('/api/hdz/agent/approve', async (request, reply) => {
    const user = request.user as any
    const { taskId, action, note, modifiedOutput } = request.body as any

    const task = await prisma.hdzAgentTask.findUnique({
      where: { id: taskId },
      include: { project: { select: { userId: true } } },
    })
    if (!task || task.project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '任务不存在' })
    }
    if (task.status !== 'waiting_approval') {
      return reply.status(400).send({ success: false, error: '任务当前状态不可审批' })
    }

    // ★ 交由编排器的审批处理器（处理链继续 + 质量飞轮）
    await hdzOrchestrator.handleApproval(taskId, action, note, modifiedOutput)

    const updated = await prisma.hdzAgentTask.findUnique({ where: { id: taskId } })
    return { success: true, data: updated }
  })

  // GET /api/hdz/agent/latest/:projectId — 获取项目最新待审批的任务
  app.get('/api/hdz/agent/latest/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const task = await prisma.hdzAgentTask.findFirst({
      where: { projectId, status: 'waiting_approval' },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { title: true } } },
    })
    return { success: true, data: task }
  })

  // GET /api/hdz/agent/review/:projectId/:chapterNo — 获取某章的审核结果
  app.get('/api/hdz/agent/review/:projectId/:chapterNo', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterNo } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const review = await reviewerService.getReview(projectId, Number(chapterNo) || 1)
    return { success: true, data: review }
  })

  // POST /api/hdz/agent/request-review — 手动触发某章的审校
  app.post('/api/hdz/agent/request-review', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterId, chapterNo } = request.body as any
    if (!projectId || !chapterId) {
      return reply.status(400).send({ success: false, error: '缺少参数' })
    }
    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }
    // 创建 Reviewer 任务
    const task = await prisma.hdzAgentTask.create({
      data: {
        projectId,
        agentType: 'reviewer',
        status: 'pending',
        input: { chapterId, chapterNo },
      },
    })
    console.log(`[HDZ] 手动触发审校: project=${projectId}, chapter=${chapterNo}, task=${task.id}`)

    // 异步执行 Reviewer（不阻塞返回）
    ;(async () => {
      try {
        const mod = await import('../../services/hdz/orchestrator.service.js')
        const orchestrator = mod.hdzOrchestrator
        await orchestrator.executeTask(task.id)
        console.log(`[HDZ] 审校完成: task=${task.id}`)
      } catch (e: any) {
        console.error(`[HDZ] 审校失败: task=${task.id}`, e.message)
        await prisma.hdzAgentTask.update({
          where: { id: task.id },
          data: { status: 'failed', output: { error: e.message } },
        }).catch(() => {})
      }
    })()

    return { success: true, data: { taskId: task.id } }
  })

  // POST /api/hdz/agent/cancel-writing — 暂停/取消项目的写作任务
  app.post("/api/hdz/agent/cancel-writing", async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: "项目不存在" })
    }

    // 把所有 queued/running 的 writer 任务标记为 failed
    const result = await prisma.hdzAgentTask.updateMany({
      where: {
        projectId,
        agentType: "writer",
        status: { in: ["queued", "running"] },
      },
      data: {
        status: "failed",
        output: { error: "用户取消了写作任务" },
      },
    })

    console.log(`[HDZ] 取消写作: project=${projectId}, affected=${result.count}`)
    return { success: true, data: { cancelled: result.count } }
  })

  // ─── 编剧 Agent ───

  // POST /api/hdz/agent/screenplay — 小说章节转剧本
  app.post('/api/hdz/agent/screenplay', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterNos, cinematicStyle } = request.body as any
    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const { convertToScreenplay, saveScreenplayTask } = await import('../../services/hdz/screenwriter.service.js')
    try {
      const results = await convertToScreenplay(projectId, chapterNos || [], project.userId, cinematicStyle)

      // 保存到数据库并返回 ID
      const taskIds: string[] = []
      for (const r of results) {
        const id = await saveScreenplayTask(projectId, r.chapterNo, project.userId, r)
        taskIds.push(id)
      }

      return {
        success: true,
        data: { results, taskIds },
      }
    } catch (err: any) {
      console.error(`[HDZ/Screenwriter] 剧本转换失败:`, err.message, err.stack)
      return { success: false, error: err.message }
    }
  })

  // GET /api/hdz/agent/screenplay/:projectId — 获取项目所有剧本（归属校验）
  app.get('/api/hdz/agent/screenplay/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const project = await prisma.hdzProject.findUnique({ where: { id: projectId }, select: { userId: true } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }
    const { getProjectScreenplays } = await import('../../services/hdz/screenwriter.service.js')
    const tasks = await getProjectScreenplays(projectId)
    return { success: true, data: tasks }
  })

  // GET /api/hdz/agent/screenplay/:projectId/pdf/:taskId — 导出剧本 PDF（归属校验）
  app.get('/api/hdz/agent/screenplay/:projectId/pdf/:taskId', async (request, reply) => {
    const user = request.user as any
    const { projectId, taskId } = request.params as any
    const qChapterNo = (request.query as any)?.chapterNo

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId }, select: { userId: true } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    let task: any = null
    const { getProjectScreenplays } = await import('../../services/hdz/screenwriter.service.js')

    if (taskId && taskId !== 'by-chapter') {
      // 按 taskId 查找
      const tasks = await getProjectScreenplays(projectId)
      task = tasks.find((t: any) => t.id === taskId)
    } else if (qChapterNo) {
      // 按 chapterNo 查找（兼容前端没有 taskId 的场景）
      const tasks = await getProjectScreenplays(projectId)
      task = tasks.find((t: any) => {
        const out = t.output as any
        return out?.chapterNo === Number(qChapterNo)
      })
    }
    if (!task?.output) return reply.status(404).send({ success: false, error: '剧本不存在' })

    const { generateScreenplayPdf } = await import('../../services/hdz/screenplay-pdf.service.js')
    const output = task.output as any
    try {
      const pdfPath = await generateScreenplayPdf({
        chapterNo: output.chapterNo || 0,
        chapterTitle: output.chapterTitle || '',
        scenes: output.scenes || [],
      })

      const filename = `第${output.chapterNo}章_${output.chapterTitle || '剧本'}.pdf`.replace(/[\\/:*?"<>|]/g, '_')

      const fs = await import('fs')
      const stream = fs.createReadStream(pdfPath)
      reply.header('Content-Type', 'application/pdf')
      reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
      return reply.send(stream)
    } catch (err: any) {
      console.error('[HDZ/PDF] 生成失败:', err.message)
      return { success: false, error: 'PDF 生成失败: ' + err.message }
    }
  })
}
