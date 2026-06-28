import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/images.ts — 图片路由（ETFL EDCL: EXECUTION DOMAIN）
 *
 * ETFL Phase 2: 所有 execution 路径经 /api/tasks/ai-generate 入队
 * 本文件不再直接调用任何 provider/model/adapter
 *
 * POST /images/generate — ETFL 代理到队列
 * POST /images/batch — ETFL 代理到队列
 * GET /images/download — 保留（仅在文件系统操作）
 * POST /images/generate-and-download — ETFL 代理到队列
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { generateAssetDna } from '../core/asset-economy/asset-dna/dna-generator.js'
import archiver from 'archiver'
import { initRights } from '../core/asset-economy/rights-engine/rights-manager.js'
import { downloadToLocal } from '../services/download.service.js'

export default async function imageRoutes(fastify: FastifyInstance) {

  // ─── SEEL 代理：转发图片生成到队列 ────────────────────
  // ETFL-EDCL: EXECUTION DOMAIN → 禁止直接调用 provider

  async function proxyImageToQueue(request: any, reply: any): Promise<any> {
    const body = request.body as any || {}
    console.log(`[Image/Proxy] generate body keys=${Object.keys(body).join(',')}, mode=${body.mode}, promptLen=${(body.prompt||'').length}`)

    try {
      const injectResp = await (reply.request as any).server.inject({
        method: 'POST',
        url: '/api/tasks/ai-generate',
        headers: { authorization: (request.headers as any).authorization || '' },
        payload: JSON.stringify({
          projectId: body.projectId || '__image_proxy__',
          taskType: 'image',
          input: {
            prompt: body.prompt,
            negativePrompt: body.negativePrompt || body.negative_prompt,
            width: body.width,
            height: body.height,
            mode: body.mode,
            referenceImage: body.referenceImage,
            referenceImages: body.referenceImages,
            aspectRatio: body.aspectRatio,
            model: body.model,
            size: body.size,
            n: body.n || 1,
            source: 'image',
          },
        }),
      })
      const parsed = JSON.parse(injectResp.body)
      return reply.status(injectResp.statusCode).send(parsed)
    } catch (e: any) {
      console.warn('[Image/Proxy] inject 失败，走外部 fetch:', e.message)
      const res = await fetch(`http://localhost:${process.env.PORT || 4000}/api/tasks/ai-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: (request.headers as any).authorization || '',
        },
        body: JSON.stringify({
          projectId: body.projectId || '__image_proxy__',
          taskType: 'image',
          input: {
            prompt: body.prompt,
            negativePrompt: body.negativePrompt || body.negative_prompt,
            width: body.width, height: body.height,
            mode: body.mode,
            referenceImage: body.referenceImage,
            referenceImages: body.referenceImages,
            aspectRatio: body.aspectRatio,
            model: body.model,
            size: body.size, n: body.n || 1,
            source: 'image',
          },
        }),
      })
      const data = await res.json()
      return reply.status(res.status).send(data)
    }
  }

  // POST /images/generate — ETFL: EXECUTION → SEEL 代理（入队）
  fastify.post('/images/generate', { preHandler: [fastify.authenticate] }, proxyImageToQueue)

  // POST /images/generate-json (JSON) — 同接口但接受 JSON body（广告页面使用）
  fastify.post('/images/generate-json', { preHandler: [fastify.authenticate] }, proxyImageToQueue)

  // POST /images/generate-and-download — ETFL: EXECUTION → SEEL 代理
  fastify.post('/images/generate-and-download', { preHandler: [fastify.authenticate] }, proxyImageToQueue)

  // ─── 视频生成（ETFL: EXECUTION → SEEL 代理） ──────────────
  // /videos/generate 在 images.ts 中定义（遗留），execution 入队
  fastify.post('/videos/generate', async (request, reply) => {
    const body = request.body as any || {}

    try {
      const injectResp = await (reply.request as any).server.inject({
        method: 'POST',
        url: '/api/tasks/ai-generate',
        headers: { authorization: (request.headers as any).authorization || '' },
        payload: JSON.stringify({
          projectId: body.projectId || '__video_proxy__',
          taskType: 'video',
          input: {
            prompt: body.prompt,
            negativePrompt: body.negativePrompt,
            width: body.width,
            height: body.height,
            mode: body.mode,
            referenceImage: body.referenceImage,
            duration: body.duration || 5,
            model: body.model,
            audioUrl: body.audioUrl,
            segmentId: body.segmentId,
            source: 'video',
          },
        }),
      })
      const parsed = JSON.parse(injectResp.body)
      return reply.status(injectResp.statusCode).send(parsed)
    } catch (e: any) {
      console.warn('[Video/Proxy] inject 失败，走外部 fetch:', e.message)
      const res = await fetch(`http://localhost:${process.env.PORT || 4000}/api/tasks/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: (request.headers as any).authorization || '' },
        body: JSON.stringify({
          projectId: body.projectId || '__video_proxy__',
          taskType: 'video',
          input: {
            prompt: body.prompt,
            negativePrompt: body.negativePrompt,
            width: body.width, height: body.height,
            mode: body.mode,
            referenceImage: body.referenceImage,
            duration: body.duration || 5,
            model: body.model,
            audioUrl: body.audioUrl,
            segmentId: body.segmentId,
            source: 'video',
          },
        }),
      })
      const data = await res.json()
      return reply.status(res.status).send(data)
    }
  })

  // ─── 数据/查询类路由（保留，非 execution） ─────────────

  // POST /images/save — 数据库操作，非 AI execution
  fastify.post('/images/save', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const body = request.body as any
    const { projectId, type, name, imageUrl, sortOrder } = body
    if (!projectId || !type || !imageUrl) {
      return reply.status(400).send({ error: 'projectId, type, imageUrl are required' })
    }
    try {
      if (type === 'scene') {
        const created = await prisma.sceneImage.create({
          data: { projectId, sceneName: name || '场景', imageUrl, sortOrder: sortOrder ?? 0 },
        })
        return reply.send({ success: true, data: created })
      } else if (type === 'character') {
        const created = await prisma.characterImage.create({
          data: { projectId, characterName: name || '角色', imageUrl, sortOrder: sortOrder ?? 0 },
        })
        return reply.send({ success: true, data: created })
      } else if (type === 'storyboard') {
        const created = await prisma.storyboardImage.create({
          data: { projectId, segmentId: sortOrder?.toString() || '0', description: name || '分镜', imageUrl, sortOrder: sortOrder ?? 0 },
        })
        return reply.send({ success: true, data: created })
      } else if (type === 'prop') {
        const created = await prisma.propImage.create({
          data: { projectId, propName: name || '道具', category: body.category || '通用', description: body.description || '',
            imageUrl, imagePrompt: body.imagePrompt || null, negativePrompt: body.negativePrompt || null, sortOrder: sortOrder ?? 0 },
        })
        return reply.send({ success: true, data: created })
      } else if (type === 'keyframe') {
        // ETFL: 非 execution，仅数据库操作
        return reply.status(400).send({ error: 'keyframe 保存功能已迁移，请通过 frameDesign API 操作' })
      }
      return reply.status(400).send({ error: 'type must be "scene", "character", "storyboard", "prop" or "keyframe"' })
    } catch (err: any) {
      console.error('[ImageSave] Error:', err); return reply.status(500).send({ error: err.message })
    }
  })

  // GET /props/:projectId — 查询道具列表（非 execution）
  fastify.get('/props/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any
    try {
      const props = await prisma.propImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } })
      return reply.send({ success: true, data: props })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // GET /videos/status/:taskId — 查询百炼视频任务状态（非 execution）
  fastify.get('/videos/status/:taskId', async (request, reply) => {
    const { taskId } = request.params as any
    if (!taskId) return reply.status(400).send({ error: 'taskId is required' })
    // 通过 /api/tasks/ai-generate 状态查询端点代理
    try {
      const injectResp = await (reply.request as any).server.inject({
        method: 'GET',
        url: `/api/tasks/ai-generate/status/${taskId}`,
        headers: { authorization: (request.headers as any).authorization || '' },
      })
      const parsed = JSON.parse(injectResp.body)
      return reply.status(injectResp.statusCode).send(parsed)
    } catch {
      // 降级：直接返回轮询状态
      return reply.send({ status: 'polling', taskId })
    }
  })

  // GET /videos/download-all/:projectId — 打包下载全部视频（非 execution）
  fastify.get('/videos/download-all/:projectId', async (req: any, reply: any) => {
    const { projectId } = req.params as { projectId: string }
    if (!projectId) return reply.status(400).send({ error: 'projectId required' })
    let tmpFile = ''
    try {
      const segments = await prisma.aiVideoSegment.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } })
      const videoEntries = segments.filter(s => s.videoUrl).map(s => ({ filename: `${s.segmentId || 'seg'}.mp4`, url: s.videoUrl! }))
      if (!videoEntries.length) return reply.status(404).send({ error: '没有已生成的视频' })
      const fs = await import('fs')
      const { tmpdir } = await import('os')
      const { join } = await import('path')
      const tmpDir = fs.mkdtempSync(join(tmpdir(), 'videos-'))
      tmpFile = join(tmpDir, 'export.zip')
      const output = fs.createWriteStream(tmpFile)
      const archive = archiver('zip', { zlib: { level: 1 } })
      archive.pipe(output)
      for (const entry of videoEntries) {
        try {
          const res = await fetch(entry.url)
          if (!res.ok) continue
          archive.append(Buffer.from(await res.arrayBuffer()), { name: entry.filename })
        } catch { console.warn(`[ZIP] 跳过下载失败: ${entry.filename}`) }
      }
      await archive.finalize()
      await new Promise<void>((resolve, reject) => { output.on('close', resolve); output.on('error', reject) })
      const buf = fs.readFileSync(tmpFile)
      fs.rmSync(tmpFile, { force: true })
      reply.header('Content-Type', 'application/zip')
      reply.header('Content-Disposition', `attachment; filename="videos-${projectId.substring(0, 8)}.zip"`)
      return reply.send(buf)
    } catch (err: any) {
      console.error('[ZIP] 打包失败:', err.message)
      if (tmpFile) { try { (await import('fs')).rmSync(tmpFile, { force: true }) } catch {} }
      if (!reply.sent) return reply.status(500).send({ error: '打包失败: ' + err.message })
    }
  })

  // GET /projects/:id/character-makeup-images — 角色定妆图查询（非 execution）
  fastify.get('/projects/:id/character-makeup-images', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    const images = await prisma.characterImage.findMany({
      where: { projectId: id, characterName: { endsWith: '_makeup' } },
      orderBy: { sortOrder: 'asc' },
    })
    return { success: true, data: images.map(i => ({ characterName: i.characterName, imageUrl: i.imageUrl, createdAt: i.createdAt })) } satisfies ApiResponse<unknown>;

  })
}
