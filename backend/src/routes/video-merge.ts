/**
 * 视频合成拼接路由
 *
 * POST   /api/video/merge/:projectId   — 提交拼接任务
 * GET    /api/video/merge/status/:projectId — 查询拼接状态
 * GET    /api/video/merge/check/:projectId  — 检查项目是否可拼接
 */

import { FastifyInstance } from 'fastify'
import { mergeVideos, checkMergeEligibility, getProjectMergeStatus } from '../services/video-merge.service.js'
import { prisma } from '../utils/index.js'

export default async function videoMergeRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/video/merge/:projectId
   * 提交视频合成任务
   */
  fastify.post('/api/video/merge/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const { includeTTS, includeSubtitles, transitionType } = (request.body || {}) as any

    // 验证项目存在
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return reply.status(404).send({ success: false, message: '项目不存在' })
    }

    // 检查是否已有合成结果（若已合成过，返回已有）
    if (project.mergedVideoUrl && project.mergeStatus === 'done') {
      return reply.send({
        success: true,
        data: {
          status: 'done',
          outputUrl: project.mergedVideoUrl,
          message: '已有合成结果',
        },
      })
    }

    // 检查拼接资格
    const eligibility = await checkMergeEligibility(projectId)
    if (!eligibility.eligible) {
      return reply.status(400).send({
        success: false,
        message: eligibility.message,
      })
    }

    // 更新状态为 processing
    await prisma.project.update({
      where: { id: projectId },
      data: { mergeStatus: 'processing' },
    })

    // 异步执行拼接（不阻塞响应）
    const body = request.body as any
    const userId = (request as any).user?.id || ''
    mergeVideos(projectId, {
      includeTTS: body?.includeTTS === true,
      includeSubtitles: body?.includeSubtitles === true,
      transitionType: body?.transitionType || 'none',
    })
      .then(result => {
        console.log(`[VideoMerge] ✅ project=${projectId} 合成完成: ${result.outputUrl} (${result.fileSizeMb}MB, ${result.duration}s, ${result.segments}段)`)
      })
      .catch(err => {
        console.error(`[VideoMerge] ❌ project=${projectId} 失败:`, err.message)
      })

    return reply.send({
      success: true,
      data: {
        status: 'processing',
        projectId,
        message: `${eligibility.readySegments} 段视频拼接任务已提交`,
      },
    })
  })

  /**
   * GET /api/video/merge/status/:projectId
   * 查询合成状态（轮询用）
   */
  fastify.get('/api/video/merge/status/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const status = await getProjectMergeStatus(projectId)
    return reply.send({ success: true, data: status })
  })

  /**
   * GET /api/video/merge/check/:projectId
   * 检查项目是否具备拼接条件
   */
  fastify.get('/api/video/merge/check/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const eligibility = await checkMergeEligibility(projectId)
    return reply.send({ success: true, data: eligibility })
  })
}
