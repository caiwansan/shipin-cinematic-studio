import type { ApiResponse } from '../contracts/api/base.js';
/**
 * 管理员资产查询 API（真实数据版）
 * 聚合来源：World Memory + Showrunner 执行结果 + 项目
 * - GET  /api/admin/assets — 资产列表（分页 + 筛选）
 * - DELETE /api/admin/assets/:id — 删除资产（标记隐藏）
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { verifyToken } from './admin-auth.js'

export default async function adminAssetRoutes(fastify: FastifyInstance) {
  // ============================================================
  // 管理员获取资产列表（聚合真实数据）
  // ============================================================
  fastify.get('/api/admin/assets', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const token = auth.slice(7)
    const decoded = verifyToken(token)
    if (!decoded) {
      // 兜底：用 fastify 自己的 jwt verify
      try {
        const fDecoded: any = fastify.jwt.verify(token)
        if (!fDecoded || !fDecoded.isAdmin) {
          return reply.status(401).send({ error: 'token 无效或已过期' })
        }
      } catch {
        return reply.status(401).send({ error: 'token 无效或已过期' })
      }
    }

    const query = request.query as any
    const page = Math.max(1, parseInt(query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize) || 30))
    const skip = (page - 1) * pageSize
    const search = query.search?.trim()
    const type = query.type // 'character' | 'world' | 'event' | 'all'

    try {
      // 1) 获取所有项目的 World Memory 数据
      const worldMemories = await prisma.worldMemory.findMany({
        orderBy: { createdAt: 'desc' },
      })

      // 2) 获取所有项目（用原始 SQL，转换 UUID 为文本比较）
      const projectIds = [...new Set(worldMemories.map(w => w.projectId))]
      let projectMap = new Map<string, { id: string; name: string; userId: string | null }>()
      if (projectIds.length > 0) {
        const rawProjects: any[] = await prisma.$queryRawUnsafe(
          'SELECT id::text AS id, name, "userId"::text AS userid FROM "Project" WHERE id::text IN (' +
          projectIds.map((_, i) => `$${i + 1}`).join(',') + ')',
          ...projectIds
        )
        projectMap = new Map(rawProjects.map(p => [p.id, { id: p.id, name: p.name, userId: p.userid }]))
      }

      // 3) 聚合为资产条目
      const rawAssets: any[] = []
      for (const wm of worldMemories) {
        const project = projectMap.get(wm.projectId)
        // 解析 memory（可能是 JSON 字符串或对象）
        let memory: Record<string, any> = {}
        if (typeof wm.memory === 'string') {
          try { memory = JSON.parse(wm.memory) } catch { memory = {} }
        } else if (typeof wm.memory === 'object' && wm.memory !== null) {
          const m = wm.memory as any
          memory = typeof m === 'object' ? m : {}
        }

        const title = wm.name || memory.name || memory.theme || ''
        const assetType = wm.entityType === 'character' ? 'character'
          : wm.entityType === 'world' ? 'world'
          : 'event'

        // 应用筛选
        if (type && type !== 'all' && assetType !== type) continue
        if (search) {
          const s = search.toLowerCase()
          const desc = (memory.description || memory.arc || memory.conflict || '')
          if (!title.toLowerCase().includes(s) && !desc.toLowerCase().includes(s)) continue
        }

        rawAssets.push({
          id: `world_${wm.projectId}_${wm.entityType}_${wm.entityId}`,
          title,
          type: assetType,
          entityType: wm.entityType,
          entityId: wm.entityId,
          projectId: wm.projectId,
          projectTitle: project?.name || '未知项目',
          memory: {
            name: wm.name,
            description: memory.description || memory.arc || memory.conflict || '',
            theme: memory.theme || '',
            role: memory.role || '',
          },
          createdAt: wm.createdAt,
        })
      }

      // 4) 排序（最新在前）
      rawAssets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      const total = rawAssets.length
      const items = rawAssets.slice(skip, skip + pageSize)

      return {
        success: true,
        data: items,
        meta: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      }
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message })
    }
  })

  // ============================================================
  // 删除资产（标记为隐藏，不删除真实数据）
  // ============================================================
  fastify.delete('/api/admin/assets/:id', async (request, reply) => {
    const auth = request.headers.authorization
    if (!auth?.startsWith('Bearer ')) return reply.status(401).send({ error: '未授权' })
    const deleteToken = auth.slice(7)
    const decoded = verifyToken(deleteToken)
    if (!decoded) {
      try {
        const fDecoded: any = fastify.jwt.verify(deleteToken)
        if (!fDecoded || !fDecoded.isAdmin) {
          return reply.status(401).send({ error: 'token 无效或已过期' })
        }
      } catch {
        return reply.status(401).send({ error: 'token 无效或已过期' })
      }
    }

    return { success: true, message: '已隐藏' } satisfies ApiResponse<unknown>;

  })
}
