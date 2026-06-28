/**
 * 混沌珠 — 组织/势力 CRUD（宗门/国家/公司/家族/帮派等）
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function hdzFactionRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // POST /api/hdz/faction/:projectId — 创建组织
  app.post('/api/hdz/faction/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { name, type, description, leaderIds, memberIds, properties } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }
    if (!name?.trim()) {
      return reply.status(400).send({ success: false, error: '请输入组织名称' })
    }

    const faction = await prisma.hdzFaction.create({
      data: {
        projectId,
        name: name.trim(),
        type: type || 'sect',
        description: description || null,
        leaderIds: leaderIds || [],
        memberIds: memberIds || [],
        properties: properties || {},
      },
    })
    return { success: true, data: faction }
  })

  // GET /api/hdz/faction/:projectId — 获取宗门列表
  app.get('/api/hdz/faction/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const factions = await prisma.hdzFaction.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: factions }
  })

  // GET /api/hdz/faction/:projectId/:factionId — 获取宗门详情
  app.get('/api/hdz/faction/:projectId/:factionId', async (request, reply) => {
    const user = request.user as any
    const { projectId, factionId } = request.params as any

    const faction = await prisma.hdzFaction.findUnique({ where: { id: factionId, projectId } })
    if (!faction) return reply.status(404).send({ success: false, error: '宗门不存在' })

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '无权限' })
    }

    return { success: true, data: faction }
  })

  // PUT /api/hdz/faction/:projectId/:factionId — 更新组织
  app.put('/api/hdz/faction/:projectId/:factionId', async (request, reply) => {
    const user = request.user as any
    const { projectId, factionId } = request.params as any
    const { name, type, description, leaderIds, memberIds, properties } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '无权限' })
    }

    const updated = await prisma.hdzFaction.update({
      where: { id: factionId, projectId },
      data: {
        name: name ?? undefined,
        type: type ?? undefined,
        description: description ?? undefined,
        leaderIds: leaderIds ?? undefined,
        memberIds: memberIds ?? undefined,
        properties: properties ?? undefined,
      },
    })
    return { success: true, data: updated }
  })

  // POST /api/hdz/faction/:projectId/batch — 批量创建组织（支持去重）
  app.post('/api/hdz/faction/:projectId/batch', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { factions } = request.body as any

    // 校验项目权限
    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }
    if (!Array.isArray(factions) || factions.length === 0) {
      return reply.status(400).send({ success: false, error: '请提供组织列表' })
    }

    // 获取已存在的组织名称（用于去重）
    const existing = await prisma.hdzFaction.findMany({
      where: { projectId },
      select: { name: true },
    })
    const existingNames = new Set(existing.map(f => f.name.trim().toLowerCase()))

    const created: any[] = []
    let skipped = 0

    for (const f of factions) {
      const name = (f.name || '').trim()
      if (!name) {
        skipped++
        continue
      }

      // 去重：忽略已存在的同名组织（大小写不敏感）
      if (existingNames.has(name.toLowerCase())) {
        skipped++
        continue
      }

      // 通过 leaderNames/memberNames 查找对应角色 ID
      const allChars = await prisma.hdzCharacter.findMany({
        where: { projectId },
        select: { id: true, name: true },
      })
      const charByName = new Map(allChars.map(c => [c.name.trim().toLowerCase(), c.id]))

      const leaderIds = (f.leaderNames || []).map((n: string) => charByName.get(n.trim().toLowerCase())).filter(Boolean)
      const memberIds = (f.memberNames || []).map((n: string) => charByName.get(n.trim().toLowerCase())).filter(Boolean)

      const faction = await prisma.hdzFaction.create({
        data: {
          projectId,
          name,
          type: f.type || 'sect',
          description: f.description || null,
          leaderIds: [...new Set([...leaderIds, ...(f.leaderIds || [])])],
          memberIds: [...new Set([...memberIds, ...(f.memberIds || [])])],
          properties: f.properties || {},
        },
      })

      // 记录已创建名称，防止同一批次内的重复
      existingNames.add(name.toLowerCase())
      created.push(faction)
    }

    return {
      success: true,
      data: {
        created: created.length,
        skipped,
        total: factions.length,
        results: created,
      },
    }
  })

  // DELETE /api/hdz/faction/:projectId/:factionId — 删除宗门
  app.delete('/api/hdz/faction/:projectId/:factionId', async (request, reply) => {
    const user = request.user as any
    const { projectId, factionId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '无权限' })
    }

    await prisma.hdzFaction.delete({ where: { id: factionId, projectId } })
    return { success: true, data: { deleted: true } }
  })
}
