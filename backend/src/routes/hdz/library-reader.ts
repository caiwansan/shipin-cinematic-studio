/**
 * routes/hdz/library-reader.ts — 图书馆管理员（多层级金字塔策略版）
 *
 * 策略（遵陛下口谕）：
 * - 启动后持续运行，已读不重读，断点续读
 * - 每章 → 300字总结
 * - 每5章 → 1000字小结（batch-5）
 * - 每10章 → 1000字小结（batch-10）
 * - 每50章 → 2000字总结（batch-50）
 * - 每100章 → 2000字总结（batch-100）
 * - 上下文：最近的最高层级批次总结 + 上一章章节总结
 *
 * 层级优先级：batch-100 > batch-50 > batch-10 > batch-5
 *
 * LLM 调用走系统内置部署的 Qwen2.5（llama.cpp 运行 qwen2.5-1.5b-instruct-q4_k_m.gguf）。
 *
 * SSE 事件：
 *   progress       → 进度
 *   chapter-token  → 章节总结流式 token
 *   chapter-done   → 单章完成
 *   batch-token    → 批次小结流式 token
 *   batch-done     → 批次小结完成（含 level: 5/10/50/100）
 *   complete       → 全部完成
 *   error          → 错误
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import http from 'http'
import { callLLM, getUserLLMConfig, deepseekChat } from '../../services/hdz/llm.client.js'

const QWEN_URL = process.env.QWEN_SERVER_URL || 'http://127.0.0.1:8080'
const TIMEOUT_MS = Number(process.env.LIBRARY_READER_TIMEOUT) || 600000

// ── Prompt 模板 ──

const CHAPTER_SUMMARY_PROMPT = `你是一位专业的小说阅读分析师。
请为以下这一章内容写一篇约 300 字的总结。

要求：
1. 概括本章主要剧情
2. 点出关键人物和他们的行为
3. 如果有伏笔或新设定，标注出来
4. 保持语言简洁、信息密度高`

const BATCH_PROMPT_5 = `你是一位资深的小说编辑。
请基于以下 5 章的逐章总结，写一篇约 1000 字的阶段性阅读小结。

结构要求：
1. 【剧情总览】这 5 章的情节主线
2. 【人物动态】主要角色的变化与推进
3. 【关键伏笔】出现的伏笔和悬念
4. 【核心主题】贯穿这几章的中心思想

注意：基于提供的总结编写，不要编造。`

const BATCH_PROMPT_10 = `你是一位资深的小说编辑。
请基于以下 10 章的逐章总结，写一篇约 1000 字的阶段性阅读小结。

结构要求：
1. 【剧情总览】这 10 章的情节主线
2. 【人物动态】主要角色的变化与推进
3. 【关键伏笔】出现的伏笔和悬念
4. 【核心主题】贯穿这几章的中心思想

注意：基于提供的总结编写，不要编造。`

const BATCH_PROMPT_50 = `你是一位资深的小说总编。
请基于以下 50 章的逐章总结，写一篇 2000 字的阅读大总结（正负不超过100字）。

结构要求：
1. 【整体剧情】50 章的情节总汇
2. 【人物弧光】所有主要角色的成长曲线
3. 【伏笔网络】所有伏笔的铺设和回收情况
4. 【世界构建】新增设定、地点、势力格局

注意：基于提供的总结编写，不要编造。输出务必控制在 2000 字左右。`

const BATCH_PROMPT_100 = `你是一位资深的小说总编。
请基于以下 100 章的逐章总结，写一篇 2000 字的阅读大总结（正负不超过100字）。

结构要求：
1. 【整体剧情】100 章的情节总汇
2. 【人物弧光】所有主要角色的成长曲线
3. 【伏笔网络】所有伏笔的铺设和回收情况
4. 【世界构建】新增设定、地点、势力格局

注意：基于提供的总结编写，不要编造。输出务必控制在 2000 字左右。`

// ── 匹配 batch label 的 prompt ──
function batchPromptFor(level: number): string {
  switch (level) {
    case 5: return BATCH_PROMPT_5
    case 10: return BATCH_PROMPT_10
    case 50: return BATCH_PROMPT_50
    case 100: return BATCH_PROMPT_100
    default: return BATCH_PROMPT_10
  }
}

// ── 接口 ──

interface ChapterSummary {
  chapterNo: number
  title: string
  summary: string
}

/** 统一批次小结，用 level 区分层级 */
interface BatchSummary {
  level: 5 | 10 | 50 | 100
  batchIndex: number       // 从0开始
  chapterStart: number
  chapterEnd: number
  summary: string
}

