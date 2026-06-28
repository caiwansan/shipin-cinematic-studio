import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/project-decomposition.ts — 项目分解数据写入 API
 *
 * 用户在"审核确认"页面点击确认时，将总指挥拆解结果写入项目 DB。
 * 后续各步骤（角色/场景/分镜/视频）各自写入独立表。
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function projectDecompositionRoutes(fastify: FastifyInstance) {
  // PATCH /api/projects/:id/decomposition
  // 将 AI 拆解结果写入已有项目（非事务创建，仅更新/写入）
  fastify.patch('/api/projects/:id/decomposition', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const { script, plotBlueprint, characterSpecs, sceneSpecs } = body

    // 1. 检查项目存在
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 2. 更新项目主表（剧本 + plotBlueprint）
    await prisma.project.update({
      where: { id },
      data: {
        ...(script ? { description: script } : {}),
        ...(plotBlueprint ? { plotBlueprint } : {}),
      },
    })

    // 3. 写入角色规格（先删旧数据再插入，保证增量覆盖）
    if (characterSpecs?.length) {
      await prisma.aiCharacterSpec.deleteMany({ where: { projectId: id } })
      await prisma.aiCharacterSpec.createMany({
        data: characterSpecs.map((c: any, i: number) => ({
          projectId: id,
          characterName: c.name || c.characterName || `角色${i + 1}`,
          gender: c.gender || '',
          age: c.age ? String(c.age) : '',
          physicalDescription: c.physicalDescription || c.appearance || '',
          clothing: c.clothing || c.dressDetail || '',
          imagePrompt: c.imagePrompt || '',
          negativePrompt: c.negativePrompt || '',
          personality: c.personality || '',
          background: c.background || '',
          aura: c.aura || '',
          stateEvolution: c.stateEvolution || [],
          variants: c.variants || [],
          referenceImageUrl: c.referenceImageUrl || '',
          sortOrder: i,
        })),
      })
    }

    // 4. 写入场景规格
    if (sceneSpecs?.length) {
      await prisma.aiSceneSpec.deleteMany({ where: { projectId: id } })
      await prisma.aiSceneSpec.createMany({
        data: sceneSpecs.map((s: any, i: number) => ({
          projectId: id,
          sceneId: s.id || s.sceneId || `scene_${i}`,
          sceneName: s.name || s.sceneName || `场景${i + 1}`,
          description: s.description || '',
          imagePrompt: s.imagePrompt || '',
          negativePrompt: s.negativePrompt || '',
          aspectRatio: s.aspectRatio || '16:9',
          sortOrder: i,
        })),
      })
    }

    return { success: true, projectId: id } satisfies ApiResponse<unknown>;

  })
}
