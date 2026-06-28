/**
 * routes/admin-image-prompts.ts — 图片生成提示词模板管理路由
 *
 * GET    /api/admin/image-prompt-templates        — 获取所有模板
 * GET    /api/admin/image-prompt-templates/:type   — 按 type 获取
 * POST   /api/admin/image-prompt-templates        — 创建模板
 * PATCH  /api/admin/image-prompt-templates/:id    — 更新模板
 * DELETE /api/admin/image-prompt-templates/:id    — 删除模板
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

export default async function adminImagePromptRoutes(fastify: FastifyInstance) {
  // GET 所有模板
  fastify.get('/api/admin/image-prompt-templates', { preHandler: [requireAdmin] }, async () => {
    const templates = await prisma.imagePromptTemplates.findMany({
      orderBy: [
        { type: 'asc' },
        { sortOrder: 'asc' },
      ],
    })
    return { success: true, data: templates }
  })

  // GET 按 type 获取
  fastify.get('/api/admin/image-prompt-templates/:type', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type } = request.params as { type: string }
    const templates = await prisma.imagePromptTemplates.findMany({
      where: { type, enabled: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (templates.length === 0) {
      return reply.status(404).send({ success: false, error: `未找到 type 为 "${type}" 的模板` })
    }
    return { success: true, data: templates }
  })

  // POST 创建模板
  fastify.post('/api/admin/image-prompt-templates', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type, templateKey, title, content, sortOrder, enabled, description } = request.body as any

    if (!type || !templateKey || !title || !content) {
      return reply.status(400).send({ success: false, error: 'type, templateKey, title, content 为必填' })
    }

    // 检查唯一约束
    const existing = await prisma.imagePromptTemplates.findUnique({
      where: { type_templateKey: { type, templateKey } },
    })
    if (existing) {
      return reply.status(409).send({
        success: false,
        error: `type "${type}" 的 templateKey "${templateKey}" 已存在，请使用 PATCH 更新`,
      })
    }

    const created = await prisma.imagePromptTemplates.create({
      data: {
        type,
        templateKey,
        title,
        content,
        sortOrder: sortOrder ?? 0,
        enabled: enabled ?? true,
        description: description ?? null,
      },
    })

    return { success: true, data: created }
  })

  // PATCH 更新模板
  fastify.patch('/api/admin/image-prompt-templates/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { title, content, sortOrder, enabled, description, templateKey, type } = request.body as any

    const existing = await prisma.imagePromptTemplates.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '模板不存在' })
    }

    const data: any = {}
    if (title !== undefined) data.title = title
    if (content !== undefined) data.content = content
    if (sortOrder !== undefined) data.sortOrder = sortOrder
    if (enabled !== undefined) data.enabled = enabled
    if (description !== undefined) data.description = description
    if (templateKey !== undefined) data.templateKey = templateKey
    if (type !== undefined) data.type = type

    const updated = await prisma.imagePromptTemplates.update({ where: { id }, data })
    return { success: true, data: updated }
  })

  // DELETE 删除模板
  fastify.delete('/api/admin/image-prompt-templates/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.imagePromptTemplates.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ success: false, error: '模板不存在' })
    }
    await prisma.imagePromptTemplates.delete({ where: { id } })
    return { success: true }
  })
}
