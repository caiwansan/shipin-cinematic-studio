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

    // ★ 已有章节编号 → 计算第一个空洞 firstGap（保证编号连续，不信任 LLM 飘号）
    const existingChaptersDb = await prisma.hdzChapter.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { chapterNo: 'asc' },
      select: { chapterNo: true, title: true, summary: true },
    })
    const existingNos = new Set(existingChaptersDb.map(ch => ch.chapterNo))
    const maxNo = existingNos.size > 0 ? Math.max(...existingNos) : 0
    // ★ 编号连续性检查：从 1 找第一个空洞
    let firstGap = 1
    while (existingNos.has(firstGap)) firstGap++
    const hasGap = firstGap <= maxNo

    let startChapter: number
    let remainingChapters: number
    if (hasGap) {
      // ★ 补洞模式：编号不连续（如 120-185 有、1-119 空）→ 从 firstGap 补起，不受字数目标限制
      startChapter = firstGap
      remainingChapters = Number.MAX_SAFE_INTEGER
      console.log(`[HDZ/Planner] 检测到编号空洞（第 ${firstGap} 章起缺失，已有 ${existingChaptersDb.length} 章），补洞模式`)
    } else {
      // 正常续写模式：从 maxNo+1 开始，受字数目标限制
      startChapter = maxNo + 1
      remainingChapters = chapterCount - maxNo
      if (remainingChapters <= 0) {
        await this.setOutput(ctx.taskId, { message: '章节数已满，无需规划' })
        return
      }
    }
    // 单次最多生成 15 章（glm-4-flash 长 JSON 输出易卡；15 章 ~3k tokens 稳定）
    const batchSize = Math.min(remainingChapters, 15)
    const endChapter = startChapter + batchSize - 1

    // ★ 读取已有章节摘要作为续写上下文（精简版）
    const memorySummaries = await prisma.hdzMemory.findMany({
      where: { projectId: ctx.projectId, type: 'chapter_summary' },
      orderBy: { updatedAt: 'desc' },
    })
    const characters = await prisma.hdzCharacter.findMany({ where: { projectId: ctx.projectId } })

    // ★ 已有章节总结（从 hdz_chapters.summary 取，精确控制每章300字）
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

    const modeLabel = existingChaptersDb.length > 0 ? '续写规划' : '初始规划'

    const systemPrompt = await getAgentPrompt('hdz-planner', {
      '$MODE_LABEL': modeLabel,
      '$TITLE': project.title,
      '$GENRE': project.genre || '未指定',
      '$WORD_TARGET': String(wordTarget),
      '$STYLE_DESC': project.styleDesc ? `- 风格要求：${project.styleDesc}` : '',
      '$CHAIN_CONTEXT': continuationContext,
      '$EXISTING_SUMMARIES': existingSummariesStr,
      '$CHARACTER_BLOCK': characterBlock,
      '$START_CHAPTER': String(startChapter),
      '$END_CHAPTER': String(endChapter),
      '$BATCH_SIZE': String(batchSize),
    })

    // ★ 三大锁定注入
    const lockContext = await getLockContext(ctx.projectId)
    const fullSystemPrompt = systemPrompt + (lockContext ? `\n${lockContext}` : '')

    const userMessage = ctx.userInput || `请${modeLabel}第 ${startChapter} 章到第 ${endChapter} 章的章节大纲。`

    // ★ LLM 调用 + 解析（最多 2 次 LLM 调用：首次返回非 JSON 时自动重试一次）
    let text = ''
    let chapters: any[] = []
    let lastParseError = ''
    for (let llmAttempt = 0; llmAttempt < 2; llmAttempt++) {
      text = await callLLM(llmCfg, fullSystemPrompt, userMessage, { maxTokens: 16384, timeoutMs: 360000 })
      console.log(`[HDZ/Planner] LLM raw 前 400 字: ${text.slice(0, 400).replace(/\n/g, ' ')}`)

      // 健壮的 JSON 解析，自动重试
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

      // ★ 最后一搏：直接正则抓取 chapters 数组片段
      if (!Array.isArray(chapters) || chapters.length === 0) {
        const chMatch = text.match(/"chapters"\s*:\s*(\[[\s\S]*?\])\s*\}/)
        if (chMatch) {
          try {
            const partial = JSON.parse(chMatch[1])
            if (Array.isArray(partial) && partial.length > 0) chapters = partial
          } catch {}
        }
      }

      if (Array.isArray(chapters) && chapters.length > 0) break
      if (llmAttempt === 0) console.warn('[HDZ/Planner] LLM 返回非 JSON，重新调用一次...')
    }

    if (!Array.isArray(chapters) || chapters.length === 0) {
      throw new Error(`Planner JSON 解析失败: ${lastParseError}`)
    }

    // ★ 修复字段名 + 编号钳制：LLM 可能输出 no 而非 chapterNo，且可能飘号（如从 120 开始）。
    //   一律按数组顺序从 startChapter 起连续重新编号，杜绝空洞；LLM 输出的编号仅作排序参考。
    const sorted = chapters.map((ch, idx) => ({
      chapterNo: ch.chapterNo ?? ch.no ?? 0,
      title: ch.title || '',
      outline: ch.outline || '',
      summary: ch.summary || '', // 300字章节精华版总结
      wordCount: ch.wordCount ?? 3000,
      _idx: idx,
    })).filter(ch => ch.chapterNo > 0)
    // 若 LLM 输出编号无序（如 [185, 120, ...]），按编号排序后重排更符合剧情顺序；
    // 若编号单调递增（正常），保持原序。
    const isAscending = sorted.every((ch, i) => i === 0 || ch.chapterNo > sorted[i - 1].chapterNo)
    if (!isAscending) sorted.sort((a, b) => a.chapterNo - b.chapterNo)
    const renumbered = sorted.map((ch, i) => ({
      chapterNo: startChapter + i,
      title: ch.title,
      outline: ch.outline,
      summary: ch.summary,
      wordCount: ch.wordCount,
    }))

    for (const ch of renumbered) {
      await prisma.hdzChapter.upsert({
        where: { projectId_chapterNo: { projectId: ctx.projectId, chapterNo: ch.chapterNo } },
        create: { projectId: ctx.projectId, chapterNo: ch.chapterNo, title: ch.title || '', outline: ch.outline || '', summary: ch.summary || '', status: 'outline' },
        update: { title: ch.title || undefined, outline: ch.outline || undefined, summary: ch.summary || undefined },
      })
    }

    await this.setOutput(ctx.taskId, { chapters: renumbered, message: `共生成 ${renumbered.length} 章大纲（第 ${startChapter}-${endChapter} 章）`, mode: ctx.mode })

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
    console.log(`[HDZ/Planner] Task ${ctx.taskId}: ${renumbered.length} chapters created, waiting_approval`)
  }

  private async setOutput(taskId: string, output: any) {
    await prisma.hdzAgentTask.update({ where: { id: taskId }, data: { output } })
  }
}

export const plannerService = new PlannerService()
