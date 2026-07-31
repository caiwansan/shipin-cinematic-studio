import { prisma } from '../../utils/index.js'
import { getUserLLMConfig, getAgentPrompt, callLLM, parseLLMJson } from './llm.client.js'

// 评分阈值缓存（启动时加载，运行时从 DB 读取）
let _reviewPassScore = 80

/** 从 RouteConfig 加载评分阈值配置（导出供管理 API 调用） */
export async function loadReviewConfig(): Promise<void> {
  try {
    const row = await prisma.routeConfig.findFirst({
      where: { scope: 'route:hdz-reviewer-config', key: 'review-threshold' },
    })
    if (row?.value && typeof row.value === 'object' && 'passScore' in (row.value as any)) {
      _reviewPassScore = (row.value as any).passScore as number
    } else {
      _reviewPassScore = 80
    }
  } catch {
    _reviewPassScore = 80
  }
  console.log(`[Reviewer] review passScore = ${_reviewPassScore} (loaded from RouteConfig)`)
}

// 启动时加载
loadReviewConfig()

/** 获取当前评分通过线 */
export function getReviewPassScore(): number {
  return _reviewPassScore
}

export class HdzReviewerService {
  async execute(ctx: any, passedCfg?: any): Promise<any> {
    const { projectId, chapterId, chapterNo } = ctx
    console.log(`[HDZ/Reviewer] 开始审校: project=${projectId}, chapter=${chapterNo}`)

    const chapter = chapterId
      ? await prisma.hdzChapter.findUnique({ where: { id: chapterId } })
      : await prisma.hdzChapter.findFirst({ where: { projectId, chapterNo } })
    if (!chapter || !chapter.content) throw new Error('章节不存在或内容为空')

    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project) throw new Error('项目不存在')

    // 构造 prompt
    const title = project.title || '未命名'
    const genre = project.genre || '未分类'
    const chapterTitle = chapter.title || `第 ${chapterNo} 章`
    const content = chapter.content

    const systemPrompt = await getAgentPrompt('hdz-reviewer', {
      '$TITLE': title,
      '$GENRE': genre,
      '$CHAPTER_NO': String(chapterNo),
      '$CHAPTER_TITLE': chapterTitle,
    })

    const userMsg = `## 正文内容\n\n${content.slice(0, 20000)}`

    // ★ Task 4：章节文本级一致性预检（规则引擎，无 LLM 成本）→ 警告注入审校 prompt
    let consistencyWarnings: string[] = []
    let consistencyScore = 100
    try {
      const { consistencyVerifier } = await import('./consistency-verifier.service.js')
      const v = await consistencyVerifier.verifyChapterText(projectId, chapterNo, content)
      consistencyWarnings = v.warnings
      consistencyScore = v.score
      if (consistencyWarnings.length > 0) {
        console.log(`[HDZ/Reviewer] ch${chapterNo}: 一致性预检 ${consistencyWarnings.length} 条警告`)
      }
    } catch (e: any) {
      console.warn(`[HDZ/Reviewer] ch${chapterNo}: 一致性预检失败: ${e?.message}`)
    }

    const finalUserMsg = consistencyWarnings.length > 0
      ? `## ⚠️ 一致性预检警告（请逐条核查正文是否违反，并在 issues 中标注核实结果）\n${consistencyWarnings.join('\n')}\n\n${userMsg}`
      : userMsg

    // ★ 02-B Task 4：优先用 orchestrator 传入的 cfg（带 Usage Ledger 元数据），否则自行加载
    const userCfg = passedCfg || (await getUserLLMConfig(project.userId))
    if (!userCfg) throw new Error('用户未配置大模型，请先在大模型设置中配置')
    console.log(`[HDZ/Reviewer] ch${chapterNo}: LLM ${userCfg.provider}/${userCfg.modelName}`)

    const text = await callLLM(userCfg, systemPrompt, finalUserMsg, {
      temperature: 0.3,
      maxTokens: 4096,
    })

    let review: any
    try {
      review = parseLLMJson(text)
    } catch (e) {
      // ⭐ JSON 解析失败 = 模型输出格式异常，非内容质量失败
      // 必须与「内容质量差」区分对待，避免把格式错误当劣质内容标记
      console.error(`[HDZ/Reviewer] ch${chapterNo}: JSON parse failed (model output format error), raw=${text.slice(0, 300)}`)
      throw new Error(`审校 LLM 输出 JSON 格式异常，请检查模型配置或重试: ${(e as Error).message}`)
    }

    if (!review || typeof review !== 'object') {
      throw new Error('审校 LLM 返回空结果')
    }

    // ★ 将 LLM 输出映射到系统评分维度
    const llmTotal = Number(review.totalScore ?? review.score)
    if (isNaN(llmTotal) || llmTotal <= 0) {
      throw new Error(`审校评分无效: totalScore=${review.totalScore}, score=${review.score}`)
    }
    const llmScores = review.scores || {}
    const llmVerdict = (review.verdict || '').toUpperCase()

    // ⭐ 从 RouteConfig 读取评分通过线（默认 80）
    const passScore = getReviewPassScore()
    const isPass = llmTotal >= passScore
    const verdict = isPass ? '通过' : '劣质品'
    console.log(`[HDZ/Reviewer] ch${chapterNo}: totalScore=${llmTotal}, passScore=${passScore}, verdict=${verdict}`)

