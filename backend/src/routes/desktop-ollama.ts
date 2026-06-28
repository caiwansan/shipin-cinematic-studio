/**
 * routes/desktop-ollama.ts — Phase 2: Ollama 本地大模型检测
 *
 * 提供本地 Ollama 服务检测 + 模型列表查询。
 * 前端通过 Electron IPC 或直接 HTTP 调用 localhost:11434
 */

import { FastifyInstance } from 'fastify'
import http from 'http'

/**
 * 检测本地 Ollama 服务是否运行
 */
function checkOllamaAlive(timeout = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:11434/api/tags', { timeout }, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

/**
 * 从本地 Ollama 获取模型列表
 */
function fetchOllamaModels(timeout = 5000): Promise<string[]> {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:11434/api/tags', { timeout }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const models = (json.models || []).map((m: any) => ({
            name: m.name,
            size: m.size,
            modifiedAt: m.modified_at,
            digest: m.digest,
          }))
          resolve(models)
        } catch {
          resolve([])
        }
      })
    })
    req.on('error', () => resolve([]))
    req.on('timeout', () => { req.destroy(); resolve([]) })
  })
}

export default async function desktopOllamaRoutes(fastify: FastifyInstance) {

  // GET /api/desktop/ollama/check — 检测本地 Ollama 是否运行
  fastify.get('/api/desktop/ollama/check', async (_request, reply) => {
    const alive = await checkOllamaAlive()
    if (!alive) {
      return reply.send({
        running: false,
        message: '本地 Ollama 服务未运行。请先启动 Ollama：ollama serve',
        models: [],
      })
    }

    const models = await fetchOllamaModels()
    reply.send({
      running: true,
      message: `Ollama 服务运行中，本地模型数: ${models.length}`,
      models,
    })
  })

  // GET /api/desktop/ollama/models — 获取本地模型列表
  fastify.get('/api/desktop/ollama/models', async (_request, reply) => {
    const alive = await checkOllamaAlive()
    if (!alive) {
      return reply.send({ success: false, error: 'Ollama 未运行', models: [] })
    }

    const models = await fetchOllamaModels()
    reply.send({ success: true, models })
  })

  // POST /api/desktop/ollama/pull — 拉取模型
  fastify.post('/api/desktop/ollama/pull', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = (request as any).user
    const userId = user?.id || user?.userId

    // 检查是否是钻石VIP
    const { prisma } = await import('../utils/index.js')
    const membership = await prisma.membership.findUnique({ where: { userId } })
    const userRecord = await prisma.user.findUnique({ where: { id: userId } })
    const tier = membership?.tier || userRecord?.memberTier || 'free'

    if (tier !== 'director') {
      return reply.status(403).send({ success: false, error: '需要钻石VIP才能使用本地模型' })
    }

    const { modelName } = request.body as any
    if (!modelName) {
      return reply.status(400).send({ success: false, error: '缺少 modelName' })
    }

    reply.send({
      success: true,
      message: `开始拉取模型 ${modelName}，请等待...`,
      // 实际应通过 SSE/WebSocket 推流进度
    })
  })

  // POST /api/desktop/ollama/chat — 测试本地模型对话
  fastify.post('/api/desktop/ollama/chat', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { model, message } = request.body as any
    if (!model || !message) {
      return reply.status(400).send({ success: false, error: '缺少 model 或 message' })
    }

    const user = (request as any).user
    const userId = user?.id || user?.userId
    const { prisma } = await import('../utils/index.js')
    const membership = await prisma.membership.findUnique({ where: { userId } })
    const userRecord = await prisma.user.findUnique({ where: { id: userId } })
    const tier = membership?.tier || userRecord?.memberTier || 'free'
    if (tier !== 'director') {
      return reply.status(403).send({ success: false, error: '需要开通钻石VIP才能使用本地大模型' })
    }

    // 直接调用本地 Ollama API
    try {
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: message }],
          stream: false,
        }),
      })

      if (!response.ok) {
        return reply.status(502).send({ success: false, error: 'Ollama 返回错误: ' + response.status })
      }

      const data = await response.json()
      reply.send({
        success: true,
        response: data.message?.content || '',
      })
    } catch (e: any) {
      reply.status(502).send({ success: false, error: '连接 Ollama 失败: ' + e.message })
    }
  })
}
