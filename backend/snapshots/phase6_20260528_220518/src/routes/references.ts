import type { ApiResponse } from '../contracts/api/base.js';
/**
 * 角色/场景参考图 API — 一致性系统
 *
 * 1. 角色生成后自动存 Reference → 后续场景/分镜/视频带图复用
 * 2. 场景生成后自动存 Reference → 后续跨集复用
 * 3. 按项目+角色名/场景名查询
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function referenceRoutes(fastify: FastifyInstance) {

  // ─── 角色参考图 ───

  // 保存/更新角色参考图
  fastify.put('/api/v1/references/characters', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const body = request.body as any
    const { projectId, characterName, imageUrl, refType } = body

    if (!projectId || !characterName || !imageUrl) {
      return reply.status(400).send({ error: '缺少必填字段：projectId, characterName, imageUrl' })
    }

    // upsert: 同一项目+角色名+类型只存一条
    const ref = await prisma.characterReference.upsert({
      where: {
        projectId_characterName_refType: {
          projectId,
          characterName,
          refType: refType || 'standard',
        },
      },
      update: { imageUrl },
      create: {
        projectId,
        characterName,
        imageUrl,
        refType: refType || 'standard',
      },
    })

    return { success: true, data: ref } satisfies ApiResponse<unknown>;

  })

  // 批量保存角色参考图（一次把所有角色存进去）
  fastify.put('/api/v1/references/characters/batch', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, characters } = request.body as any
    // characters: [{ characterName, imageUrl, refType? }]

    if (!projectId || !characters?.length) {
      return reply.status(400).send({ error: '缺少必填字段' })
    }

    for (const c of characters) {
      await prisma.characterReference.upsert({
        where: {
          projectId_characterName_refType: {
            projectId,
            characterName: c.characterName,
            refType: c.refType || 'standard',
          },
        },
        update: { imageUrl: c.imageUrl },
        create: {
          projectId,
          characterName: c.characterName,
          imageUrl: c.imageUrl,
          refType: c.refType || 'standard',
        },
      })
    }

    return { success: true } satisfies ApiResponse<unknown>;

  })

  // 查询项目角色参考图
  fastify.get('/api/v1/references/characters/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const query = request.query as any
    const characterNames = query.names ? query.names.split(',') : []

    const where: any = { projectId }
    if (characterNames.length > 0) {
      where.characterName = { in: characterNames }
    }

    const refs = await prisma.characterReference.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // 按角色名分组
    const grouped: Record<string, Record<string, string>> = {}
    for (const ref of refs) {
      if (!grouped[ref.characterName]) grouped[ref.characterName] = {}
      grouped[ref.characterName][ref.refType] = ref.imageUrl
    }

    return { success: true, data: grouped } satisfies ApiResponse<unknown>;

  })

  // ─── 场景参考图 ───

  // 保存/更新场景参考图
  fastify.put('/api/v1/references/scenes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, sceneName, imageUrl, refType } = request.body as any

    if (!projectId || !sceneName || !imageUrl) {
      return reply.status(400).send({ error: '缺少必填字段' })
    }

    const ref = await prisma.sceneReference.upsert({
      where: {
        projectId_sceneName_refType: {
          projectId,
          sceneName,
          refType: refType || 'standard',
        },
      },
      update: { imageUrl },
      create: {
        projectId,
        sceneName,
        imageUrl,
        refType: refType || 'standard',
      },
    })

    return { success: true, data: ref } satisfies ApiResponse<unknown>;

  })

  // 查询场景参考图
  fastify.get('/api/v1/references/scenes/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const { names } = request.query as any
    const sceneNames = names ? names.split(',') : []

    const where: any = { projectId }
    if (sceneNames.length > 0) {
      where.sceneName = { in: sceneNames }
    }

    const refs = await prisma.sceneReference.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const grouped: Record<string, Record<string, string>> = {}
    for (const ref of refs) {
      if (!grouped[ref.sceneName]) grouped[ref.sceneName] = {}
      grouped[ref.sceneName][ref.refType] = ref.imageUrl
    }

    return { success: true, data: grouped } satisfies ApiResponse<unknown>;

  })

  // ─── AI Prompt 注入：角色参考图 → 图片生成 ───

  // 自动为图片生成 prompt 注入角色参考描述
  fastify.post('/api/v1/references/inject-character-refs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, characterNames } = request.body as any

    const where: any = { projectId }
    if (characterNames?.length) {
      where.characterName = { in: characterNames }
    }

    const refs = await prisma.characterReference.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // 构建注入文本
    const injectLines = refs.map(ref =>
      `[角色参考] ${ref.characterName}: ${ref.refType}→${ref.imageUrl}`
    )

    return { success: true, data: { references: refs, injectText: injectLines.join('\n') } } satisfies ApiResponse<unknown>;

  })
}
