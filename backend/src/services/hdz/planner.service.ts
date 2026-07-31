/**
 * services/hdz/planner.service.ts — 混沌珠 Planner Agent
 *
 * 职责：生成章节大纲（章节标题 + 每章核心事件）
 * BYOK：走 callLLM，不硬编码任何 Key
 */

import { prisma } from '../../utils/index.js'
import { callLLM, parseLLMJson, getAgentPrompt, getLockContext } from './llm.client.js'
import type { LLMConfig, OrchestratorContext } from './llm.client.js'

class PlannerService {
  async execute(ctx: OrchestratorContext, llmCfg: LLMConfig): Promise<void> {
    console.log(`[HDZ/Planner] execute start: task=${ctx.taskId}, project=${ctx.projectId}`)
    const project = await prisma.hdzProject.findUnique({ where: { id: ctx.projectId } })
    if (!project) throw new Error('项目不存在')

    const wordTarget = project.wordTarget || 50000
    const chapterCount = project.chapterWordTarget ? Math.ceil(wordTarget / project.chapterWordTarget) : 15

    const existingChapters = await prisma.hdzChapter.count({ where: { projectId: ctx.projectId } })
    let remainingChapters = chapterCount - existingChapters
    if (remainingChapters <= 0) {
      await this.setOutput(ctx.taskId, { message: '章节数已满，无需规划' })
      return
    }
    // 单次最多生成 15 章（glm-4-flash 长 JSON 输出易卡；15 章 ~3k tokens 稳定）
    const batchSize = Math.min(remainingChapters, 15)
    const endChapter = existingChapters + batchSize

    // ★ 读取已有章节摘要作为续写上下文（精简版）
    const memorySummaries = await prisma.hdzMemory.findMany({
      where: { projectId: ctx.projectId, type: 'chapter_summary' },
      orderBy: { updatedAt: 'desc' },
    })
    const characters = await prisma.hdzCharacter.findMany({ where: { projectId: ctx.projectId } })

    // ★ 已有章节总结（从 hdz_chapters.summary 取，精确控制每章300字）
    const existingChaptersDb = await prisma.hdzChapter.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { chapterNo: 'asc' },
      select: { chapterNo: true, title: true, summary: true },
    })
    const existingSummaryLines = existingChaptersDb.map(ch =>
      `第${ch.chapterNo}章「${ch.title}」：${(ch.summary || '').slice(0, 350)}`
    )
    const existingSummariesStr = existingSummaryLines.length > 0
      ? existingSummaryLines.join('\n')
      : '（暂无已完成的章节）'

    // 只取最新的 chapter_summary → 实际只需简要概述
    const summaryLines = memorySummaries.slice(0, 20).map(m => {
      const c = (m.content as any) || {}
      return `第${c.chapterNo}章「${c.title}」：${(c.summary || '').slice(0, 100)}`
    })
    const continuationContext = summaryLines.length > 0
      ? `\n**已有章节摘要（请保持连贯）：**\n${summaryLines.join('\n')}`
      : ''
    const characterBlock = characters.length > 0
      ? `\n**角色设定：**\n${characters.map(c => {
        const p = (c.properties as any) || {}
        return `${c.name}(${c.role}):${(p.personality||'').slice(0, 60)}`
      }).join('; ')}`
      : ''

    const modeLabel = existingChapters > 0 ? '续写规划' : '初始规划'

    const systemPrompt = await getAgentPrompt('hdz-planner', {
      '$MODE_LABEL': modeLabel,
      '$TITLE': project.title,
      '$GENRE': project.genre || '未指定',
      '$WORD_TARGET': String(wordTarget),
      '$STYLE_DESC': project.styleDesc ? `- 风格要求：${project.styleDesc}` : '',
      '$CHAIN_CONTEXT': continuationContext,
      '$EXISTING_SUMMARIES': existingSummariesStr,
      '$CHARACTER_BLOCK': characterBlock,
      '$START_CHAPTER': String(existingChapters + 1),
      '$END_CHAPTER': String(endChapter),
      '$BATCH_SIZE': String(batchSize),
    })

    // ★ 三大锁定注入
    const lockContext = await getLockContext(ctx.projectId)
    const fullSystemPrompt = systemPrompt + (lockContext ? `\n${lockContext}` : '')

    const userMessage = ctx.userInput || `请${modeLabel}第 ${existingChapters + 1} 章到第 ${endChapter} 章的章节大纲。`

    const text = await callLLM(llmCfg, fullSystemPrompt, userMessage, { maxTokens: 16384 })

    // 健壮的 JSON 解析，自动重试
    let chapters: any[] = []
    let lastParseError = ''
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const parsed = parseLLMJson(text)
        chapters = parsed?.chapters || []
        if (Array.isArray(chapters) && chapters.length > 0) break
      } catch (e: any) {
        lastParseError = `attempt ${attempt + 1}: ${e.message}`
        if (attempt < 1) await new Promise(r => setTimeout(r, 1000))
      }
    }

    // ★ 最后一搏：直接正则抓取 chapers 数组片段
    if (!Array.isArray(chapters) || chapters.length === 0) {
      const chMatch = text.match(/"chapters"\s*:\s*(\[[\s\S]*?\])\s*\}/)
      if (chMatch) {
        try {
          const partial = JSON.parse(chMatch[1])
          if (Array.isArray(partial) && partial.length > 0) chapters = partial
        } catch {}
      }
    }

    if (!Array.isArray(chapters) || chapters.length === 0) {
      throw new Error(`Planner JSON 解析失败: ${lastParseError}`)
    }

    // ★ 修复字段名：LLM 可能输出 no 而非 chapterNo，wordCount 可能缺失
    chapters = chapters.map(ch => ({
      chapterNo: ch.chapterNo ?? ch.no ?? 0,
      title: ch.title || '',
      outline: ch.outline || '',
      summary: ch.summary || '', // 300字章节精华版总结
      wordCount: ch.wordCount ?? 3000,
    })).filter(ch => ch.chapterNo > 0)

    for (const ch of chapters) {
      await prisma.hdzChapter.upsert({
        where: { projectId_chapterNo: { projectId: ctx.projectId, chapterNo: ch.chapterNo } },
        create: { projectId: ctx.projectId, chapterNo: ch.chapterNo, title: ch.title || '', outline: ch.outline || '', summary: ch.summary || '', status: 'outline' },
        update: { title: ch.title || undefined, outline: ch.outline || undefined, summary: ch.summary || undefined },
      })
    }

    await this.setOutput(ctx.taskId, { chapters, message: `共生成 ${chapters.length} 章大纲`, mode: ctx.mode })

    await prisma.$transaction(async (tx) => {
      await tx.hdzAgentTask.update({
        where: { id: ctx.taskId },
        data: { status: 'waiting_approval' },
      })
      await tx.eventLog.create({
        data: {
          entityType: 'task', entityId: ctx.taskId,
          eventType: 'TASK_WAITING_APPROVAL',
          payload: { agentType: 'planner' },
        },
      })
    })
    console.log(`[HDZ/Planner] Task ${ctx.taskId}: ${chapters.length} chapters created, waiting_approval`)
  }

  private async setOutput(taskId: string, output: any) {
    await prisma.hdzAgentTask.update({ where: { id: taskId }, data: { output } })
  }
}

export const plannerService = new PlannerService()