interface ReaderData {
  chapters: ChapterSummary[]
  batches: BatchSummary[]
}

// ── 层级顺序（数组索引 = 优先级，越高越优先） ──
const LEVEL_ORDER: (5 | 10 | 50 | 100)[] = [5, 10, 50, 100]

/** 获取最近的最高层级批次总结 */
function getBestBatchSummary(batches: BatchSummary[]): BatchSummary | null {
  if (batches.length === 0) return null
  // 反向遍历 LEVEL_ORDER，取最高层级的最新一个
  for (const level of LEVEL_ORDER.reverse()) {
    const found = [...batches].reverse().find(b => b.level === level)
    if (found) return found
  }
  return batches[batches.length - 1]
}

// ── 数据读写 ──

async function getReaderData(projectId: string): Promise<ReaderData> {
  const project = await prisma.hdzProject.findUnique({
    where: { id: projectId },
    select: { libraryReaderCache: true, libraryReaderSummaries: true },
  })
  if (!project) return { chapters: [], batches: [] }

  let chapters: ChapterSummary[] = []
  if (project.libraryReaderCache) {
    try {
      const parsed = JSON.parse(project.libraryReaderCache)
      if (Array.isArray(parsed)) chapters = parsed as ChapterSummary[]
    } catch {}
  }

  let batches: BatchSummary[] = []
  if (project.libraryReaderSummaries) {
    try {
      const raw = project.libraryReaderSummaries
      const data = (typeof raw === 'string' ? JSON.parse(raw) : raw) as any
      if (Array.isArray(data)) {
        // 旧格式兼容：无 level 字段的按 chapterEnd-chapterStart 推测
        batches = data.map((d: any) => {
          if (d.level) return d as BatchSummary
          const span = (d.chapterEnd - d.chapterStart + 1)
          const level = span <= 5 ? 5 : span <= 10 ? 10 : span <= 50 ? 50 : 100
          return { ...d, level } as BatchSummary
        })
      } else if (typeof data === 'object' && data.batches) {
        batches = data.batches as BatchSummary[]
      }
    } catch {}
  }

  return { chapters, batches }
}

async function saveReaderData(projectId: string, data: ReaderData) {
  await prisma.hdzProject.update({
    where: { id: projectId },
    data: {
      libraryReaderCache: JSON.stringify(data.chapters),
      libraryReaderSummaries: JSON.stringify({ batches: data.batches }) as any,
    },
  })
}

/**
 * 双轨 LLM 调用：优先走用户 BYOK（deepseekChat），失败降级到系统 Qwen2.5
 * 流式兼容：仅传 onToken 时流式输出（Qwen 直接流，BYOK 无流则一次性返回后模拟流）
 */
async function callLLMWithFallback(
  userId: string,
  prompt: string,
  systemPrompt: string,
  onToken?: (text: string) => void,
  maxTokens = 512,
): Promise<string> {
  // 先尝试用户 BYOK
  if (userId) {
    try {
      const byokText = await deepseekChat(userId, systemPrompt, prompt)
      if (byokText && byokText.length > 10) {
        // BYOK 无流式，分块模拟流输出
        if (onToken) {
          const chunkSize = 5
          for (let i = 0; i < byokText.length; i += chunkSize) {
            onToken(byokText.slice(i, i + chunkSize))
          }
        }
        return byokText
      }
    } catch (byokErr: any) {
      console.warn(`[LibraryReader] BYOK call failed, falling back to Qwen: ${byokErr.message}`)
    }
  }

  // Fallback: 之前尝试 Qwen2.5，但系统 Qwen 服务已下线（资源释放），故不再 fallback
  // 直接抛错提示用户配置 API Key
  throw new Error('图书馆管理员需要配置大模型 API Key。请在「大模型设置」中配置 LLM 的 API Key（支持 DeepSeek/火山引擎/阿里百炼等）。\n未配置时无法生成章节总结。')
}

