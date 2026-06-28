/**
 * 混沌珠 — 风格 DNA 提取路由
 * 用户上传参考文本 → LLM 分析文风指纹
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { analyzeStyleDna } from '../../services/hdz/llm.client.js'

export default async function hdzStyleDnaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /api/hdz/style-dna/:projectId — 获取项目的风格 DNA
  app.get('/api/hdz/style-dna/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const dna = await prisma.hdzStyleDna.findUnique({ where: { projectId } })
    return { success: true, data: dna }
  })

  // PUT /api/hdz/style-dna/:projectId — 上传参考文本并异步调用 LLM 分析文风指纹
  app.put('/api/hdz/style-dna/:projectId', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { sourceText } = request.body as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    if (!sourceText?.trim()) {
      return reply.status(400).send({ success: false, error: '请输入参考文本' })
    }

    // upsert：保存源文本 + 标记分析中
    const dna = await prisma.hdzStyleDna.upsert({
      where: { projectId },
      create: { projectId, sourceText, fingerprint: { status: 'analyzing', textLength: sourceText.length } },
      update: { sourceText, fingerprint: { status: 'analyzing', textLength: sourceText.length } },
    })

    // ⭐ 异步调用 LLM 分析文风指纹（不阻塞用户响应）
    analyzeStyleDna(projectId, user.id, sourceText).catch(err => {
      console.error(`[style-dna] 异步分析失败 project=${projectId}:`, err)
    })

    return { success: true, data: dna }
  })

  // POST /api/hdz/style-dna/:projectId/analyze — 手动触发重新分析
  app.post('/api/hdz/style-dna/:projectId/analyze', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const dna = await prisma.hdzStyleDna.findUnique({ where: { projectId } })
    if (!dna?.sourceText) {
      return reply.status(400).send({ success: false, error: '请先上传参考文本' })
    }

    // 异步重新分析
    analyzeStyleDna(projectId, user.id, dna.sourceText).catch(err => {
      console.error(`[style-dna] 重新分析失败 project=${projectId}:`, err)
    })

    return { success: true, message: '分析已开始' }
  })
}