    // 从 issues 中计算扣分类别
    const issues: Array<{ severity: string; category: string; detail: string; suggestion: string }> = review.issues || []
    let aiTaintPenalty = 0
    let styleDriftPenalty = 0
    let logicPenalty = 0
    for (const issue of issues) {
      const cat = (issue.category || '').toLowerCase()
      const sev = (issue.severity || '').toLowerCase()
      const pts = sev === 'critical' ? -10 : sev === 'major' ? -5 : -2
      if (cat === 'style') styleDriftPenalty += pts
      else if (cat === 'logic') logicPenalty += pts
      else if (cat === 'character' || cat === 'other') aiTaintPenalty += pts
      else aiTaintPenalty += pts
    }
    const literaryScore = Number(llmScores.literary) || 0
    const qualityBonus = Math.max(0, literaryScore - 20) * 2
    const score = llmTotal

    console.log(`[HDZ/Reviewer] ch${chapterNo}: totalScore=${llmTotal}, verdict=${verdict}, issues=${issues.length}, aiTaint=${aiTaintPenalty}, styleDrift=${styleDriftPenalty}, logic=${logicPenalty}, qualityBonus=${qualityBonus}`)

    const reviewData = {
      score,
      aiTaintPenalty,
      styleDriftPenalty,
      logicPenalty,
      qualityBonus,
      summary: review.summary || (issues.length > 0 ? `共发现 ${issues.length} 个问题` : '审核完成'),
      issues: issues.slice(0, 10),
      verdict,
      chapterNo,
      chapterId: chapter.id,
      reviewedAt: new Date().toISOString(),
      consistencyWarnings,
      consistencyScore,
    }

    const newStatus: string = isPass ? 'reviewed' : 'draft'
    await prisma.$transaction(async (tx) => {
      await tx.hdzChapter.update({
        where: { id: chapter.id },
        data: {
          status: newStatus,
          reviewNotes: reviewData,
        },
      })
      await tx.eventLog.create({
        data: {
          entityType: 'chapter', entityId: chapter.id,
          eventType: 'CHAPTER_STATUS_CHANGED',
          payload: { status: newStatus, source: 'reviewer_completed', chapterNo, score: llmTotal },
        },
      })
    })

    console.log(`[HDZ/Reviewer] ch${chapterNo}: totalScore=${llmTotal}, verdict=${verdict}, aiTaint=${aiTaintPenalty}, styleDrift=${styleDriftPenalty}, logic=${logicPenalty}, qualityBonus=${qualityBonus}`)

    // 更新 task 状态
    await prisma.$transaction(async (tx) => {
      await tx.hdzAgentTask.update({
        where: { id: ctx.taskId },
        data: {
          output: reviewData,
          status: isPass ? 'completed' : 'waiting_approval',
        },
      })
      await tx.eventLog.create({
        data: {
          entityType: 'task', entityId: ctx.taskId,
          eventType: isPass ? 'TASK_COMPLETED' : 'TASK_WAITING_APPROVAL',
          payload: { agentType: 'reviewer', chapterNo, score: llmTotal },
        },
      })
    })

    return reviewData
  }

  async getReview(projectId: string, chapterNo: number): Promise<any> {
    // 使用 raw SQL 避免 Prisma 的 Json/UUID 类型字段随机丢失
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text AS id,
              "chapterNo" AS "chapterNo",
              title,
              status,
              "reviewNotes"::text AS review_notes,
              "wordCount"
       FROM hdz_chapters
       WHERE "projectId" = $1::uuid AND "chapterNo" = $2
       LIMIT 1`,
      projectId, chapterNo
    )
    if (!rows || rows.length === 0) return null
    const row = rows[0]
    let reviewNotes: any = null
    if (row.review_notes) {
      try { reviewNotes = JSON.parse(row.review_notes) } catch { reviewNotes = null }
    }
    if (!reviewNotes) {
      return {
        id: row.id,
        chapterNo: row.chapterNo,
        title: row.title,
        status: row.status,
        wordCount: row.wordCount,
        reviewed: false,
      }
    }
    const notes = Array.isArray(reviewNotes) ? reviewNotes[0] : reviewNotes
    if (!notes || typeof notes !== 'object') {
      return {
        id: row.id,
        chapterNo: row.chapterNo,
        title: row.title,
        status: row.status,
        wordCount: row.wordCount,
        reviewed: false,
      }
    }
    return {
      id: row.id,
      chapterNo: row.chapterNo,
      title: row.title,
      status: row.status,
      wordCount: row.wordCount,
      reviewed: true,
      score: notes.score,
      aiTaintPenalty: notes.aiTaintPenalty,
      styleDriftPenalty: notes.styleDriftPenalty,
      logicPenalty: notes.logicPenalty,
      qualityBonus: notes.qualityBonus,
      summary: notes.summary,
      verdict: notes.verdict,
      issues: notes.issues || [],
      reviewedAt: notes.reviewedAt || null,
    }
  }
}

export const reviewerService = new HdzReviewerService()
