/**
 * routes/hdz/story-event.ts
 *
 * HDZ-NOVEL-INTELLIGENCE-V2: 剧情事件管理
 *
 * GET    /api/hdz/projects/:projectId/story-events              — 获取全部事件（时间线）
 * POST   /api/hdz/projects/:projectId/story-events              — 手动创建事件
 * POST   /api/hdz/projects/:projectId/story-events/extract      — AI 从章节文本提取事件
 * GET    /api/hdz/projects/:projectId/story-events/:eventId     — 获取事件详情
 * DELETE /api/hdz/projects/:projectId/story-events/:eventId     — 删除事件
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function storyEventRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // 获取全部事件（时间线）
  app.get('/api/hdz/projects/:projectId/story-events', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    const events = await prisma.storyEvent.findMany({
      where: { projectId },
      orderBy: [{ chapterNo: 'asc' }, { createdAt: 'asc' }],
    })

    return { success: true, data: events }
  })

  // 手动创建事件
  app.post('/api/hdz/projects/:projectId/story-events', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { chapterNo, eventType, title, description, participants, impacts, location } = request.body as any

    if (!title || !description) {
      return reply.status(400).send({ success: false, error: '缺少必填字段: title, description' })
    }

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    const event = await prisma.storyEvent.create({
      data: {
        projectId,
        chapterNo: chapterNo || 0,
        eventType: eventType || 'other',
        title,
        description,
        participants: participants || [],
        impacts: impacts || [],
        location,
      },
    })

    return { success: true, data: event }
  })

  // AI 从章节文本提取事件
  app.post('/api/hdz/projects/:projectId/story-events/extract', async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.params as any
    const { chapterNo, chapterText } = request.body as any

    if (!chapterText || !chapterNo) {
      return reply.status(400).send({ success: false, error: '缺少必填字段: chapterNo, chapterText' })
    }

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    // 获取角色列表用于匹配
    const characters = await prisma.hdzCharacter.findMany({ where: { projectId } })
    const charList = characters.map(c => `${c.name}(${c.id})`).join('、')

    // 动态导入 LLM 服务
    const { callLLM, getUserLLMConfig } = await import('../../services/hdz/llm.client.js')
    const userCfg = await getUserLLMConfig(user.id)
    if (!userCfg) {
      return reply.status(400).send({ success: false, error: '请先配置 LLM' })
    }

    const prompt = `你是一位小说剧情分析师。请从以下章节文本中提取关键剧情事件。

章节文本：
${chapterText.substring(0, 8000)}

角色列表：${charList || '无'}

请输出 JSON 数组格式：
[{
  "eventType": "battle|dialogue|revelation|travel|transformation|death|other",
  "title": "事件标题（20字以内）",
  "description": "事件描述（100字以内）",
  "participants": ["角色名1", "角色名2"],
  "impacts": [{
    "characterName": "角色名",
    "stateType": "HEALTH|INJURY|RELATIONSHIP|POWER|LOCATION|ITEM|MENTAL|IDENTITY",
    "change": "变化描述（50字以内）",
    "description": "详细说明"
  }],
  "location": "事件发生地点（可选）"
}]

只输出 JSON 数组，不要其他文字。`

    try {
      const result = await callLLM(userCfg, '你是一位小说剧情分析师', prompt, { maxTokens: 4000 })
      const jsonMatch = result.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        return reply.status(500).send({ success: false, error: 'AI 输出格式错误' })
      }

      const extractedEvents = JSON.parse(jsonMatch[0])

      // 保存事件到数据库
      const savedEvents = []
      for (const evt of extractedEvents) {
        // 匹配角色ID
        const participantIds = []
        for (const name of (evt.participants || [])) {
          const matched = characters.find(c => c.name === name || (name && name.includes(c.name)))
          if (matched) participantIds.push(matched.id)
        }

        const saved = await prisma.storyEvent.create({
          data: {
            projectId,
            chapterNo,
            eventType: evt.eventType || 'other',
            title: evt.title || '未命名事件',
            description: evt.description || '',
            participants: participantIds,
            impacts: (evt.impacts || []).map((imp: any) => ({
              characterName: imp.characterName,
              characterId: characters.find(c => c.name === imp.characterName)?.id || null,
              stateType: imp.stateType,
              change: imp.change,
              description: imp.description,
            })),
            location: evt.location || null,
          },
        })
        savedEvents.push(saved)

        // 自动应用影响：写入角色状态
        for (const impact of (evt.impacts || [])) {
          const char = characters.find(c => c.name === impact.characterName)
          if (char && impact.stateType) {
            await prisma.hdzCharacterState.create({
              data: {
                projectId,
                characterId: char.id,
                chapterNo,
                stateType: impact.stateType,
                event: evt.title,
                description: impact.change || impact.description,
                severity: 'normal',
              },
            })
          }
        }
      }

      return { success: true, data: savedEvents }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: `提取失败: ${err.message}` })
    }
  })

  // 获取事件详情
  app.get('/api/hdz/projects/:projectId/story-events/:eventId', async (request, reply) => {
    const user = request.user as any
    const { projectId, eventId } = request.params as any

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    const event = await prisma.storyEvent.findUnique({ where: { id: eventId } })
    if (!event || event.projectId !== projectId) {
      return reply.status(404).send({ success: false, error: '事件不存在' })
    }

    return { success: true, data: event }
  })

  // 删除事件
  app.delete('/api/hdz/projects/:projectId/story-events/:eventId', async (request, reply) => {
    const user = request.user as any
    const { projectId, eventId } = request.params as any

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (project.userId !== user.id) return reply.status(403).send({ success: false, error: '无权访问' })

    await prisma.storyEvent.delete({ where: { id: eventId } })
    return { success: true }
  })
}
