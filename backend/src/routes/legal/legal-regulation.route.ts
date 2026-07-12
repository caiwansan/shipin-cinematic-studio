/**
 * Legal Regulation Routes — 法律法规 CRUD
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function legalRegulationRoutes(app: FastifyInstance) {
  // GET /api/legal/regulations — 公开查询
  app.get('/api/legal/regulations', async (request) => {
    const query = request.query as any
    const where: any = {}
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' }
    if (query.tag) where.tags = { contains: query.tag }
    const page = Math.max(1, parseInt(query.page) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize) || 50))
    const skip = (page - 1) * pageSize
    const [items, total] = await Promise.all([
      prisma.legalRegulation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.legalRegulation.count({ where }),
    ])
    return { success: true, data: items, total, page, pageSize }
  })

  // GET /api/legal/regulations/:id
  app.get('/api/legal/regulations/:id', async (request) => {
    const { id } = request.params as any
    const item = await prisma.legalRegulation.findUnique({ where: { id } })
    if (!item) return { success: false, error: '不存在' }
    return { success: true, data: item }
  })

  // ═══ Admin Routes ═══
  // POST /api/admin/legal/regulations
  app.post('/api/admin/legal/regulations', async (request) => {
    const body = request.body as any
    const item = await prisma.legalRegulation.create({ data: body })
    return { success: true, data: item }
  })

  // PATCH /api/admin/legal/regulations/:id
  app.patch('/api/admin/legal/regulations/:id', async (request) => {
    const { id } = request.params as any
    const body = request.body as any
    const updated = await prisma.legalRegulation.update({ where: { id }, data: body })
    return { success: true, data: updated }
  })

  // DELETE /api/admin/legal/regulations/:id
  app.delete('/api/admin/legal/regulations/:id', async (request) => {
    const { id } = request.params as any
    await prisma.legalRegulation.delete({ where: { id } })
    return { success: true, data: { id } }
  })

  // ═══ AI 批量导入 ═══
  // POST /api/admin/legal/regulation/ai-import — AI 按类别批量生成法律条款
  app.post('/api/admin/legal/regulation/ai-import', async (request) => {
    const body = request.body as any
    const category = (body.category || '').trim()
    if (!category) return { success: false, error: '请指定法律类别（如：劳动纠纷、合同纠纷）' }

    // 调用 AI 生成完整法律条文
    const { narrativeGateway } = await import('../../runtime/narrative-gateway.js')
    const response = await narrativeGateway.execute({
      systemPrompt: `你是一个专业中国法律法规数据库。请根据用户指定的法律类别，输出该类别下最常用的法律法规及其核心条款。

你必须只输出一个 JSON 数组，不要包含任何其他文字、markdown 格式或代码块。

格式：
[{"title":"法律法规全称","content":"核心条款全文，按原文逐条列出","category":"类别","tags":"标签1,标签2","issuedBy":"发布机关"}]

要求：
1. 每次输出至少 5 部不同法规
2. 内容必须准确，每条条款都必须真实存在
3. 每部法规输出最常用的 5-15 条核心条款
4. 合同纠纷：民法典合同编（第464-680条核心条款）、担保法、招标投标法等
5. 劳动纠纷：劳动合同法、劳动法、社会保险法、工伤保险条例、劳动争议调解仲裁法、女职工劳动保护特别规定等
6. 婚姻家庭：民法典婚姻家庭编（第1041-1118条核心条款）、反家庭暴力法等
7. 消费者权益：消费者权益保护法、产品质量法等
8. 侵权纠纷：民法典侵权责任编（第1164-1258条核心条款）
9. 每部法规内容 500-3000 字
10. 禁止编造不存在的法律条款`,
      userMessage: `请生成 "${category}" 类别的法律法规 JSON 数组，至少 5 部不同法规。`,
      userId: '__system_legal_import__',
      timeoutTier: 'long',
      maxTokens: 12000,
      temperature: 0.1,
    })

    if (!response.ok || !response.content) {
      return { success: false, error: 'AI 生成失败' }
    }

    // 解析 AI 返回的 JSON
    let laws: any[] = []
    try {
      // 尝试从 markdown 代码块中提取 JSON
      const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.content.trim()
      laws = JSON.parse(jsonStr)
      if (!Array.isArray(laws)) throw new Error('不是数组')
    } catch (err: any) {
      return { success: false, error: `AI 返回数据格式错误：${err.message}` }
    }

    // 批量入库
    let imported = 0
    let skipped = 0
    for (const law of laws) {
      if (!law.title || !law.content) {
        skipped++
        continue
      }
      // 检查是否已存在
      const existing = await prisma.legalRegulation.findFirst({
        where: { title: law.title, category: category },
      })
      if (existing) {
        // 更新内容（合并条款）
        await prisma.legalRegulation.update({
          where: { id: existing.id },
          data: {
            content: existing.content + '\n\n' + law.content,
            tags: existing.tags ? `${existing.tags},${law.tags || ''}` : law.tags,
            enabled: true,
          },
        })
        imported++
        continue
      }
      await prisma.legalRegulation.create({
        data: {
          title: law.title,
          content: law.content,
          category: category,
          tags: law.tags || category,
          issuedBy: law.issuedBy || '',
          enabled: true,
        },
      })
      imported++
    }

    // 自动触发 embedding 重建
    try {
      const { legalRAGService } = await import('../../services/legal/legal-rag.service.js')
      await legalRAGService.reindexAll()
    } catch {
      console.warn('[LegalRegulation] Embedding 重建失败，请手动点击"重新生成 Embedding"')
    }

    return {
      success: true,
      data: {
        imported,
        skipped,
        totalResponse: laws.length,
        category,
        embeddingTriggered: true,
      },
    }
  })
}
