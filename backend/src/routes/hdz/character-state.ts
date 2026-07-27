/**
 * routes/hdz/character-state.ts
 *
 * HDZ-NOVEL-INTELLIGENCE-01: 角色动态状态时间线 CRUD
 *
 * GET    /api/hdz/projects/:projectId/character-states          — 获取全部角色状态时间线
 * POST   /api/hdz/projects/:projectId/character-states          — 新增状态变更
 * GET    /api/hdz/projects/:projectId/character-states/:charId  — 获取角色完整状态
 * DELETE /api/hdz/projects/:projectId/character-states/:stateId — 删除错误记录
 * GET    /api/hdz/projects/:projectId/character-profiles        — 获取角色当前完整档案（用于前端展示）
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function characterStateRoutes(app: FastifyInstance) {
  // 用户身份验证
  app.addHook('preHandler', app.authenticate)

  // 获取全部角色状态时间线
  app.get('/api/hdz/projects/:projectId/character-states', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    const states = await prisma.hdzCharacterState.findMany({
      where: { projectId },
      orderBy: [{ chapterNo: 'asc' }, { createdAt: 'asc' }],
    })

    return { success: true, data: states }
  })

  // 新增状态变更
  app.post('/api/hdz/projects/:projectId/character-states', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { characterId, chapterNo, stateType, event, description, severity, recoveryChapter } = request.body as any

    if (!characterId || !stateType || !event) {
      return reply.status(400).send({ success: false, error: '缺少必填字段: characterId, stateType, event' })
    }

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    // 验证角色存在
    const char = await prisma.hdzCharacter.findUnique({ where: { id: characterId } })
    if (!char || char.projectId !== projectId) {
      return reply.status(404).send({ success: false, error: '角色不存在' })
    }

    const state = await prisma.hdzCharacterState.create({
      data: {
        projectId,
        characterId,
        chapterNo: chapterNo || 0,
        stateType: stateType.toUpperCase(),
        event,
        description,
        severity: severity || 'normal',
        recoveryChapter,
      },
    })

    // Freeze Patch-02: 状态自动闭环
    // 当新增 RECOVERY 类型状态时，自动找到同一角色前一个未解决的 INJURY 并标记为已解决
    if (stateType.toUpperCase() === 'RECOVERY') {
      const pendingInjuries = await prisma.hdzCharacterState.findMany({
        where: {
          projectId,
          characterId,
          stateType: 'INJURY',
          recoveryChapter: { not: null },
        },
        orderBy: { chapterNo: 'asc' },
      })

      // 找到 recoveryChapter <= 当前 chapterNo 的 INJURY，标记为已解决
      for (const injury of pendingInjuries) {
        if (injury.recoveryChapter && injury.recoveryChapter <= (chapterNo || 0)) {
          await prisma.hdzCharacterState.update({
            where: { id: injury.id },
            data: {
              // 通过 description 附加解决标记
              description: `${injury.description || ''}\n[已解决: 第${chapterNo}章]`.trim(),
            },
          })
        }
      }
    }

    return { success: true, data: state }
  })

  // 获取角色完整状态档案（含当前状态合并）
  app.get('/api/hdz/projects/:projectId/character-states/:characterId', async (request, reply) => {
    const user = request.user as any
    const { projectId, characterId } = request.params as any

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    const [character, states] = await Promise.all([
      prisma.hdzCharacter.findUnique({ where: { id: characterId } }),
      prisma.hdzCharacterState.findMany({
        where: { projectId, characterId },
        orderBy: { chapterNo: 'asc' },
      }),
    ])

    if (!character) return reply.status(404).send({ success: false, error: '角色不存在' })

    return { success: true, data: { character, states } }
  })

  // 删除错误记录
  app.delete('/api/hdz/projects/:projectId/character-states/:stateId', async (request, reply) => {
    const user = request.user as any
    const { projectId, stateId } = request.params as any

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    await prisma.hdzCharacterState.delete({ where: { id: stateId } })
    return { success: true }
  })

  // 获取角色当前完整档案（合并版，前端展示用）
  app.get('/api/hdz/projects/:projectId/character-profiles', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    const characters = await prisma.hdzCharacter.findMany({ where: { projectId } })
    const states = await prisma.hdzCharacterState.findMany({
      where: { projectId },
      orderBy: { chapterNo: 'asc' },
    })

    const STATE_TYPES = ['HEALTH', 'INJURY', 'RELATIONSHIP', 'POWER', 'LOCATION', 'ITEM', 'MENTAL', 'IDENTITY']

    const profiles = characters.map(char => {
      const charStates = states.filter(s => s.characterId === char.id)
      const props = (char.properties as any) || {}

      // 按类型合并状态，过滤已解决的 INJURY
      const byType: Record<string, any[]> = {}
      for (const t of STATE_TYPES) byType[t] = []

      // 找出所有有 resolution 标记的状态（description 含 [已解决:）
      const resolvedStateIds = new Set(
        charStates
          .filter(s => s.description && s.description.includes('[已解决:'))
          .map(s => s.id)
      )

      for (const s of charStates) {
        const t = s.stateType.toUpperCase()
        if (!byType[t]) byType[t] = []
        // 跳过已解决的状态（不放入 currentState）
        if (resolvedStateIds.has(s.id)) continue
        byType[t].push({
          id: s.id,
          chapterNo: s.chapterNo,
          event: s.event,
          description: s.description,
          severity: s.severity,
          recoveryChapter: s.recoveryChapter,
          resolved: false,
        })
      }

      return {
        id: char.id,
        name: char.name,
        role: char.role,
        properties: props,
        arc: char.arc,
        relations: char.relations,
        currentState: {
          HEALTH: byType.HEALTH,
          INJURY: byType.INJURY,
          RELATIONSHIP: byType.RELATIONSHIP,
          POWER: byType.POWER,
          LOCATION: byType.LOCATION,
          ITEM: byType.ITEM,
          MENTAL: byType.MENTAL,
          IDENTITY: byType.IDENTITY,
        },
        totalChanges: charStates.length,
      }
    })

    return { success: true, data: profiles }
  })
}