/** 构建新章的 prompt：带上最佳批次总结 + 上章总结 */
function buildChapterPrompt(
  ch: { chapterNo: number; title: string; content: string },
  data: ReaderData,
): string {
  let prompt = `【小说阅读进度】自第1章已读至第${data.chapters.length}章\n\n`

  // 带最佳级别的批次总结
  const bestBatch = getBestBatchSummary(data.batches)
  if (bestBatch) {
    prompt += `【${batchLevelLabel(bestBatch.level)}（第${bestBatch.chapterStart}-${bestBatch.chapterEnd}章）】\n`
    prompt += `${bestBatch.summary.slice(0, 1200)}\n\n`
  }

  // 带上章的章节总结
  if (data.chapters.length > 0) {
    const prev = data.chapters[data.chapters.length - 1]
    prompt += `【上一章总结（第${prev.chapterNo}章）】\n${prev.summary.slice(0, 400)}\n\n`
  }

  prompt += `【当前章节】\n`
  prompt += `第${ch.chapterNo}章「${ch.title}」\n`
  const content = ch.content || ''
  prompt += content.slice(0, 4000) + '\n'
  if (content.length > 4000) {
    prompt += `（本章共 ${content.length} 字，截取前 4000 字）\n`
  }

  return prompt.slice(0, 12000)
}

function batchLevelLabel(level: number): string {
  switch (level) {
    case 5: return '最近5章小结'
    case 10: return '最近10章小结'
    case 50: return '前50章总览'
    case 100: return '前100章总览'
    default: return '前情提要'
  }
}

/** 检查某层级的检查点是否到达（eg: 5章检查点在 5, 10, 15, 20...） */
function isCheckpoint(chapterNum: number, level: number): boolean {
  return chapterNum > 0 && chapterNum % level === 0
}

/** 获取当前章节数对应的所有即将触发的层级检查点 */
function getTriggers(chapterNum: number): (5 | 10 | 50 | 100)[] {
  const triggers: (5 | 10 | 50 | 100)[] = []
  for (const level of LEVEL_ORDER) {
    if (isCheckpoint(chapterNum, level)) triggers.push(level)
  }
  return triggers
}

