/**
 * 混沌珠 — 手稿路由
 * 章节正文的存取与更新
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { hdzUpdateChapterSchema, validateOrReject } from '../../schemas/hdz.js'

export default async function hdzManuscriptRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /api/hdz/manuscript/:projectId — 获取项目全部章节
  app.get('/api/hdz/manuscript/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const chapters = await prisma.hdzChapter.findMany({
      where: { projectId },
      orderBy: { chapterNo: 'asc' },
    })
    return { success: true, data: chapters }
  })

  // POST /api/hdz/manuscript/:projectId — 新建章节
  app.post('/api/hdz/manuscript/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const body = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // Get next chapter number
    const lastChapter = await prisma.hdzChapter.findFirst({
      where: { projectId },
      orderBy: { chapterNo: 'desc' },
      select: { chapterNo: true },
    })
    const chapterNo = (lastChapter?.chapterNo || 0) + 1

    const chapter = await prisma.hdzChapter.create({
      data: {
        projectId,
        chapterNo,
        title: body.title || `第${chapterNo}章`,
        status: 'draft',
        content: '',
      },
    })
    return reply.code(201).send({ success: true, data: chapter })
  })

  // GET /api/hdz/manuscript/:projectId/:chapterId — 获取单章详情
  app.get('/api/hdz/manuscript/:projectId/:chapterId', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterId } = request.params as any

    const chapter = await prisma.hdzChapter.findUnique({
      where: { id: chapterId, projectId },
    })
    if (!chapter) return reply.status(404).send({ success: false, error: '章节不存在' })

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '无权限' })
    }

    return { success: true, data: chapter }
  })

  // PUT /api/hdz/manuscript/:projectId/:chapterId — 更新章节正文/标题
  app.put('/api/hdz/manuscript/:projectId/:chapterId', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterId } = request.params as any
    const body = validateOrReject(request.body, hdzUpdateChapterSchema, reply)
    if (!body) return

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '无权限' })
    }

    const wordCount = body.content ? body.content.replace(/\s/g, '').length : undefined

    // 资源级归属校验：章节必须属于当前项目（防跨项目改写）
    const chapter = await prisma.hdzChapter.findUnique({
      where: { id: chapterId },
      select: { projectId: true },
    })
    if (!chapter || chapter.projectId !== projectId) {
      return reply.status(404).send({ success: false, error: '章节不存在' })
    }

    const updated = await prisma.hdzChapter.update({
      where: { id: chapterId },
      data: {
        title: body.title ?? undefined,
        content: body.content ?? undefined,
        outline: body.outline ?? undefined,
        status: body.status ?? undefined,
        wordCount,
        reviewNotes: body.reviewNotes ?? undefined,
      },
    })
    return { success: true, data: updated }
  })

  // DELETE /api/hdz/manuscript/:projectId/:chapterId — 删除章节大纲
  // 同时清除该章已创建大纲的缓存与数据（生成任务、章节摘要记忆），用户可重新开始创建
  app.delete('/api/hdz/manuscript/:projectId/:chapterId', async (request, reply) => {
    const user = request.user as any
    const { projectId, chapterId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '无权限' })
    }

    // 资源级归属校验：章节必须属于当前项目（防跨项目删除）
    const chapter = await prisma.hdzChapter.findUnique({
      where: { id: chapterId },
      select: { id: true, projectId: true, chapterNo: true },
    })
    if (!chapter || chapter.projectId !== projectId) {
      return reply.status(404).send({ success: false, error: '章节不存在' })
    }

    // 事务：清理该章大纲的全部缓存与数据 → 删除章节
    await prisma.$transaction([
      // 1. 该章相关的生成任务（大纲规划/正文写作/审校）——input 中记录 chapterNo
      prisma.hdzAgentTask.deleteMany({
        where: { projectId, input: { path: ['chapterNo'], equals: chapter.chapterNo } },
      }),
      // 2. 该章的章节摘要记忆缓存（chapter_summary 单条记录）
      prisma.hdzMemory.deleteMany({
        where: { projectId, type: 'chapter_summary', content: { path: ['chapterNo'], equals: chapter.chapterNo } },
      }),
      // 3. 删除章节（大纲/正文/摘要/评审意见一并清除）
      prisma.hdzChapter.delete({ where: { id: chapterId } }),
    ])

    return { success: true, data: { deletedChapterNo: chapter.chapterNo } }
  })

  // POST /api/hdz/manuscript/:projectId/batch-delete — 批量删除章节大纲
  // body: { chapterIds: string[] } — 一键删除选中章节，同时清除各章大纲缓存与数据
  app.post('/api/hdz/manuscript/:projectId/batch-delete', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { chapterIds } = (request.body || {}) as { chapterIds?: string[] }

    if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
      return reply.status(400).send({ success: false, error: 'chapterIds 不能为空' })
    }
    // 过滤非法 id（空/非字符串），避免 Prisma in 查询收到 null
    const validIds = chapterIds.filter((id: any) => typeof id === 'string' && id.length > 0)
    if (validIds.length === 0) {
      return reply.status(400).send({ success: false, error: 'chapterIds 非法' })
    }

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '无权限' })
    }

    // 资源级归属校验：只删除属于当前项目的章节（防跨项目删除）
    const chapters = await prisma.hdzChapter.findMany({
      where: { id: { in: validIds }, projectId },
      select: { id: true, chapterNo: true },
    })
    if (chapters.length === 0) {
      return { success: true, data: { deleted: 0, deletedChapterNos: [] } }
    }

    const chapterNos = chapters.map((c: any) => c.chapterNo)
    const ids = chapters.map((c: any) => c.id)

    // 事务：清理所有选中章的大纲缓存与数据 → 批量删除章节
    await prisma.$transaction([
      // 1. 相关生成任务（大纲规划/正文写作/审校）——input 中记录 chapterNo（JsonFilter 不支持 in，用 OR 展开 equals）
      prisma.hdzAgentTask.deleteMany({
        where: {
          projectId,
          OR: chapterNos.map((no: number) => ({ input: { path: ['chapterNo'], equals: no } })),
        },
      }),
      // 2. 章节摘要记忆缓存
      prisma.hdzMemory.deleteMany({
        where: {
          projectId,
          type: 'chapter_summary',
          OR: chapterNos.map((no: number) => ({ content: { path: ['chapterNo'], equals: no } })),
        },
      }),
      // 3. 删除章节本体
      prisma.hdzChapter.deleteMany({ where: { id: { in: ids }, projectId } }),
    ])

    return { success: true, data: { deleted: chapters.length, deletedChapterNos: chapterNos } }
  })
}
