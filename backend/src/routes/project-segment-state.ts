/**
 * project-segment-state.ts — 视频段编辑状态持久化 API
 *
 * GET  /api/projects/segments/:projectId
 *   返回该项目的所有段编辑状态（帧图URL + 编辑内容 + framePrompts + referenceImages）
 *
 * POST /api/projects/segments/save
 *   保存单段的编辑状态（upsert）
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

function extractUserId(request: any): string | null {
  try {
    const auth = request.headers.authorization as string
    if (!auth || !auth.startsWith('Bearer ')) return null
    const token = auth.slice(7).trim()
    const decoded: any = (request.server as any).jwt.verify(token)
    return decoded?.id || null
  } catch {
    return null
  }
}

export default async function projectSegmentStateRoutes(app: FastifyInstance) {
  // ====== 加载所有段的编辑状态 ======
  app.get('/api/projects/segments/:projectId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const projectId = (request.params as any).projectId
    if (!projectId) {
      return reply.status(400).send({ success: false, error: '缺少 projectId' })
    }

    try {
      // 加载段信息（包含帧图URL、videoUrl）
      const segments = await prisma.aiVideoSegment.findMany({
        where: { projectId },
        orderBy: { sortOrder: 'asc' },
      })

      // 加载编辑状态
      const edits = await prisma.aiSegmentEdit.findMany({
        where: { projectId },
      })

      // 合并数据
      const editMap = new Map<string, any>()
      for (const e of edits) {
        editMap.set(e.segmentId, e)
      }

      const merged = segments.map(seg => {
        const edit = editMap.get(seg.segmentId) || {}
        return {
          segmentId: seg.segmentId,
          sortOrder: seg.sortOrder,
          // 帧图URL
          firstFrameUrl: seg.firstFrameUrl || '',
          midFrameUrl: seg.midFrameUrl || '',
          lastFrameUrl: seg.lastFrameUrl || '',
          // 帧图描述
          firstFrameDesc: seg.firstFrameDesc || '',
          midFrameDesc: seg.midFrameDesc || '',
          lastFrameDesc: seg.lastFrameDesc || '',
          // 编辑状态
          narrative: (edit as any).narrative || seg.narrative || seg.fullText || '',
          dialogue: (edit as any).dialogue || '',
          effects: (edit as any).effects || '',
          emotion: (edit as any).emotion || '',
          negativePrompt: (edit as any).negativePrompt || '',
          duration: (edit as any).duration || seg.duration || 8,
          // framePrompts
          firstFramePrompt: (edit as any).firstFramePrompt || '',
          firstFrameNeg: (edit as any).firstFrameNeg || '',
          midFramePrompt: (edit as any).midFramePrompt || '',
          midFrameNeg: (edit as any).midFrameNeg || '',
          lastFramePrompt: (edit as any).lastFramePrompt || '',
          lastFrameNeg: (edit as any).lastFrameNeg || '',
          // 参考图
          charImageUrls: safeParseJson((edit as any).charImageUrls, []),
          sceneImageUrls: safeParseJson((edit as any).sceneImageUrls, []),
          propImageUrls: safeParseJson((edit as any).propImageUrls, []),
          // 视频
          videoUrl: seg.videoUrl || '',
        }
      })

      return { success: true, data: { segments: merged } }
    } catch (err: any) {
      console.error('[segment-state] GET error:', err.message)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ====== 保存单段编辑状态 ======
  app.post('/api/projects/segments/save', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as any
    const { projectId, segmentId } = body
    if (!projectId || !segmentId) {
      return reply.status(400).send({ success: false, error: '缺少 projectId 或 segmentId' })
    }

    try {
      // 1. 更新 AiVideoSegment（帧图URL + 描述 + videoUrl）
      await prisma.aiVideoSegment.upsert({
        where: { projectId_segmentId: { projectId, segmentId } },
        create: {
          projectId,
          segmentId,
          firstFrameUrl: body.firstFrameUrl || '',
          midFrameUrl: body.midFrameUrl || '',
          lastFrameUrl: body.lastFrameUrl || '',
          firstFrameDesc: body.firstFrameDesc || '',
          midFrameDesc: body.midFrameDesc || '',
          lastFrameDesc: body.lastFrameDesc || '',
          videoUrl: body.videoUrl || '',
          sortOrder: body.sortOrder ?? 0,
        },
        update: {
          firstFrameUrl: body.firstFrameUrl || undefined,
          midFrameUrl: body.midFrameUrl || undefined,
          lastFrameUrl: body.lastFrameUrl || undefined,
          firstFrameDesc: body.firstFrameDesc || undefined,
          midFrameDesc: body.midFrameDesc || undefined,
          lastFrameDesc: body.lastFrameDesc || undefined,
          videoUrl: body.videoUrl || undefined,
          sortOrder: body.sortOrder ?? undefined,
        },
      })

      // 2. 更新 AiSegmentEdit（编辑内容 + framePrompts + 参考图）
      await prisma.aiSegmentEdit.upsert({
        where: { projectId_segmentId: { projectId, segmentId } },
        create: {
          projectId,
          segmentId,
          narrative: body.narrative || '',
          dialogue: body.dialogue || '',
          effects: body.effects || '',
          emotion: body.emotion || '',
          negativePrompt: body.negativePrompt || '',
          duration: body.duration ?? null,
          firstFramePrompt: body.firstFramePrompt || '',
          firstFrameNeg: body.firstFrameNeg || '',
          midFramePrompt: body.midFramePrompt || '',
          midFrameNeg: body.midFrameNeg || '',
          lastFramePrompt: body.lastFramePrompt || '',
          lastFrameNeg: body.lastFrameNeg || '',
          charImageUrls: safeStringifyJson(body.charImageUrls),
          sceneImageUrls: safeStringifyJson(body.sceneImageUrls),
          propImageUrls: safeStringifyJson(body.propImageUrls),
        },
        update: {
          narrative: body.narrative !== undefined ? body.narrative : undefined,
          dialogue: body.dialogue !== undefined ? body.dialogue : undefined,
          effects: body.effects !== undefined ? body.effects : undefined,
          emotion: body.emotion !== undefined ? body.emotion : undefined,
          negativePrompt: body.negativePrompt !== undefined ? body.negativePrompt : undefined,
          duration: body.duration !== undefined ? body.duration : undefined,
          firstFramePrompt: body.firstFramePrompt !== undefined ? body.firstFramePrompt : undefined,
          firstFrameNeg: body.firstFrameNeg !== undefined ? body.firstFrameNeg : undefined,
          midFramePrompt: body.midFramePrompt !== undefined ? body.midFramePrompt : undefined,
          midFrameNeg: body.midFrameNeg !== undefined ? body.midFrameNeg : undefined,
          lastFramePrompt: body.lastFramePrompt !== undefined ? body.lastFramePrompt : undefined,
          lastFrameNeg: body.lastFrameNeg !== undefined ? body.lastFrameNeg : undefined,
          charImageUrls: body.charImageUrls !== undefined ? safeStringifyJson(body.charImageUrls) : undefined,
          sceneImageUrls: body.sceneImageUrls !== undefined ? safeStringifyJson(body.sceneImageUrls) : undefined,
          propImageUrls: body.propImageUrls !== undefined ? safeStringifyJson(body.propImageUrls) : undefined,
        },
      })

      return { success: true }
    } catch (err: any) {
      console.error('[segment-state] POST save error:', err.message)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}

function safeParseJson(str: string | null | undefined, fallback: any = null): any {
  if (!str) return fallback
  try { return JSON.parse(str) } catch { return fallback }
}

function safeStringifyJson(val: any): string | null {
  if (val === undefined || val === null) return null
  try { return JSON.stringify(val) } catch { return null }
}
