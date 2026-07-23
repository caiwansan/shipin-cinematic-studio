/**
 * routes/legal/legal-agent-chat.route.ts
 *
 * AI 法律顾问独立聊天入口（不依赖 case）
 * 适用于 AI 法律顾问页面的自由咨询
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { requireMemberTier } from '../../middleware/require-member-tier.js'
import { MemberTier } from '../../middleware/require-member-tier.js'

export default async function legalAgentChatRoutes(app: FastifyInstance) {
  // POST /api/legal/agent/chat — 法律顾问自由咨询（Pro+）
  app.post('/api/legal/agent/chat', { preHandler: requireMemberTier(MemberTier.Pro) }, async (request) => {
    const body = request.body as any
    const message = (body.message || '').trim()
    const sessionId = body.sessionId || ''

    if (!message) {
      return { success: false, error: '请输入您的问题' }
    }

    try {
      const { legalAgent } = await import('../../services/legal/legal-agent.service.js')

      // 尝试解析 token 获取真实 userId，无 token 则用默认
      let userId = '__legal_adviser__'
      try {
        await request.jwtVerify()
        const decoded = request.user as any
        if (decoded?.id) userId = decoded.id
      } catch {
        // 无 token 或 token 无效，使用默认 userId
      }

      // 如果提供了 sessionId，查找对应的 case（顾问聊天使用通用 case）
      let caseId = '00000000-0000-0000-0000-000000000001' // 通用顾问 case
      let actualSessionId = sessionId

      if (!actualSessionId) {
        // 创建新 session
        const session = await prisma.legalCaseChatSession.create({
          data: {
            caseId,
            title: message.slice(0, 50),
          },
        })
        actualSessionId = session.id
      } else {
        // 验证 session 存在
        const session = await prisma.legalCaseChatSession.findUnique({ where: { id: actualSessionId } })
        if (!session) {
          // session 失效，新建
          const newSession = await prisma.legalCaseChatSession.create({
            data: {
              caseId,
              title: message.slice(0, 50),
            },
          })
          actualSessionId = newSession.id
        }
      }

      // 保存用户消息
      await prisma.legalCaseChatMessage.create({
        data: { sessionId: actualSessionId, role: 'user', content: message },
      })

      // 调用 LegalAgent（传入通用 caseId）
      const chatResult = await legalAgent.chat(caseId, actualSessionId, message, userId)

      // 保存 AI 回复
      await prisma.legalCaseChatMessage.create({
        data: { sessionId: actualSessionId, role: 'assistant', content: chatResult.content },
      })

      return {
        success: true,
        data: {
          reply: chatResult.content,
          ragSources: chatResult.ragSources,
          sessionId: actualSessionId,
        },
      }
    } catch (err: any) {
      console.error(`[LegalAgentChat] 错误: ${err.message}`)
      return {
        success: true,
        data: {
          reply: `抱歉，${err.message}`,
          ragSources: [],
          sessionId: sessionId || undefined,
        },
      }
    }
  })

  // GET /api/legal/agent/sessions — 获取历史会话列表
  app.get('/api/legal/agent/sessions', async () => {
    const sessions = await prisma.legalCaseChatSession.findMany({
      where: { caseId: '00000000-0000-0000-0000-000000000001' },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { _count: { select: { messages: true } } },
    })
    return { success: true, data: sessions }
  })

  // GET /api/legal/agent/sessions/:id/messages — 获取会话消息历史
  app.get('/api/legal/agent/sessions/:id/messages', async (request) => {
    const { id } = request.params as any
    const messages = await prisma.legalCaseChatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: messages }
  })

  // POST /api/legal/agent/sessions/:id/summary — 生成对话总结
  app.post('/api/legal/agent/sessions/:id/summary', async (request) => {
    const { id } = request.params as any

    // 读取当前 session 的对话
    const session = await prisma.legalCaseChatSession.findUnique({ where: { id } })
    if (!session) return { success: false, error: '会话不存在' }

    const messages = await prisma.legalCaseChatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
    })

    if (messages.length === 0) {
      return { success: false, data: { summary: '暂无对话内容' } }
    }

    // 构建对话文本
    const dialog = messages.map((m, i) =>
      `${m.role === 'user' ? '👤 用户' : '⚖️ 法律顾问'}：${m.content}`
    ).join('\n\n---\n\n')

    // 调用 AI 生成总结
    try {
      const { legalAgent } = await import('../../services/legal/legal-agent.service.js')
      const summary = await legalAgent.callLLM({
        systemPrompt: `你是一位法律案件的总结助手。请根据以下对话内容，生成结构化的案件总结。

请输出以下格式（不要输出JSON，用自然语言）：

## 📋 案件类型
（判断属于什么类型的法律纠纷）

## 🔑 关键事实
（列出用户描述的核心事实，分点列出）

## 📚 涉及法律依据
（如有引用法律条款则列出，否则写"对话中未引用具体法律依据"）

## ⚠️ 风险提示
（指出案件中的主要风险点）

## ✅ 建议行动
（给出下一步建议）

## 📌 对话摘要
（100字以内的简要总结）`,
        userMessage: `请根据以下对话内容生成案件总结：\n\n${dialog}`,
        userId: '__system_legal_summary__',
        timeoutTier: 'normal',
        maxTokens: 4000,
        temperature: 0.3,
        skipPlatformLimit: true,
      })

      return { success: true, data: { summary, messageCount: messages.length } }
    } catch (err: any) {
      return { success: false, error: `生成总结失败：${err.message}` }
    }
  })
}
