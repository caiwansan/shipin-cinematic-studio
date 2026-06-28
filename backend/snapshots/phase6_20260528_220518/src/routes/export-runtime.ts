import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/export-runtime.ts — 导出 API
 *
 * POST /api/export/create - 创建导出任务
 * GET /api/export/:id - 查询导出状态
 * GET /api/v1/exports/download/:key - 下载产物
 */
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { exportRuntime } from '../services/export-runtime.js'
import { artifactStorage } from '../storage/artifact-storage.js'

export default async function exportRoutes(fastify: FastifyInstance) {
  // 创建导出任务
  fastify.post('/api/export/create', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId, exportType } = request.body as any

    if (!projectId) {
      return reply.status(400).send({ success: false, error: '缺少 projectId' })
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const result = await exportRuntime.createExportTask({
      userId: user.id,
      projectId,
      exportType,
    })

    return { success: true, ...result } satisfies ApiResponse<unknown>;

  })

  // 查询导出状态
  fastify.get('/api/export/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const task = await exportRuntime.getTask(id)
    if (!task) {
      return reply.status(404).send({ success: false, error: '导出任务不存在' })
    }
    return { success: true, task } satisfies ApiResponse<unknown>;

  })

  // 下载导出产物
  fastify.get('/api/v1/exports/download/:key', async (request, reply) => {
    const { key } = request.params as any
    const result = await artifactStorage.getDownloadStream(key)
    if (!result) {
      return reply.status(404).send({ success: false, error: '文件不存在或已过期' })
    }
    reply.raw.writeHead(200, {
      'Content-Disposition': `attachment; filename="${result.meta.filename}"`,
      'Content-Type': result.meta.mimeType,
      'Content-Length': result.meta.size,
    })
    result.stream.pipe(reply.raw)
  })
}
