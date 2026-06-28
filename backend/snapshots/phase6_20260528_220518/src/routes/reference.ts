// ═══════════════════════════════════════════════════════════════
// routes/reference.ts — 参考图管理 + 参考驱动生成
// ═══════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function referenceRoutes(fastify: FastifyInstance) {
  // POST /api/reference/upload — 上传参考图（并从作品库导入）
  fastify.post('/api/reference/import', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { url, type, weight, priority } = request.body as any

    if (!url) {
      return reply.status(400).send({ error: 'url 必填' })
    }

    const ref = await prisma.generationReference.create({
      data: {
        userId,
        taskId: `import-${Date.now()}`,
        assetUrl: url,
        refType: type || 'style',
        weight: weight || 0.5,
        priority: priority || 'secondary',
      },
    })

    return { id: ref.id, url: ref.assetUrl, type: ref.refType, weight: ref.weight }
  })

  // POST /api/reference/generate-image — 参考图驱动图片生成
  fastify.post('/api/reference/generate-image', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { prompt, referenceImages, referenceMode, directorParams } = request.body as any

    if (!prompt) {
      return reply.status(400).send({ error: 'prompt required' })
    }

    // 参数校验 → 转发到 /images/generate
    const primaryRef = (referenceImages || []).find((r: any) => r.priority === 'primary') || (referenceImages || [])[0]
    const mode = primaryRef ? 'img2img' : 'text2img'
    const imageUrl = primaryRef?.url

    // 转发到图片生成
    const resp = await fetch(`http://localhost:${process.env.PORT || 4000}/images/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.authorization || '',
      },
      body: JSON.stringify({
        prompt,
        mode,
        referenceImage: imageUrl,
        width: directorParams?.width || 1920,
        height: directorParams?.height || 1920,
      }),
    })

    const data = await resp.json()

    if (!resp.ok) {
      return reply.status(resp.status).send(data)
    }

    // 保存生成记录 + 参考图关联
    const taskId = `img-${Date.now()}`
    
    if (referenceImages?.length) {
      await prisma.generationReference.createMany({
        data: referenceImages.map((r: any) => ({
          userId,
          taskId,
          assetUrl: r.url,
          refType: r.type || 'style',
          weight: r.weight || 0.5,
          priority: r.priority || 'secondary',
        })),
      })
    }

    await prisma.productionRecord.create({
      data: {
        userId,
        title: prompt.slice(0, 60),
        prompt,
        resultType: 'image',
        resultUrl: data.url,
        referenceMode: referenceMode || 'soft',
        directorParams: directorParams || {},
      },
    })

    return {
      ...data,
      taskId,
      referenceCount: referenceImages?.length || 0,
    }
  })

  // POST /api/reference/generate-video — 参考图驱动视频生成
  fastify.post('/api/reference/generate-video', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { prompt, referenceImages, referenceMode, directorParams, duration } = request.body as any

    if (!prompt) {
      return reply.status(400).send({ error: 'prompt required' })
    }

    const primaryRef = (referenceImages || []).find((r: any) => r.priority === 'primary') || (referenceImages || [])[0]
    const mode = primaryRef ? 'img2video' : 'text2video'
    const imageUrl = primaryRef?.url

    const resp = await fetch(`http://localhost:${process.env.PORT || 4000}/videos/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.authorization || '',
      },
      body: JSON.stringify({
        prompt,
        mode,
        referenceImage: imageUrl,
        duration: duration || 5,
        width: directorParams?.width || 1280,
        height: directorParams?.height || 768,
      }),
    })

    const data = await resp.json()

    if (!resp.ok) {
      return reply.status(resp.status).send(data)
    }

    const taskId = `vid-${Date.now()}`
    
    if (referenceImages?.length) {
      await prisma.generationReference.createMany({
        data: referenceImages.map((r: any) => ({
          userId,
          taskId,
          assetUrl: r.url,
          refType: r.type || 'style',
          weight: r.weight || 0.5,
          priority: r.priority || 'secondary',
        })),
      })
    }

    await prisma.productionRecord.create({
      data: {
        userId,
        title: prompt.slice(0, 60),
        prompt,
        resultType: 'video',
        resultUrl: data.url,
        referenceMode: referenceMode || 'soft',
        directorParams: directorParams || {},
      },
    })

    return {
      ...data,
      taskId,
      referenceCount: referenceImages?.length || 0,
    }
  })

  // GET /api/reference/records — 查询作品生成记录
  fastify.get('/api/reference/records', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { limit = 50, offset = 0 } = request.query as any

    const records = await prisma.productionRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    })

    const total = await prisma.productionRecord.count({ where: { userId } })

    // 加载每条记录的参考图
    const recordsWithRefs = await Promise.all(
      records.map(async (record) => {
        const refs = await prisma.generationReference.findMany({
          where: { userId, taskId: { startsWith: record.createdAt.getTime().toString().slice(0, 8) } },
          orderBy: { createdAt: 'desc' },
        })
        return { ...record, references: refs }
      })
    )

    return { records: recordsWithRefs, total }
  })

  // GET /api/reference/:taskId — 查询单条记录详情
  fastify.get('/api/reference/:taskId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taskId } = request.params as any
    const refs = await prisma.generationReference.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    })
    return { references: refs }
  })

  // GET /api/reference/graph — 作品图谱查询（Production Graph）
  fastify.get('/api/reference/graph', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { limit = 20 } = request.query as any

    const records = await prisma.productionRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    })

    // 为每条记录加载参考图
    const graphNodes = await Promise.all(
      records.map(async (record) => {
        const refs = await prisma.generationReference.findMany({
          where: { userId, taskId: record.id.slice(0, 20) },
          orderBy: { createdAt: 'desc' },
        })
        return {
          id: record.id,
          type: 'production',
          title: record.title,
          prompt: record.prompt,
          resultType: record.resultType,
          resultUrl: record.resultUrl,
          thumbnail: record.thumbnail,
          referenceMode: record.referenceMode,
          directorParams: record.directorParams,
          version: record.version,
          createdAt: record.createdAt,
          references: refs.map(r => ({
            id: r.id,
            url: r.assetUrl,
            type: r.refType,
            weight: r.weight,
            priority: r.priority,
          })),
          parentAsset: null, // 后续版本树支持
          children: [],      // 后续分叉支持
        }
      })
    )

    return {
      nodes: graphNodes,
      total: graphNodes.length,
    }
  })

  // POST /api/reference/clone — 一键复刻（Clone Production）
  fastify.post('/api/reference/clone', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { recordId, newPrompt } = request.body as any

    if (!recordId) {
      return reply.status(400).send({ error: 'recordId 必填' })
    }

    const record = await prisma.productionRecord.findUnique({
      where: { id: recordId },
    })

    if (!record) {
      return reply.status(404).send({ error: '记录不存在' })
    }

    // 创建新版本
    const cloned = await prisma.productionRecord.create({
      data: {
        userId,
        title: record.title,
        prompt: newPrompt || record.prompt,
        resultType: record.resultType,
        referenceMode: record.referenceMode,
        directorParams: record.directorParams ? JSON.parse(JSON.stringify(record.directorParams)) : undefined,
        version: record.version + 1,
      },
    })

    return {
      id: cloned.id,
      title: cloned.title,
      prompt: cloned.prompt,
      version: cloned.version,
      message: '复刻成功',
    }
  })
}
