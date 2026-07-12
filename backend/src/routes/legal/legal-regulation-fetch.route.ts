/**
 * routes/legal/legal-regulation-fetch.route.ts
 *
 * AI 法规查询：输入法规名称，AI 自动搜索并保存
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function legalRegulationFetchRoutes(app: FastifyInstance) {
  // POST /api/admin/legal/regulations/fetch — AI 查询并保存法规
  app.post('/api/admin/legal/regulations/fetch', async (request) => {
    const body = request.body as any
    const title = (body.title || '').trim()

    if (!title) {
      return { success: false, error: '请提供法规名称' }
    }

    // 检查是否已存在
    const existing = await prisma.legalRegulation.findFirst({
      where: { title: { contains: title, mode: 'insensitive' } },
    })
    if (existing) {
      return { success: false, error: `法规「${title}」已存在`, data: existing }
    }

    // 调用 AI 获取法规全文
    const result = await fetchRegulationViaAI(title)
    if (!result.success) {
      return { success: false, error: result.error || 'AI 查询失败' }
    }

    // 写入数据库
    const item = await prisma.legalRegulation.create({
      data: {
        title: result.title || title,
        content: result.content || '',
        category: result.category || '通用法律',
        tags: result.tags || title,
        version: result.version || 'v1',
        enabled: true,
      },
    })

    return {
      success: true,
      data: {
        id: item.id,
        title: item.title,
        category: item.category,
        contentLength: item.content?.length || 0,
        message: '法规已保存',
      },
    }
  })
}

/**
 * 通过 AI 获取法规全文
 * 使用 narrativeGateway 调用 LLM 生成法规内容
 */
async function fetchRegulationViaAI(title: string): Promise<{
  success: boolean
  title?: string
  content?: string
  category?: string
  tags?: string
  version?: string
  error?: string
}> {
  try {
    const { narrativeGateway } = await import('../../runtime/narrative-gateway.js')

    const prompt = `你是一位中国法律专家。请严格按要求输出，不要添加额外说明。

用户需要查询的法规：${title}

请输出以下格式的法律法规信息：

法规名称：XXX
发布版本：XXX
分类：（劳动纠纷/合同纠纷/消费者权益/侵权纠纷/婚姻家庭/刑事诉讼/行政管理/知识产权/通用法律）
标签：（逗号分隔的3-5个标签）

以下是法规全文：

（逐条列出完整的法规条文，按"第X条"格式）`

    const response = await narrativeGateway.execute({
      systemPrompt: '你是一个精确的法律法规数据库。只输出事实数据，不添加解释。如果不知道某部法规的准确内容，请坦诚说明。',
      userMessage: prompt,
      userId: '__system_legal_fetch__',
      timeoutTier: 'long',
      maxTokens: 16000,
      temperature: 0.1,
    })

    if (!response?.content) {
      return { success: false, error: 'AI 无返回内容' }
    }

    const content = response.content

    // 提取法规名称
    const nameMatch = content.match(/法规名称[：:]\s*(.+)/)
    const regName = nameMatch?.[1]?.trim() || title

    // 提取版本
    const versionMatch = content.match(/发布版本[：:]\s*(.+)/)
    const version = versionMatch?.[1]?.trim() || '当前有效版本'

    // 提取分类
    const categoryMatch = content.match(/分类[：:]\s*(.+)/)
    const category = categoryMatch?.[1]?.trim() || '通用法律'

    // 提取标签
    const tagsMatch = content.match(/标签[：:]\s*(.+)/)
    const tags = tagsMatch?.[1]?.trim() || regName

    // 提取全文（"以下是法规全文："之后的内容）
    const fullTextMatch = content.match(/以下是法规全文[：:]\s*[\n\r]+([\s\S]+)/)
    const fullText = fullTextMatch?.[1]?.trim() || content

    return {
      success: true,
      title: regName,
      content: fullText,
      category: category,
      tags: tags,
      version: version,
    }
  } catch (err: any) {
    return { success: false, error: `AI 调用失败: ${err.message}` }
  }
}
