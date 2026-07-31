/**
 * routes/hdz/character-mind.ts
 *
 * HDZNOVEL-REALITY-02-A Task 3: 人物心理状态卡（CharacterMindState）
 *
 * GET    /api/hdz/projects/:projectId/character-minds/:charId      — 获取心理档案（无则自动初始化）
 * PUT    /api/hdz/projects/:projectId/character-minds/:charId      — 用户校正心理档案
 * GET    /api/hdz/projects/:projectId/character-minds              — 获取项目全部角色心理档案
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { getMindState, upsertMindState } from '../../services/hdz/character-mind.service.js'

export default async function characterMindRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  const verifyChar = async (userId: string, projectId: string, characterId: string) => {
    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== userId) return null
    const character = await prisma.hdzCharacter.findUnique({ where: { id: characterId } })
    if (!character || character.projectId !== projectId) return null
    return character
  }

  // 获取单个角色心理档案（无则自动初始化）
  app.get('/api/hdz/projects/:projectId/character-minds/:charId', async (request, reply) => {
    const user = request.user as any
    const { projectId, charId } = request.params as any

    const character = await verifyChar(user.id, projectId, charId)
    if (!character) return reply.status(404).send({ success: false, error: '角色不存在' })

    const mind = await getMindState(projectId, charId)
    return { success: true, data: mind }
  })

  // 用户校正心理档案
  app.put('/api/hdz/projects/:projectId/character-minds/:charId', async (request, reply) => {
    const user = request.user as any
    const { projectId, charId } = request.params as any
    const body = request.body as any

    const character = await verifyChar(user.id, projectId, charId)
    if (!character) return reply.status(404).send({ success: false, error: '角色不存在' })

    const mind = await upsertMindState(projectId, charId, body.chapterNo || 0, {
      fear: body.fear, desire: body.desire, belief: body.belief,
      trauma: body.trauma, moralBoundary: body.moralBoundary,
      personalityDrift: body.personalityDrift, summary: body.summary,
    })
    return { success: true, data: mind }
  })

  // 获取项目全部角色心理档案
  app.get('/api/hdz/projects/:projectId/character-minds', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const minds = await prisma.characterMindState.findMany({
      where: { projectId },
      include: { character: { select: { id: true, name: true, role: true } } },
    })
    return { success: true, data: minds }
  })
}
