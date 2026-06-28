import type { ApiResponse } from '../contracts/api/base.js';
/**
 * World Memory API — 世界记忆图查询
 *
 * - GET /api/v1/world-memory/:projectId — 获取项目记忆概览
 * - GET /api/v1/world-memory/:projectId/context — 获取叙事上下文
 * - DELETE /api/v1/world-memory/:projectId — 清除记忆
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { worldMemory } from '../services/world-memory.service.js'
import { prisma } from '../utils/index.js'

export default async function worldMemoryRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/world-memory/:projectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as any
    const records = await prisma.worldMemory.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    // 按类型分组
    const grouped: Record<string, any[]> = { characters: [], world: [], events: [], relationships: [] }
    for (const r of records) {
      const key = r.entityType === 'character' ? 'characters'
        : r.entityType === 'world' ? 'world'
        : r.entityType === 'event' ? 'events'
        : 'relationships'
      grouped[key].push({
        id: r.entityId,
        name: r.name,
        memory: r.memory,
        tags: r.tags,
        episodeRef: r.episodeRef,
        updatedAt: r.updatedAt,
      })
    }

    return { success: true, data: { projectId, summary: grouped } } satisfies ApiResponse<unknown>;

  })

  fastify.get('/api/v1/world-memory/:projectId/context', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as any
    const query = request.query as any
    const episodeRef = query.episode ? parseInt(query.episode) : undefined
    const context = await worldMemory.getNarrativeContext(projectId, episodeRef)
    return { success: true, data: context } satisfies ApiResponse<unknown>;

  })

  fastify.delete('/api/v1/world-memory/:projectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as any
    await worldMemory.clearProject(projectId)
    return { success: true, message: '记忆已清除' } satisfies ApiResponse<unknown>;

  })
}
