import type { ApiResponse } from '../contracts/api/base.js';
// ─── Project Routes — 火麒麟 AI Production Studio Project API ───
// @deprecated — Reality Recovery Phase6: 前后端 0 生产引用（遗留路由，保留治理）
// POST /api/v1/projects — 创建项目
// GET /api/v1/projects — 项目列表
// GET /api/v1/projects/:id — 项目详情
// GET /api/v1/projects/:id/stream — SSE 实时推送

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { projectService } from '../services/project.service.js'
import { prisma } from '../utils/index.js'
import { verifyProjectOwner } from '../services/director/project-ownership.service.js'

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
  app.post('/api/v1/projects', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any
      // ⭐ Phase 6 安全隔离: userId 只从认证身份取
      const userId = (request as any).user?.id

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
  app.get('/api/v1/projects', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any
      // ⭐ Phase 6 安全隔离: 强制只返回当前用户项目（禁止 query.userId 越权过滤）
      const userId = (request as any).user?.id

      let projects = await projectService.findAll()

      // Filter by user if needed
      projects = projects.filter((p: any) => p.userId === userId)

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
  app.get('/api/v1/projects/:id', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      // ⭐ Phase 6 安全隔离: 归属校验
      const ownerCheck = await verifyProjectOwner(id, (request as any).user?.id)
      if (!ownerCheck.ok) {
        return reply.code(ownerCheck.status).send({ success: false, error: ownerCheck.error })
      }
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
  app.get('/api/v1/projects/:id/stream', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
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
  app.put('/api/v1/projects/:id', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      const body = request.body as any
      // ⭐ Phase 6 安全隔离: 归属校验
      const ownerCheck = await verifyProjectOwner(id, (request as any).user?.id)
      if (!ownerCheck.ok) {
        return reply.code(ownerCheck.status).send({ success: false, error: ownerCheck.error })
      }
      const project = await projectService.update(id, body)
      reply.send({ success: true, data: project })
    } catch (err: any) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  // ─── DELETE /api/v1/projects/:id ──────────
  app.delete('/api/v1/projects/:id', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      // ⭐ Phase 6 安全隔离: 归属校验
      const ownerCheck = await verifyProjectOwner(id, (request as any).user?.id)
      if (!ownerCheck.ok) {
        return reply.code(ownerCheck.status).send({ success: false, error: ownerCheck.error })
      }
      await projectService.delete(id)
      reply.send({ success: true, message: '项目已删除' })
    } catch (err: any) {
      reply.code(500).send({ success: false, error: err.message })
    }
  })

  // ─── DELETE /api/v1/projects/:id/clear — 清空剧本数据但保留项目和已生成的文件 ──────────
  app.delete('/api/v1/projects/:id/clear', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any
      // ⭐ Phase 6 安全隔离: 归属校验
      const ownerCheck = await verifyProjectOwner(id, (request as any).user?.id)
      if (!ownerCheck.ok) {
        return reply.code(ownerCheck.status).send({ success: false, error: ownerCheck.error })
      }
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

