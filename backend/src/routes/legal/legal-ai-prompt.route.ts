/**
 * Legal AI Prompt Routes — Prompt 管理
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function legalAiPromptRoutes(app: FastifyInstance) {
  // GET /api/admin/legal/prompts — 管理员获取全部 Prompt
  app.get('/api/admin/legal/prompts', { preHandler: [app.authenticate] }, async () => {
    const items = await prisma.legalAiPrompt.findMany({ orderBy: { updatedAt: 'desc' } })
    return { success: true, data: items }
  })

  // POST /api/admin/legal/prompts — 创建 Prompt
  app.post('/api/admin/legal/prompts', { preHandler: [app.authenticate] }, async (request) => {
    const body = request.body as any
    const item = await prisma.legalAiPrompt.create({ data: { name: body.name, content: body.content, category: body.category } })
    return { success: true, data: item }
  })

  // PATCH /api/admin/legal/prompts/:id
  app.patch('/api/admin/legal/prompts/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    const body = request.body as any
    const updated = await prisma.legalAiPrompt.update({ where: { id }, data: body })
    return { success: true, data: updated }
  })

  // POST /api/admin/legal/prompts/:id/rollback — 回滚（创建新版本）
  app.post('/api/admin/legal/prompts/:id/rollback', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params as any
    const existing = await prisma.legalAiPrompt.findUnique({ where: { id } })
    if (!existing) return { success: false, error: 'Prompt 不存在' }
    // 创建一个新版本，内容回到上一版（这里简化：标记版本+1但内容不变，实际可配合版本历史表）
    const updated = await prisma.legalAiPrompt.update({
      where: { id },
      data: { version: existing.version + 1 },
    })
    return { success: true, data: updated }
  })
}
