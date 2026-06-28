/**
 * 混沌珠 — 记忆库路由
 * 7-Truths 型记忆文件的读写
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

const MEMORY_TYPES = ['world_state', 'character_matrix', 'pending_hooks', 'chapter_summary', 'location_state', 'pov_tracker', 'timeline'] as const

export default async function hdzMemoryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /api/hdz/memory/:projectId — 获取项目全部记忆
  app.get('/api/hdz/memory/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const memories = await prisma.hdzMemory.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: memories }
  })

  // PUT /api/hdz/memory/:projectId/:type — 更新指定类型的记忆
  app.put('/api/hdz/memory/:projectId/:type', async (request, reply) => {
    const user = request.user as any
    const { projectId, type } = request.params as any
    const { content } = request.body as any

    if (!MEMORY_TYPES.includes(type)) {
      return reply.status(400).send({ success: false, error: `无效记忆类型: ${type}，有效: ${MEMORY_TYPES.join(', ')}` })
    }

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // upsert：找出最新一条相同 type 的记录，更新或创建
    const existing = await prisma.hdzMemory.findFirst({
      where: { projectId, type },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      const updated = await prisma.hdzMemory.update({
        where: { id: existing.id },
        data: {
          content,
          version: existing.version + 1,
        },
      })
      return { success: true, data: updated }
    }

    const created = await prisma.hdzMemory.create({
      data: { projectId, type, content },
    })
    return { success: true, data: created }
  })
}
