/**
 * 混沌珠 — 角色 CRUD
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { hdzCreateCharacterSchema, validateOrReject } from '../../schemas/hdz.js'

export default async function hdzCharacterRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // POST /api/hdz/character/:projectId — 添加角色
  app.post('/api/hdz/character/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const body = validateOrReject(request.body, hdzCreateCharacterSchema, reply)
    if (!body) return

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 合并 properties：保留旧 properties 中的值，新传入的字段覆盖
    const mergedProperties: Record<string, any> = {
      ...(body.properties || {}),
    }
    if (body.faction !== undefined) mergedProperties.faction = body.faction
    if (body.appearance !== undefined) mergedProperties.appearance = body.appearance
    if (body.personality !== undefined) mergedProperties.personality = body.personality
    if (body.backstory !== undefined) mergedProperties.backstory = body.backstory
    if (body.skills !== undefined) mergedProperties.skills = body.skills
    if (body.growthArc !== undefined) mergedProperties.growthArc = body.growthArc

    const character = await prisma.hdzCharacter.create({
      data: {
        projectId,
        name: body.name,
        role: body.role,
        properties: mergedProperties,
        relations: body.relations || [],
        arc: body.arc || null,
      },
    })
    return { success: true, data: character }
  })

  // PUT /api/hdz/character/:projectId/:characterId — 更新角色
  app.put('/api/hdz/character/:projectId/:characterId', async (request, reply) => {
    const user = request.user as any
    const { projectId, characterId } = request.params as any
    const {
      name, role, properties, relations, arc,
      // 扩充的字段：直接合并到 properties
      faction, appearance, personality, backstory, skills, growthArc,
    } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '无权限' })
    }

    // 获取现有角色以合并 properties
    const existing = await prisma.hdzCharacter.findUnique({ where: { id: characterId } })
    interface CharProps {
      faction?: string
      appearance?: string
      personality?: string
      backstory?: string
      skills?: string
      growthArc?: string
    }
    const existingProperties: CharProps = (existing?.properties as CharProps) || {}
    const mergedProperties: CharProps = {
      ...existingProperties,
      ...(properties || {}),
    }
    if (faction !== undefined) mergedProperties.faction = faction
    if (appearance !== undefined) mergedProperties.appearance = appearance
    if (personality !== undefined) mergedProperties.personality = personality
    if (backstory !== undefined) mergedProperties.backstory = backstory
    if (skills !== undefined) mergedProperties.skills = skills
    if (growthArc !== undefined) mergedProperties.growthArc = growthArc

    const updated = await prisma.hdzCharacter.update({
      where: { id: characterId, projectId },
      data: {
        name: name ?? undefined,
        role: role ?? undefined,
        properties: mergedProperties,
        relations: relations ?? undefined,
        arc: arc ?? undefined,
      },
    })
    return { success: true, data: updated }
  })

  // DELETE /api/hdz/character/:projectId/:characterId — 删除角色
  app.delete('/api/hdz/character/:projectId/:characterId', async (request, reply) => {
    const user = request.user as any
    const { projectId, characterId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '无权限' })
    }

    await prisma.hdzCharacter.delete({ where: { id: characterId, projectId } })
    return { success: true, data: { deleted: true } }
  })

  // POST /api/hdz/character/:projectId/batch — 批量创建角色
  app.post('/api/hdz/character/:projectId/batch', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { characters } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    if (!Array.isArray(characters) || characters.length === 0) {
      return reply.status(400).send({ success: false, error: '请提供角色列表' })
    }

    // 获取已有角色名称，用于去重
    const existingChars = await prisma.hdzCharacter.findMany({
      where: { projectId },
      select: { name: true },
    })
    const existingNames = new Set(existingChars.map(c => c.name))

    let createdCount = 0
    let skippedCount = 0
    const results: Array<{ name: string; status: string; id?: string; error?: string }> = []

    for (const ch of characters) {
      const chName = (ch.name || '').trim()
      if (!chName) {
        skippedCount++
        results.push({ name: '', status: 'skipped', error: '名称为空' })
        continue
      }

      // 去重：已有 name 不覆盖
      if (existingNames.has(chName)) {
        skippedCount++
        results.push({ name: chName, status: 'skipped', error: '已存在' })
        continue
      }

      try {
        // 构建 properties
        const properties: Record<string, any> = {}
        if (ch.faction !== undefined) properties.faction = ch.faction
        if (ch.appearance !== undefined) properties.appearance = ch.appearance
        if (ch.personality !== undefined) properties.personality = ch.personality
        if (ch.backstory !== undefined) properties.backstory = ch.backstory
        if (ch.skills !== undefined) properties.skills = ch.skills
        if (ch.growthArc !== undefined) properties.growthArc = ch.growthArc

        const created = await prisma.hdzCharacter.create({
          data: {
            projectId,
            name: chName,
            role: ch.role || 'supporting',
            properties,
            relations: ch.relations || [],
            arc: ch.arc || null,
          },
        })
        createdCount++
        existingNames.add(chName) // 防止同一批次内同名
        results.push({ name: chName, status: 'created', id: created.id })
      } catch (err: any) {
        skippedCount++
        results.push({ name: chName, status: 'error', error: err.message })
      }
    }

    return {
      success: true,
      data: {
        created: createdCount,
        skipped: skippedCount,
        total: characters.length,
        results,
      },
    }
  })
}
