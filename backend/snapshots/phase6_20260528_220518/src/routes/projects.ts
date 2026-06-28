import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { projectService } from '../services/project.service.js'
import { projectHydrateService, type FullCreateInput } from '../services/project-hydrate.service.js'
import { prisma } from '../utils/index.js'

export default async function projectRoutes(fastify: FastifyInstance) {
  // GET /api/projects
  fastify.get('/api/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    return await projectService.findAll(user.id)
  })

  // GET /api/projects/:id
  fastify.get('/api/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    return await projectService.findById(id)
  })

  // POST /api/projects
  fastify.post('/api/projects', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const data = request.body as any
    const user = request.user as any
    return await projectService.create({ ...data, userId: user.id })
  })

  // POST /api/projects/full-create — 全量创建项目（事务一次性写入所有数据）
  fastify.post('/api/projects/full-create', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const input = request.body as FullCreateInput
    const user = request.user as any
    const project = await projectHydrateService.fullCreate({ ...input, userId: user.id })
    return { success: true, project } satisfies ApiResponse<unknown>;

  })

  // POST /api/projects/:id/save-specs — 保存/更新关联规格表（角色/场景/情绪等）
  fastify.post('/api/projects/:id/save-specs', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const specs = request.body as any
    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) return reply.status(404).send({ error: '项目不存在' })

    const { characterSpecs, sceneSpecs, emotionSpecs, videoSegments } = specs

    if (characterSpecs?.length) {
      await prisma.aiCharacterSpec.deleteMany({ where: { projectId: id } })
      await prisma.aiCharacterSpec.createMany({
        data: characterSpecs.map((c: any, i: number) => ({
          projectId: id,
          characterName: c.characterName || c.name || '',
          gender: c.gender || '',
          age: c.age || '',
          physicalDescription: c.physicalDescription || c.description || '',
          clothing: c.clothing || c.costume || '',
          imagePrompt: c.imagePrompt || '',
          negativePrompt: c.negativePrompt || '',
          sortOrder: i,
        })),
      })
    }
    if (sceneSpecs?.length) {
      await prisma.aiSceneSpec.deleteMany({ where: { projectId: id } })
      await prisma.aiSceneSpec.createMany({
        data: sceneSpecs.map((s: any, i: number) => ({
          projectId: id,
          sceneId: s.sceneId || s.id || `scene_${i}`,
          sceneName: s.sceneName || s.name || '',
          description: s.description || s.environment || '',
          imagePrompt: s.imagePrompt || '',
          sortOrder: i,
        })),
      })
    }
    if (emotionSpecs?.length) {
      await prisma.aiEmotionSpec.deleteMany({ where: { projectId: id } })
      await prisma.aiEmotionSpec.createMany({
        data: emotionSpecs.map((e: any, i: number) => ({
          projectId: id,
          characterName: '',
          emotionType: e.emotion || e.label || 'calm',
          intensity: String(e.intensity ?? 0.5),
          sortOrder: e.time ?? i,
        })),
      })
    }
    if (videoSegments?.length) {
      await prisma.aiVideoSegment.deleteMany({ where: { projectId: id } })
      await prisma.aiVideoSegment.createMany({
        data: videoSegments.map((vs: any, i: number) => ({
          projectId: id,
          segmentId: vs.segmentId || `seg_${i}`,
          title: vs.title || vs.summary || '',
          associatedScenes: JSON.stringify(vs.associatedScenes || ['']),
          duration: vs.duration || 5,
          narrativePurpose: vs.narrativePurpose || vs.summary || '',
          shotPattern: vs.shotPattern || 'medium',
          emotionArc: vs.emotionArc || vs.emotion || 'calm',
          backgroundMusic: vs.backgroundMusic || '',
          sortOrder: i,
        })),
      })
    }

    return { success: true, message: '规格数据已保存' } satisfies ApiResponse<unknown>;

  })

  // PUT /api/projects/:id
  fastify.put('/api/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const data = request.body as any
    try {
      const result = await projectService.update(id, data)
      return result
    } catch (err: any) {
      if (err.statusCode === 409) {
        return reply.code(409).send({ success: false, error: err.message, code: 'VERSION_CONFLICT' })
      }
      throw err
    }
  })

  // DELETE /api/projects/:id
  fastify.delete('/api/projects/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    return await projectService.delete(id)
  })

  // GET /api/projects/:id/hydrate — 全量加载项目状态
  fastify.get('/api/projects/:id/hydrate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const data = await projectHydrateService.hydrate(id)
    if (!data) {
      return reply.status(404).send({ success: false, error: 'Project not found' })
    }
    return { success: true, ...data } satisfies ApiResponse<unknown>;

  })

  // GET /api/projects/:id/execution-results
  fastify.get('/api/projects/:id/execution-results', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const results = await projectService.getExecutionResults(id)
    if (!results) {
      return reply.status(404).send({ success: false, error: 'No execution results found' })
    }
    return { success: true, data: results } satisfies ApiResponse<unknown>;

  })

  // PUT /api/projects/:id/execution-results
  // Supports _merge mode: merge into existing executionResults instead of replacing
  fastify.put('/api/projects/:id/execution-results', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const body = request.body as any
    const { executionResults, _merge, _stage } = body
    if (!executionResults) {
      return reply.status(400).send({ success: false, error: 'executionResults is required' })
    }

    if (_merge) {
      // Merge mode: combine with existing executionResults
      const project = await prisma.project.findUnique({
        where: { id },
        select: { executionResults: true },
      })
      const existing = (project?.executionResults as Record<string, any>) || {}
      if (_stage) {
        const stageKeyMap: Record<string, string> = {
          character: 'characterSpecs',
          scene: 'sceneSpecs',
          voice: 'voiceConfigs',
          storyboard: 'videoSegments',
          video: 'videoSegments',
          props: 'propSpecs',
        }
        const key = stageKeyMap[_stage as string]
        if (key && executionResults[key]) {
          const merged = { ...existing, [key]: executionResults[key] }
          await prisma.project.update({
            where: { id },
            data: { executionResults: merged as any },
          })
          return { success: true } satisfies ApiResponse<unknown>;

        }
      }
      // Fallback: shallow merge all keys
      const merged = { ...existing, ...executionResults }
      await prisma.project.update({
        where: { id },
        data: { executionResults: merged as any },
      })
      return { success: true } satisfies ApiResponse<unknown>;

    }

    // Full replace mode (legacy)
    await projectService.saveExecutionResults(id, executionResults)
    return { success: true } satisfies ApiResponse<unknown>;

  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

