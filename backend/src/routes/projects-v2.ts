import type { ApiResponse } from '../contracts/api/base.js';
// ─── Project Routes — 火麒麟 AI Production Studio Project API ───
// POST /api/v1/projects — 创建项目
// GET /api/v1/projects — 项目列表
// GET /api/v1/projects/:id — 项目详情
// GET /api/v1/projects/:id/stream — SSE 实时推送

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { projectService } from '../services/project.service.js'
import { prisma } from '../utils/index.js'

// ─── Clear AIGC spec data for a project (preserves Project, CharacterImage, etc.) ───
async function clearProjectAigcData(projectId: string) {
  await prisma.$transaction([
    prisma.aiCharacterSpec.deleteMany({ where: { projectId } }),
    prisma.aiSceneSpec.deleteMany({ where: { projectId } }),
    prisma.aiVoiceConfig.deleteMany({ where: { projectId } }),
    prisma.aiVideoSegment.deleteMany({ where: { projectId } }),
    prisma.aiFrameDesign.deleteMany({ where: { projectId } }),
    prisma.aiVideoProduction.deleteMany({ where: { projectId } }),
    prisma.aiEffectSpec.deleteMany({ where: { projectId } }),
    prisma.aiActionSpec.deleteMany({ where: { projectId } }),
    prisma.aiCameraSpec.deleteMany({ where: { projectId } }),
    prisma.aiEmotionSpec.deleteMany({ where: { projectId } }),
  ])
  // Also clear executionResults JSON on Project
  await prisma.project.update({
    where: { id: projectId },
    data: { executionResults: null },
  })
}

// In-memory SSE clients for live streaming
const sseClients = new Map<string, Set<{ reply: FastifyReply; res: any }>>()

function broadcastSSE(projectId: string, event: string, data: any) {
  const clients = sseClients.get(projectId)
  if (!clients) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of clients) {
    try {
      client.res.raw.write(payload)
    } catch {
      clients.delete(client)
    }
  }
}

// Simulate progress updates for SSE
function startSimulatedProgress(projectId: string) {
  const stages = [
    { stage: 'planning', duration: 3000, label: '项目规划' },
    { stage: 'generating', duration: 5000, label: 'AI 内容生成' },
    { stage: 'rendering', duration: 8000, label: '视频渲染' },
    { stage: 'compositing', duration: 4000, label: '后期合成' },
    { stage: 'exporting', duration: 3000, label: '导出发布' },
  ]

  let totalMs = 0
  stages.forEach(({ stage, duration, label }) => {
    setTimeout(() => {
      broadcastSSE(projectId, 'stage', { stage, label, status: 'start' })
    }, totalMs)

    // Progress updates during the stage
    const intervalMs = 500
    const steps = Math.floor(duration / intervalMs)
    for (let i = 0; i <= steps; i++) {
      const progress = Math.round((i / steps) * 100)
      setTimeout(() => {
        broadcastSSE(projectId, 'progress', { stage, progress, label })
        if (progress === 100) {
          broadcastSSE(projectId, 'stage', { stage, label, status: 'complete' })
        }
      }, totalMs + i * intervalMs)
    }

    totalMs += duration
  })

  // Final completion
  setTimeout(() => {
    broadcastSSE(projectId, 'complete', { message: '项目生产流水线已完成' })
  }, totalMs + 500)
}

export default async function (app: FastifyInstance) {
  // ─── POST /api/v1/projects — 创建项目 ──────────
  app.post('/api/v1/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      const userId = (request as any).user?.id || 'default'

      const project = await projectService.create({
        name: body.name,
        description: body.description || '',
        status: body.status || 'draft',
        userId,
        type: body.type || 'drama',
        style: body.style || '',
        targetPlatform: body.targetPlatform || '',
        aspectRatio: body.aspectRatio || '9:16',
        duration: body.duration || 60,
        outputQuality: body.outputQuality || 'standard',
        mode: body.mode || 'auto',
        imageModel: body.models?.image || 'Seedream',
        videoModel: body.models?.video || 'Kling',
        llmModel: body.models?.llm || 'GPT-4o',
      })

      reply.code(201).send({ success: true, data: project })
    } catch (err: any) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  // ─── GET /api/v1/projects — 项目列表 ──────────
  app.get('/api/v1/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      const userId = (request as any).user?.id || 'default'

      let projects = await projectService.findAll()

      // Filter by user if needed
      if (query.userId) {
        projects = projects.filter((p: any) => p.userId === query.userId)
      }

      // Filter by type
      if (query.type) {
        projects = projects.filter((p: any) => p.type === query.type)
      }

      // Filter by status
      if (query.status) {
        projects = projects.filter((p: any) => p.status === query.status)
      }

      // Search
      if (query.search) {
        const q = query.search.toLowerCase()
        projects = projects.filter((p: any) =>
          p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
        )
      }

      // Sort
      projects.sort((a: any, b: any) =>
        new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      )

      reply.send({ success: true, data: projects, total: projects.length })
    } catch (err: any) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  // ─── GET /api/v1/projects/:id — 项目详情 ──────────
  app.get('/api/v1/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      const project = await projectService.findById(id)

      if (!project) {
        return reply.code(404).send({ success: false, error: '项目未找到' })
      }

      reply.send({ success: true, data: project })
    } catch (err: any) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  // ─── GET /api/v1/projects/:id/stream — SSE ──────────
  app.get('/api/v1/projects/:id/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    // Register client
    if (!sseClients.has(id)) {
      sseClients.set(id, new Set())
    }
    const client = { reply, res: reply.raw }
    sseClients.get(id)!.add(client)

    // Send initial connection event
    reply.raw.write(`event: connected\ndata: {"projectId":"${id}"}\n\n`)

    // Start simulated progress if this is the first client
    if (sseClients.get(id)!.size === 1) {
      startSimulatedProgress(id)
    }

    // Keep-alive
    const keepAlive = setInterval(() => {
      try {
        reply.raw.write(':\n\n')
      } catch {
        clearInterval(keepAlive)
      }
    }, 15000)

    // Cleanup on close
    request.raw.on('close', () => {
      clearInterval(keepAlive)
      const clients = sseClients.get(id)
      if (clients) {
        clients.delete(client)
        if (clients.size === 0) {
          sseClients.delete(id)
        }
      }
    })
  })

  // ─── PUT /api/v1/projects/:id — 更新项目 ──────────
  app.put('/api/v1/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      const body = request.body as any
      const project = await projectService.update(id, body)
      reply.send({ success: true, data: project })
    } catch (err: any) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  // ─── DELETE /api/v1/projects/:id ──────────
  app.delete('/api/v1/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      await projectService.delete(id)
      reply.send({ success: true, message: '项目已删除' })
    } catch (err: any) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  // ─── DELETE /api/v1/projects/:id/clear — 清空剧本数据但保留项目和已生成的文件 ──────────
  app.delete('/api/v1/projects/:id/clear', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      await clearProjectAigcData(id)
      reply.send({ success: true, message: '剧本数据已清空，已生成的图片/视频已保留' })
    } catch (err: any) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

