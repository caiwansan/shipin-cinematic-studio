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
}
