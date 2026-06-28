// ============================================================
// routes/execution-images/character-images.ts
//
// 职责：角色图 CRUD（POST/PUT/GET/DELETE）
// 设计约束：
//   - 不含任何业务逻辑，只做 JSON 编排
//   - 所有图片生成通过 submit-task.ts pipeline runtime 执行
//   - 不直接调用 fetch、不直接操作 DB 业务判断
// ============================================================

import type { ApiResponse } from '../../contracts/api/base.js'
import { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { StyleProfileService } from '../../services/style-profile.service.js'
import crypto from 'crypto'
import { createCharacterValidator } from '../../services/image/pipeline/validators/character-validator.js'

export default async function characterImageRoutes(fastify: FastifyInstance) {
  // ─── POST 生成角色图（含四视图/六视图） ──────────────

  fastify.post('/generate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as any
    const { characterId, character, storyText } = body || {}
    if (!character || !character.name) {
      console.warn('[CharacterImages] 400: character.name 缺失')
      return reply.status(400).send({ error: 'character object with name required' })
    }

    const authHeader = (request.headers as any).authorization || ''
    const userId = (request.user as any)?.id || 'anonymous'
    const baseUrl = `http://localhost:${process.env.PORT || 4000}`

    // ── projectId 兜底 ──
    let pid = body.projectId
    if (!pid) {
      const lastProject = await prisma.project.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      if (lastProject) {
        pid = lastProject.id
      } else {
        const newProject = await prisma.project.create({
          data: { id: crypto.randomUUID(), name: character.name, userId },
        })
        pid = newProject.id
      }
    }

    try {
      const imagePrompt = character.imagePrompt || ''
      const negativePrompt = character.negativePrompt || ''
      const tripleView = body.tripleView === true || character.tripleView === true

      // ⭐ 风格从 StyleProfile 读取
      const vs: string = body.videoStyle || 'realistic'
      const profile = await StyleProfileService.getByName(vs)
      const styleTokens = profile?.styleTokens || '写实真人，电影级画质'
      const negativeTokens = profile?.negativeTokens || ''

      console.log(`[CharacterImages] 🚀 name=${character.name}, tripleView=${tripleView}`)

      // ── 调用四视图生成 ──
      const { generateCharacterViews } = await import('../../services/image/character-pipeline.js')
      const charValidator = createCharacterValidator()
      const result = await generateCharacterViews({
        character,
        imagePrompt,
        negativePrompt,
        tripleView,
        styleTokens,
        negativeTokens,
        pid,
        userId,
        authHeader,
        baseUrl,
        storyText,
      }, [charValidator])

      return {
        success: true,
        data: {
          imageUrl: result.imageUrl,
          viewUrls: result.viewUrls,
          characterId,
          ...result.meta,
        },
      } satisfies ApiResponse<unknown>

    } catch (e: any) {
      console.error('[CharacterImages] 生成异常:', e.message)
      return reply.status(500).send({ error: `角色图生成失败: ${e.message}` })
    }
  })

  // ─── PUT 更新角色图 ──────────────────────────────────

  fastify.put('/update', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, images } = request.body as any
    if (!projectId || !images) return reply.status(400).send({ error: 'projectId and images required' })

    const existing = await prisma.project.findUnique({ where: { id: projectId } })
    if (!existing) {
      await prisma.project.create({
        data: { id: projectId, name: '临时项目', userId: (request.user as any).id },
      })
    }

    await prisma.$transaction(
      (images || []).map((img: any, i: number) => {
        const charName = img.characterName || (img.characterName === undefined && img.variant ? '' : `char_${i}`)
        return prisma.characterImage.upsert({
          where: {
            projectId_characterName_variant: {
              projectId,
              characterName: charName,
              variant: img.variant || '',
            },
          },
          update: { imageUrl: img.url, sortOrder: i },
          create: { projectId, imageUrl: img.url, characterName: charName, variant: img.variant || '', sortOrder: i },
        })
      }),
    )
    return { success: true } as unknown as ApiResponse<unknown>
  })

  // ─── GET 读取角色图 ──────────────────────────────────

  fastify.get('/list/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      return { success: true, data: [] } as ApiResponse<unknown>
    }
    const images = await prisma.characterImage.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
    })
    return { success: true, data: images } as ApiResponse<unknown>
  })

  // ─── DELETE 删除角色图 ───────────────────────────────

  fastify.delete('/delete/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    if (!id) return reply.status(400).send({ error: 'id required' })
    try {
      await prisma.characterImage.delete({ where: { id } })
      return { success: true } as unknown as ApiResponse<unknown>
    } catch (e: any) {
      console.warn('[CharacterImages] delete error:', e.message)
      return reply.status(404).send({ error: 'not found' })
    }
  })
}
