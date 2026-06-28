/**
 * 混沌珠 — 对话共创路由（worldbuilder）
 * 不走 HdzAgentTask，直接对话式调用 worldbuilder Agent
 * BYOK：从 orchestrator 共享的 getUserLLMConfig
 * 支持 session 持久化对话历史
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { getUserLLMConfig, callLLM } from '../../services/hdz/llm.client.js'
import { worldbuilderService } from '../../services/hdz/worldbuilder.service.js'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export default async function hdzChatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /api/hdz/chat/sessions — 获取项目的所有对话 session 列表
  // query: { projectId }
  app.get('/api/hdz/chat/sessions', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.query as any

    if (!projectId) {
      return reply.status(400).send({ success: false, error: '缺少 projectId' })
    }

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const sessions = await prisma.hdzSession.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        messages: true,
      },
    })

    // 返回摘要（每条只带首尾两条消息的片段）
    const summary = sessions.map(s => {
      const msgs = (s.messages as any as ChatMessage[]) || []
      const firstMsg = msgs.length > 0 ? msgs[0].content.slice(0, 60) : ''
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1].content.slice(0, 60) : ''
      return {
        id: s.id,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        msgCount: msgs.length,
        firstMsg: firstMsg + (msgs[0]?.content?.length > 60 ? '...' : ''),
        lastMsg: lastMsg + (msgs[msgs.length - 1]?.content?.length > 60 ? '...' : ''),
      }
    })

    return { success: true, data: summary }
  })

  // GET /api/hdz/chat/sessions/:id — 获取某个 session 的完整消息
  app.get('/api/hdz/chat/sessions/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any

    const session = await prisma.hdzSession.findUnique({ where: { id } })
    if (!session) {
      return reply.status(404).send({ success: false, error: '会话不存在' })
    }

    const project = await prisma.hdzProject.findUnique({ where: { id: session.projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 清洗历史消息中的字面量反斜杠
    const msgs = (session.messages as any as ChatMessage[]) || []
    const cleaned = msgs.map(m => ({
      ...m,
      content: m.content.replace(/\\n/g, '\n'),
    }))

    return {
      success: true,
      data: {
        id: session.id,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: cleaned,
      },
    }
  })

  // DELETE /api/hdz/chat/sessions/:id — 删除某个 session
  app.delete('/api/hdz/chat/sessions/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any

    const session = await prisma.hdzSession.findUnique({ where: { id } })
    if (!session) {
      return reply.status(404).send({ success: false, error: '会话不存在' })
    }

    const project = await prisma.hdzProject.findUnique({ where: { id: session.projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    await prisma.hdzSession.delete({ where: { id } })
    return { success: true, data: { deleted: id } }
  })

  // PATCH /api/hdz/chat/sessions/:id/rename — 重命名 session（改 status 为自定义标题）
  // 复用 status 字段存用户自定义的 session 名称
  app.patch('/api/hdz/chat/sessions/:id/rename', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const { name } = request.body as any

    if (!name?.trim()) {
      return reply.status(400).send({ success: false, error: '缺少 name' })
    }

    const session = await prisma.hdzSession.findUnique({ where: { id } })
    if (!session) {
      return reply.status(404).send({ success: false, error: '会话不存在' })
    }

    const project = await prisma.hdzProject.findUnique({ where: { id: session.projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 用 status 字段存自定义标题（以 name: 开头标识）
    await prisma.hdzSession.update({
      where: { id },
      data: { status: `name:${name.trim()}` },
    })
    return { success: true, data: { id, name: name.trim() } }
  })

  // POST /api/hdz/chat/send — 向 worldbuilder 发消息
  // body: { projectId, message, sessionId? }
  app.post('/api/hdz/chat/send', async (request, reply) => {
    const user = request.user as any
    const { projectId, message, sessionId } = request.body as any

    if (!projectId || !message?.trim()) {
      return reply.status(400).send({ success: false, error: '缺少 projectId 或 message' })
    }

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    const userCfg = await getUserLLMConfig(project.userId)
    if (!userCfg) {
      return reply.status(400).send({ success: false, error: '请先在大模型设置中配置 LLM' })
    }

    // ===== Session 持久化 =====
    let session: any = null
    let historyMessages: ChatMessage[] = []

    if (sessionId) {
      // 续用已有 session
      session = await prisma.hdzSession.findUnique({ where: { id: sessionId } })
      if (!session || session.projectId !== projectId) {
        return reply.status(400).send({ success: false, error: '会话不存在或不属于该项目' })
      }
      historyMessages = (session.messages as any as ChatMessage[]) || []
    } else {
      // 创建新 session
      session = await prisma.hdzSession.create({
        data: {
          projectId,
          userId: user.id,
          status: 'active',
          messages: [],
        },
      })
    }

    // 添加用户消息
    const userMsg: ChatMessage = { role: 'user', content: message.trim(), timestamp: Date.now() }
    historyMessages.push(userMsg)

    // 保存用户消息到 DB（提前保存，防止 AI 调用失败丢消息）
    await prisma.hdzSession.update({
      where: { id: session.id },
      data: { messages: historyMessages as any },
    })

    const ctx = {
      userId: project.userId,
      projectId,
      taskId: 'chat-' + Date.now(),
      agentType: 'planner' as const,
      mode: 'single' as const,
      userInput: message.trim(),
      // 传入对话历史，让文曲星有上下文记忆
      historyMessages,
    }

    try {
      const response = await worldbuilderService.execute(ctx, userCfg)
      
      // 添加 AI 回复
      const aiMsg: ChatMessage = { role: 'assistant', content: response, timestamp: Date.now() }
      historyMessages.push(aiMsg)

      // 保存到 DB
      await prisma.hdzSession.update({
        where: { id: session.id },
        data: { messages: historyMessages as any },
      })

      // 👑 自动检测 AI 回复中的卡片 JSON，直接写到数据库（后端直接处理，不受截断影响）
      await autoSaveBatchCards(projectId, response)
      await autoSaveOutlineFromChat(projectId, response)

      // 🧠 记忆系统：检查是否需要生成对话摘要（每 50 轮 AI 回复）
      if (historyMessages.length > 0) {
        const aiMsgCount = historyMessages.filter(m => m.role === 'assistant').length
        if (aiMsgCount > 0 && aiMsgCount % 50 === 0) {
          // 异步触发摘要生成，不阻塞用户
          generateDialogueSummary(projectId, historyMessages, userCfg).catch(err =>
            console.error(`[HDZ/Memory] 摘要生成失败:`, err.message)
          )
        }
      }

      return {
        success: true,
        data: {
          response,
          sessionId: session.id,
        },
      }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}

// ===== 对话摘要生成（记忆系统） =====

const SUMMARY_SYSTEM_PROMPT = `你是一个小说创作对话的分析师。请仔细阅读以下一段小说作者与文曲星（AI创作顾问）的对话记录，然后生成一份约 2000 字的对话摘要。

摘要要求：
1. **已确定的设定**：所有在对话中达成共识的角色、世界观、宗门、能力体系等设定
2. **正在讨论中的话题**：尚未定论、还在讨论中的内容
3. **作者偏好**：作者表现出的写作风格偏好、审美倾向、特别喜欢的元素
4. **文曲星的建议**：文曲星提出的重要建议或待办事项
5. **关键决策节点**：对话中发生的重大决策或转折
6. **争议/犹豫点**：作者犹豫不决、或与文曲星有分歧的地方

要求：
- 约 2000 字
- 用中文，条理清晰
- 只记录客观事实和讨论内容，不做价值判断
- 不要遗漏重要设定信息
`

async function generateDialogueSummary(
  projectId: string,
  messages: { role: string; content: string; timestamp: number }[],
  llmCfg: any,
): Promise<void> {
  // 准备对话内容（最近 50 轮 AI 回复，即约 100 条消息 = 50 轮对话）
  const aiMsgs = messages.filter(m => m.role === 'assistant')
  const lastAi = aiMsgs[aiMsgs.length - 1]
  const startIndex = messages.findIndex(m => m.timestamp === lastAi.timestamp)
  const from = Math.max(0, startIndex - 100)
  const recentMessages = messages.slice(from, startIndex + 1)

  const dialogueText = recentMessages.map(m =>
    m.role === 'user' ? `作者：${m.content}` : `文曲星：${m.content}`
  ).join('\n\n---\n\n')

  // 记录轮次范围
  const msgCount = messages.filter(m => m.role === 'assistant').length
  const msgRange = `第 ${msgCount - 49} 轮 ~ 第 ${msgCount} 轮`

  // 获取已有摘要数量，用于标记版本
  const existingCount = await prisma.hdzMemory.count({
    where: { projectId, type: 'chat_dialogue_summary' },
  })

  try {
    const summaryText = await callLLM(
      llmCfg,
      SUMMARY_SYSTEM_PROMPT,
      `以下是需要分析的对话记录（${msgRange}）：\n\n${dialogueText}`,
      { maxTokens: 4096, temperature: 0.3 },
    )

    // 保存到 hdz_memories 表
    await prisma.hdzMemory.create({
      data: {
        projectId,
        type: 'chat_dialogue_summary',
        content: {
          text: summaryText,
          msgRange,
          msgCount,
          generatedAt: new Date().toISOString(),
        },
        version: existingCount + 1,
      },
    })

    console.log(`[HDZ/Memory] ✅ 对话摘要已保存 - project=${projectId}, ${msgRange}`)
  } catch (err: any) {
    console.error(`[HDZ/Memory] ❌ 摘要生成失败 - project=${projectId}: ${err.message}`)
  }
}

// ===== 后端自动卡片创建（检测 AI 回复中的 CARD_DATA / FACTION_DATA 并写入 DB） =====

async function autoSaveBatchCards(projectId: string, response: string): Promise<void> {
  // 检测角色卡片 ===CARD_DATA_START===
  try {
    const cardStart = '===CARD_DATA_START==='
    const cardEnd = '===CARD_DATA_END==='
    const si = response.indexOf(cardStart)
    if (si >= 0) {
      const jsonStart = si + cardStart.length
      const ei = response.indexOf(cardEnd)
      if (ei >= 0) {
        const jsonStr = response.slice(jsonStart, ei).trim()
        const data = JSON.parse(jsonStr)
        if (data?.batchCreate && Array.isArray(data?.characters) && data.characters.length > 0) {
          // 获取已有角色名称用于去重
          const existing = await prisma.hdzCharacter.findMany({ where: { projectId }, select: { name: true } })
          const existingNames = new Set(existing.map(c => c.name))

          let created = 0
          let skipped = 0
          for (const ch of data.characters) {
            const chName = (ch.name || '').trim()
            if (!chName || existingNames.has(chName)) {
              if (chName) existingNames.add(chName)
              skipped++
              continue
            }
            const properties: Record<string, any> = {}
            if (ch.faction) properties.faction = ch.faction
            if (ch.appearance) properties.appearance = ch.appearance
            if (ch.personality) properties.personality = ch.personality
            if (ch.backstory) properties.backstory = ch.backstory
            if (ch.skills) properties.skills = ch.skills
            if (ch.growthArc) properties.growthArc = ch.growthArc
            await prisma.hdzCharacter.create({
              data: { projectId, name: chName, role: ch.role || 'supporting', properties, relations: ch.relations || [] },
            })
            created++
            existingNames.add(chName)
          }
          console.log(`[HDZ/Batch] ✅ 后端自动创建 ${created} 个角色（跳过 ${skipped} 个）- project=${projectId}`)
        }
      }
    }
  } catch (err: any) {
    console.error(`[HDZ/Batch] ❌ 自动创建角色失败: ${err.message}`)
  }

  // 检测组织卡片 ===FACTION_DATA_START===
  try {
    const factionStart = '===FACTION_DATA_START==='
    const factionEnd = '===FACTION_DATA_END==='
    const si = response.indexOf(factionStart)
    if (si >= 0) {
      const jsonStart = si + factionStart.length
      const ei = response.indexOf(factionEnd)
      if (ei >= 0) {
        const jsonStr = response.slice(jsonStart, ei).trim()
        const data = JSON.parse(jsonStr)
        if (data?.batchCreate && Array.isArray(data?.factions) && data.factions.length > 0) {
          const existing = await prisma.hdzFaction.findMany({ where: { projectId }, select: { name: true } })
          const existingNames = new Set(existing.map(f => f.name))

          let created = 0
          let skipped = 0
          for (const f of data.factions) {
            const fName = (f.name || '').trim()
            if (!fName || existingNames.has(fName)) {
              if (fName) existingNames.add(fName)
              skipped++
              continue
            }
            await prisma.hdzFaction.create({
              data: {
                projectId,
                name: fName,
                type: f.type || 'other',
                description: f.description || '',
                leaderNames: f.leaderNames || [],
                memberNames: f.memberNames || [],
                properties: f.properties || {},
              },
            })
            created++
            existingNames.add(fName)
          }
          console.log(`[HDZ/Batch] ✅ 后端自动创建 ${created} 个组织（跳过 ${skipped} 个）- project=${projectId}`)
        }
      }
    }
  } catch (err: any) {
    console.error(`[HDZ/Batch] ❌ 自动创建组织失败: ${err.message}`)
  }
}

// ===== 对话中自动创建故事大纲（检测 OUTLINE_DATA JSON 块） =====

const OUTLINE_START = '===OUTLINE_DATA_START==='
const OUTLINE_END = '===OUTLINE_DATA_END==='

async function autoSaveOutlineFromChat(projectId: string, response: string): Promise<void> {
  try {
    const si = response.indexOf(OUTLINE_START)
    if (si < 0) return
    const jsonStart = si + OUTLINE_START.length
    const ei = response.indexOf(OUTLINE_END)
    if (ei < 0) return
    const jsonStr = response.slice(jsonStart, ei).trim()
    const data = JSON.parse(jsonStr)
    if (!data?.batchCreate || !Array.isArray(data?.chapters) || data.chapters.length === 0) return

    // 获取已有章节数
    const existing = await prisma.hdzChapter.findMany({
      where: { projectId },
      orderBy: { chapterNo: 'asc' },
      select: { chapterNo: true, title: true },
    })
    const existingNos = new Set(existing.map(c => c.chapterNo))

    let created = 0
    let skipped = 0
    for (const ch of data.chapters) {
      const no = ch.no
      if (!no || existingNos.has(no)) {
        skipped++
        continue
      }
      await prisma.hdzChapter.create({
        data: {
          projectId,
          chapterNo: no,
          title: ch.title || `第${no}章`,
          outline: ch.outline || '',
          status: 'outline',
          wordCount: ch.wordCount || 0,
        },
      })
      created++
      existingNos.add(no)
    }

    console.log(`[HDZ/Batch] ✅ 对话自动创建 ${created} 章大纲（跳过 ${skipped} 章）- project=${projectId}`)
  } catch (err: any) {
    console.error(`[HDZ/Batch] ❌ 自动创建大纲失败: ${err.message}`)
  }
}

