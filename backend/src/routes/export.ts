/**
 * routes/export.ts — 导出合成 API
 *
 * 职责：视频导出/合成/打包
 * 核心依赖：queue/video-composer.ts
 *
 * 宪法约束：
 *   - 不直接调用 provider
 *   - 只消费已生成的视频资源（已存于 DB 或 COS）
 */

import { FastifyInstance } from 'fastify'

export default async function exportRoutes(fastify: FastifyInstance) {
  // ==============================
  // POST /api/export/compose-video
  // 合成多段视频为单一输出
  // ==============================
  fastify.post('/api/export/compose-video', async (request, reply) => {
    const body = request.body as any
    const projectId = body.projectId
    const segments = body.segments as Array<{ id: string; videoUrl: string; duration: number }> | undefined

    if (!projectId) {
      return reply.status(400).send({ success: false, error: { stage: 'validation', message: '缺少 projectId' } })
    }
    if (!segments || segments.length === 0) {
      return reply.status(400).send({ success: false, error: { stage: 'validation', message: '缺少视频片段列表' } })
    }

    try {
      const { composeVideo } = await import('../queue/video-composer.js')

      // 从 segments 提取帧
      const frames = segments.map((seg, i) => ({
        second: i * (seg.duration || 5),
        imageUrl: seg.videoUrl,
      }))

      // 总时长（取最长方案）
      const totalDuration = frames.reduce((sum, f, i) => {
        const seg = segments[i]
        return sum + (seg?.duration || 5)
      }, 0)

      const result = await composeVideo({
        frames,
        fps: 24,
        duration: totalDuration,
        outputName: `project_${projectId}_${Date.now()}`,
      })

      return reply.send({
        success: true,
        data: {
          videoUrl: result.videoUrl,
          duration: result.duration,
          totalFrames: result.totalFrames,
          mode: result.mode,
        },
      })
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { stage: 'compose', message: err.message },
      })
    }
  })

  // ==============================
  // GET /api/export/status
  // 导出合成状态查询（占位）
  // ==============================
  fastify.get('/api/export/status', async (_request, reply) => {
    return reply.send({
      success: true,
      data: { status: 'idle', message: '导出系统运行正常' },
    })
  })
}
