import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { initRights } from '../core/asset-economy/rights-engine/rights-manager.js'
import { resolve } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = '/root/shipin-cinematic-studio/backend/public/uploads'
const BASE_URL = '/api/v1/uploads'
const PUBLIC_HOST = 'https://aigc.fushtn.com'

export default async function uploadRoutes(fastify: FastifyInstance) {
  // POST /api/v1/upload/asset — 用户上传外部资产（URL模式）
  fastify.post('/api/v1/upload/asset', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { title, type, url, thumbnail, prompt } = request.body as any

    if (!title || !type || !url) {
      return reply.status(400).send({ error: '缺少必填字段: title, type, url' })
    }

    if (!['image', 'video'].includes(type)) {
      return reply.status(400).send({ error: 'type 必须是 image 或 video' })
    }

    try {
      const asset = await prisma.userAsset.create({
        data: {
          userId,
          title,
          type,
          url,
          thumbnail: thumbnail || null,
          prompt: prompt || null,
          source: 'user_upload',
        }
      })

      await initRights(asset.id, true)

      return {
        id: asset.id,
        title: asset.title,
        type: asset.type,
        url: asset.url,
        externalAsset: true,
        message: '上传成功，此资产为外部资产，不进入交易体系'
      }
    } catch (error: any) {
      return reply.status(500).send({ error: `上传失败: ${error.message}` })
    }
  })

  // POST /api/v1/upload/local — 上传本地图片文件（multipart）
  fastify.post('/api/v1/upload/local', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any

    try {
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ error: '未上传文件' })
      }

      const buffer = await data.toBuffer()
      const ext = data.filename?.split('.').pop()?.toLowerCase() || 'png'
      const allowedExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4']
      if (!allowedExts.includes(ext)) {
        return reply.status(400).send({ error: `不支持的文件格式: .${ext}，支持: ${allowedExts.join(', ')}` })
      }

      const filename = `${randomUUID()}.${ext}`
      const filepath = resolve(UPLOAD_DIR, filename)
      await mkdir(UPLOAD_DIR, { recursive: true })
      await writeFile(filepath, buffer)

      const publicUrl = `${PUBLIC_HOST}${BASE_URL}/${filename}`

      // 从文件名提取标题（去掉扩展名）
      const title = data.filename?.replace(/\.[^/.]+$/, '') || '未命名'
      const type = ext === 'mp4' ? 'video' : 'image'

      const asset = await prisma.userAsset.create({
        data: {
          userId,
          title,
          type,
          url: publicUrl,
          thumbnail: publicUrl,
          prompt: `本地上传: ${data.filename}`,
          source: 'user_upload',
        }
      })

      await initRights(asset.id, true)

      return {
        id: asset.id,
        title: asset.title,
        type: asset.type,
        url: asset.url,
        externalAsset: true,
        message: '本地图片上传成功'
      }
    } catch (error: any) {
      return reply.status(500).send({ error: `上传失败: ${error.message}` })
    }
  })

  // GET /api/v1/uploads/:filename — 静态文件服务（提供上传的文件）
  fastify.get('/api/v1/uploads/:filename', async (request, reply) => {
    const { filename } = request.params as any
    const filepath = resolve(UPLOAD_DIR, filename)

    try {
      const content = await import('fs/promises').then(m => m.readFile(filepath))
      const ext = filename.split('.').pop()?.toLowerCase() || ''
      const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        mp4: 'video/mp4',
      }
      reply.header('Content-Type', mimeMap[ext] || 'application/octet-stream')
      reply.header('Cache-Control', 'public, max-age=86400')
      return reply.send(content)
    } catch {
      return reply.status(404).send({ error: '文件不存在' })
    }
  })

  // GET /api/v1/watermark/:filename — 隐水印版本的图片路由
  fastify.get('/api/v1/watermark/:filename', async (request, reply) => {
    const { filename } = request.params as any
    const { uid } = request.query as any
    const filepath = resolve(UPLOAD_DIR, filename)

    try {
      const { embedWatermarkToFile } = await import('../services/watermark.service.js')
      const watermarkedPath = await embedWatermarkToFile(filepath, uid || 'anonymous')
      const content = await import('fs/promises').then(m => m.readFile(watermarkedPath || filepath))
      const ext = filename.split('.').pop()?.toLowerCase() || ''
      const mimeMap: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
      }
      reply.header('Content-Type', mimeMap[ext] || 'image/jpeg')
      reply.header('Cache-Control', 'public, max-age=3600')
      return reply.send(content)
    } catch {
      return reply.status(404).send({ error: '文件不存在' })
    }
  })

  // GET /api/v1/upload/assets — 获取用户上传的所有资产
  fastify.get('/api/v1/upload/assets', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const query = request.query as { type?: string; limit?: string; offset?: string }

    try {
      const where: any = { userId }
      if (query.type) where.type = query.type

      const assets = await prisma.userAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(query.limit || '50'),
        skip: parseInt(query.offset || '0'),
      })

      const assetIds = assets.map(a => a.id)
      const rights = await prisma.assetRights.findMany({
        where: { assetId: { in: assetIds }, externalAsset: true }
      })
      const externalIds = new Set(rights.map(r => r.assetId))

      const result = assets.map(a => ({
        ...a,
        externalAsset: externalIds.has(a.id)
      }))

      return { assets: result, total: result.length }
    } catch (error: any) {
      return reply.status(500).send({ error: error.message })
    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