export default async function libraryReaderRoutes(fastify: FastifyInstance) {
  // ── 1. 获取状态 ──
  fastify.get('/api/hdz/library-reader/status', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId: rawProjectId } = request.query as any
    if (!rawProjectId) return reply.status(400).send({ success: false, error: '缺少 projectId' })
    const projectId = String(rawProjectId)

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, libraryReaderEnabled: true },
    })
    if (!project || project.userId !== user.id) return reply.status(404).send({ success: false, error: '项目不存在' })

    const data = await getReaderData(projectId)
    const levels: Record<string, number> = {}
    for (const level of LEVEL_ORDER) {
      levels[`batch${level}Count`] = data.batches.filter(b => b.level === level).length
    }

    return {
      success: true,
      data: {
        enabled: project.libraryReaderEnabled,
        chapterCount: data.chapters.length,
        ...levels,
        lastChapterNo: data.chapters.length > 0 ? data.chapters[data.chapters.length - 1].chapterNo : 0,
        chapters: data.chapters.map(c => ({
          chapterNo: c.chapterNo, title: c.title,
          summary: c.summary,
          preview: c.summary.slice(0, 80) + (c.summary.length > 80 ? '...' : ''),
        })),
        batches: data.batches.map(b => ({
          level: b.level, batchIndex: b.batchIndex,
          chapterStart: b.chapterStart, chapterEnd: b.chapterEnd,
          preview: b.summary.slice(0, 100) + (b.summary.length > 100 ? '...' : ''),
        })),
      },
    }
  })

  // ── 2. 获取单章摘要 ──
  fastify.get('/api/hdz/library-reader/chapter/:chapterNo', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId: rawProjectId } = request.query as any
    const chapterNo = Number((request.params as any).chapterNo)
    if (!rawProjectId) return reply.status(400).send({ success: false, error: '缺少 projectId' })
    const projectId = String(rawProjectId)

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    })
    if (!project || project.userId !== user.id) return reply.status(404).send({ success: false, error: '项目不存在' })

    const data = await getReaderData(projectId)
    const found = data.chapters.find(c => c.chapterNo === chapterNo)
    if (!found) return reply.status(404).send({ success: false, error: '未找到该章摘要' })
    return { success: true, data: found }
  })

  // ── 3. 获取批次小结 ──
  fastify.get('/api/hdz/library-reader/batch/:batchIndex', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId: rawProjectId, level: rawLevel } = request.query as any
    const batchIndex = Number((request.params as any).batchIndex)
    const level = Number(rawLevel || 50) as 5 | 10 | 50 | 100
    if (!rawProjectId) return reply.status(400).send({ success: false, error: '缺少 projectId' })
    const projectId = String(rawProjectId)

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    })
    if (!project || project.userId !== user.id) return reply.status(404).send({ success: false, error: '项目不存在' })

    const data = await getReaderData(projectId)
    const found = data.batches.find(b => b.level === level && b.batchIndex === batchIndex)
    if (!found) return reply.status(404).send({ success: false, error: '未找到该批次小结' })
    return { success: true, data: found }
  })

  // ── 4. 启用/禁用 ──
  fastify.post('/api/hdz/library-reader/toggle', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId: rawProjectId, enabled } = request.body as any
    if (!rawProjectId) return reply.status(400).send({ success: false, error: '缺少 projectId' })
    const projectId = String(rawProjectId)

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true },
    })
    if (!project || project.userId !== user.id) return reply.status(404).send({ success: false, error: '项目不存在' })

    await prisma.hdzProject.update({
      where: { id: projectId },
      data: { libraryReaderEnabled: !!enabled },
    })
    return { success: true, data: { enabled: !!enabled } }
  })

  // ── 6. 清空阅读缓存（重新阅读） ──
  fastify.post('/api/hdz/library-reader/reset', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId: rawProjectId } = request.body as any
    if (!rawProjectId) return reply.status(400).send({ success: false, error: '缺少 projectId' })
    const projectId = String(rawProjectId)

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, libraryReaderEnabled: true },
    })
    if (!project || project.userId !== user.id) return reply.status(404).send({ success: false, error: '项目不存在' })

    // 清空阅读缓存和小结
    await prisma.hdzProject.update({
      where: { id: projectId },
      data: {
        libraryReaderCache: null,
        libraryReaderSummaries: null,
      },
    })
    return { success: true, data: { reset: true } }
  })

  // ── 5. SSE 流式阅读（多级金字塔） ──
  fastify.post('/api/hdz/library-reader', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId: rawProjectId } = request.body as any
    if (!rawProjectId) return reply.status(400).send({ success: false, error: '缺少 projectId' })
    const projectId = String(rawProjectId)

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, title: true },
    })
    if (!project || project.userId !== user.id) return reply.status(404).send({ success: false, error: '项目不存在' })

    const allChapters = await prisma.hdzChapter.findMany({
      where: { projectId }, orderBy: { chapterNo: 'asc' },
      select: { chapterNo: true, title: true, content: true, status: true },
    })
    // 所有有内容的章节（含 draft 已完成但未审阅的章节）
    const writtenChapters = allChapters.filter(ch => ch.content && ch.content.length > 100)
    if (writtenChapters.length === 0) {
      return reply.status(400).send({ success: false, error: '还没有已完成的章节' })
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    })
    const sendSSE = (event: string, data: any) => {
      try { reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) } catch {}
    }

    try {
      const data = await getReaderData(projectId)
      const doneChapters = data.chapters.length
      const pendingChapters = writtenChapters.filter(ch => ch.chapterNo > doneChapters)

      sendSSE('progress', {
        phase: 'preparing',
        message: `已有 ${doneChapters} 章已读，新增 ${pendingChapters.length} 章待阅读`,
        totalChapters: writtenChapters.length,
        doneChapters, pendingChapters: pendingChapters.length,
        batchLevels: {
          '5': data.batches.filter(b => b.level === 5).length,
          '10': data.batches.filter(b => b.level === 10).length,
          '50': data.batches.filter(b => b.level === 50).length,
          '100': data.batches.filter(b => b.level === 100).length,
        },
      })

      // 逐章阅读
      for (let i = 0; i < pendingChapters.length; i++) {
        const ch = pendingChapters[i]
        const chapterNum = doneChapters + i + 1

        sendSSE('progress', {
          phase: 'reading', currentChapter: ch.chapterNo, chapterTitle: ch.title,
          doneChapters: doneChapters + i, totalChapters: writtenChapters.length,
          message: `正在阅读第${ch.chapterNo}章「${ch.title}」...`,
        })

        // 构建上下文 prompt：最佳批次总结 + 上章总结
        const prompt = buildChapterPrompt(ch, data)

        let chapterText = ''
        try {
          await callLLMWithFallback(user.id, prompt, CHAPTER_SUMMARY_PROMPT, (text) => {
            chapterText += text
            sendSSE('chapter-token', { chapterNo: ch.chapterNo, text })
          }, 1024)
        } catch (err: any) {
          chapterText = `（第${ch.chapterNo}章总结生成失败: ${err.message}）`
        }

        data.chapters.push({
          chapterNo: ch.chapterNo,
          title: ch.title || `第${ch.chapterNo}章`,
          summary: chapterText,
        })

        sendSSE('chapter-done', {
          chapterNo: ch.chapterNo, title: ch.title, summary: chapterText,
          doneChapters: data.chapters.length, totalChapters: writtenChapters.length,
        })

        // 检查本关数的所有层级触发器
        const triggers = getTriggers(chapterNum)
        for (const level of triggers) {
          const batchIdx = Math.floor(chapterNum / level) - 1
          const cs = batchIdx * level + 1
          const ce = (batchIdx + 1) * level

          sendSSE('progress', {
            phase: 'summarizing-batch',
            message: `已读完 ${chapterNum} 章，正在为第${cs}-${ce}章写${level}章小结...`,
            level, batchIndex: batchIdx, chapterStart: cs, chapterEnd: ce,
          })

          // 取最近的 level 个章节总结作为输入
          const recentChapters = data.chapters.slice(-level)
          let batchPrompt = `【第${cs}-${ce}章逐章总结】\n\n`
          for (const rc of recentChapters) {
            batchPrompt += `第${rc.chapterNo}章「${rc.title}」总结：\n${rc.summary}\n\n`
          }

          const maxTokens = level >= 50 ? 4096 : 2048
          const maxPrompt = level >= 50 ? 30000 : 14000

          let batchText = ''
          try {
            await callLLMWithFallback(user.id, batchPrompt.slice(0, maxPrompt), batchPromptFor(level), (text) => {
              batchText += text
              sendSSE('batch-token', { level, batchIndex: batchIdx, text })
            }, maxTokens)
          } catch (err: any) {
            // 批次小结生成失败不中断，留下条记录标记失败
            batchText = `（第${cs}-${ce}章的${level}章小结生成失败: ${err.message}）`
          }

          data.batches.push({
            level, batchIndex: batchIdx,
            chapterStart: cs, chapterEnd: ce,
            summary: batchText,
          })

          sendSSE('batch-done', {
            level, batchIndex: batchIdx,
            chapterStart: cs, chapterEnd: ce,
            summary: batchText,
            chapterCount: data.chapters.length,
          })

          // 每生成一个批次小结就保存一次
          await saveReaderData(projectId, data)
        }

        // 每章保存（防崩溃，持续可续读）
        await saveReaderData(projectId, data)
      }

      // 全部完成
      const levels: Record<string, number> = {}
      for (const lvl of LEVEL_ORDER) levels[`batch${lvl}`] = data.batches.filter(b => b.level === lvl).length

      sendSSE('complete', {
        message: '图书馆管理员阅读完毕',
        totalChapters: data.chapters.length,
        ...levels,
        chapters: data.chapters.map(c => ({
          chapterNo: c.chapterNo, title: c.title,
          preview: c.summary.slice(0, 60) + (c.summary.length > 60 ? '...' : ''),
        })),
        batches: data.batches.map(b => ({
          level: b.level, batchIndex: b.batchIndex,
          chapterStart: b.chapterStart, chapterEnd: b.chapterEnd,
          preview: b.summary.slice(0, 80) + (b.summary.length > 80 ? '...' : ''),
        })),
      })

    } catch (err: any) {
      sendSSE('error', { error: `阅读失败：${err.message}` })
    } finally {
      reply.raw.end()
    }
  })
}
