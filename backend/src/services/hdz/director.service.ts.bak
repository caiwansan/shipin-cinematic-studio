/**
 * services/hdz/director.service.ts — 混沌珠 Director Agent
 *
 * 职责：分析小说的大纲和角色设定，生成详细的写作指导
 * - 读取所有 chapters（大纲）
 * - 读取所有 characters
 * - 读取 styleDna
 * - 调用 LLM 生成写作指导
 * - 将指导写入 memory（type: 'pending_hooks'）
 * - 输出：{ directorNotes: [...], hookSuggestions: [...], message: "..." }
 *
 * BYOK：走 callLLM，不硬编码任何 Key
 */

import { prisma } from '../../utils/index.js'
import { callLLM, parseLLMJson, getAgentPrompt, getLockContext } from './llm.client.js'
import type { LLMConfig, OrchestratorContext } from './llm.client.js'

class DirectorService {
  async execute(ctx: OrchestratorContext, llmCfg: LLMConfig): Promise<void> {
    console.log(`[HDZ/Director] execute start: task=${ctx.taskId}, project=${ctx.projectId}`)
    const project = await prisma.hdzProject.findUnique({ where: { id: ctx.projectId } })
    if (!project) throw new Error('项目不存在')

    // ★ 读取所有章节大纲
    const chapters = await prisma.hdzChapter.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { chapterNo: 'asc' },
    })

    // ★ 读取所有角色设定
    const characters = await prisma.hdzCharacter.findMany({
      where: { projectId: ctx.projectId },
    })

    // ★ 读取风格 DNA
    const styleDna = await prisma.hdzStyleDna.findFirst({
      where: { projectId: ctx.projectId },
    })

    // ★ 读取已有的记忆（避免重复指导）
    const existingMemories = await prisma.hdzMemory.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { updatedAt: 'desc' },
    })

    // ★ 构建章节概览
    const outlineText = chapters.map(ch =>
      `【第${ch.chapterNo}章】${ch.title || ''}\n大纲：${(ch.outline || '').slice(0, 200)}\n${ch.content ? `正文摘要：${ch.content.slice(0, 300)}` : '（未撰写）'}`
    ).join('\n\n')

    // ★ 角色概览
    const characterText = characters.map(c => {
      const props = (c.properties as any) || {}
      const rels = (c.relations as any[]) || []
      const relStr = rels.length > 0 ? rels.map(r => `${r.target}（${r.type}）`).join('、') : '暂无'
      return `【${c.name}】角色定位: ${c.role}
  年龄: ${props.age || '未知'} | 性别: ${props.gender || '未知'}
  性格: ${(props.personality || '').slice(0, 100)}
  动机: ${(props.motivation || '').slice(0, 100)}
  角色弧: ${c.arc || '未设定'}
  关系: ${relStr}`
    }).join('\n\n')

    // ★ 风格参考
    const styleRef = styleDna?.sourceText
      ? `\n【参考风格样本】\n${styleDna.sourceText.slice(0, 1000)}`
      : ''

    const styleDesc = project.styleDesc ? `\n【风格要求】${project.styleDesc}` : ''

    // ★ 三大锁定注入
    const lockContext = await getLockContext(ctx.projectId)

    // ★ 获取 Agent prompt（带 fallback）
    let systemPrompt: string
    try {
      systemPrompt = await getAgentPrompt('hdz-director', {
        '$TITLE': project.title,
        '$GENRE': project.genre || '未指定',
        '$CHAPTER_COUNT': String(chapters.length),
        '$CHARACTER_COUNT': String(characters.length),
      })
    } catch {
      // Fallback: 硬编码默认 prompt
      systemPrompt = `你是一位资深小说创作指导（Director），负责为小说「${project.title}」（${project.genre || '未指定'}）制定详细的写作指导。

## 输出要求
请严格以 JSON 格式输出，结构如下：
{
  "directorNotes": [
    {
      "chapterNo": 1,
      "writingPoints": ["本章需要强化的写作要点列表"],
      "paceAdvice": "本章节奏建议（起承转合）",
      "keyEmotion": "本章核心情感基调",
      "focusCharacters": ["本章应重点描写的角色名"],
      "techniques": ["推荐使用的写作技巧"],
      "transitionAdvice": "与下一章的衔接建议"
    }
  ],
  "hookSuggestions": [
    {
      "chapterNo": 1,
      "hookType": "悬念/伏笔/反转/情感钩子",
      "description": "伏笔/悬念的具体内容",
      "resolveChapter": 3,
      "priority": "high/medium/low"
    }
  ],
  "overallAdvice": "整体写作策略建议（节奏把控、人物成长主轴、核心冲突推进等）"
}

## 原则
1. 分析每章大纲，给出针对性的写作要点
2. 注意章节间的节奏安排：紧张-舒缓交替，避免连续高强度或连续平淡
3. 伏笔安排要提前埋设，中后期回收
4. 角色弧线要贯穿始终
5. 风格要和项目风格描述保持一致
6. 字数建议合理（参考单章目标字数）
7. 给出可执行的、具体的建议，避免空泛`
    }

    const fullSystemPrompt = systemPrompt + (lockContext ? `\n${lockContext}` : '') + styleRef + styleDesc

    // ★ 已有的记忆上下文（避免重复埋设相同伏笔）
    const memoryContext = existingMemories.length > 0
      ? `\n【已有故事记忆（已确认的世界状态/伏笔）】\n${existingMemories.map(m => `[${m.type}] ${JSON.stringify(m.content).slice(0, 200)}`).join('\n')}`
      : ''

    const userMessage = ctx.userInput || `请为这部小说生成详细的写作指导。

【完整大纲（共 ${chapters.length} 章）】
${outlineText.slice(0, 10000)}

【角色设定（共 ${characters.length} 个）】
${characterText.slice(0, 5000)}
${memoryContext}

请分析以上内容，输出每章的写作要点、伏笔/悬念建议，以及整体写作策略。`

    console.log(`[HDZ/Director] sending to LLM (${llmCfg.provider}/${llmCfg.modelName})`)
    const text = await callLLM(llmCfg, fullSystemPrompt, userMessage, { maxTokens: 16384, temperature: 0.7 })

    // ★ 健壮解析 LLM 返回的 JSON
    let parsed: any
    try {
      parsed = parseLLMJson(text)
    } catch (e: any) {
      console.warn(`[HDZ/Director] JSON parsing failed, trying fallback regex: ${e.message}`)
      // 最后一搏
      const dnMatch = text.match(/"directorNotes"\s*:\s*(\[[\s\S]*?\])\s*\}/)
      const hsMatch = text.match(/"hookSuggestions"\s*:\s*(\[[\s\S]*?\])\s*\}/)
      if (dnMatch || hsMatch) {
        parsed = {}
        if (dnMatch) try { parsed.directorNotes = JSON.parse(dnMatch[1]) } catch {}
        if (hsMatch) try { parsed.hookSuggestions = JSON.parse(hsMatch[1]) } catch {}
      }
    }

    const directorNotes: any[] = parsed?.directorNotes || []
    const hookSuggestions: any[] = parsed?.hookSuggestions || []

    // ★ 将写作指导写入 memory（type: 'pending_hooks'）
    if (hookSuggestions.length > 0) {
      // 合并到已有的 pending_hooks 记忆
      const existingHooks = await prisma.hdzMemory.findFirst({
        where: { projectId: ctx.projectId, type: 'pending_hooks' },
      })

      const hooksContent = {
        hooks: hookSuggestions.map(h => ({
          chapterNo: h.chapterNo,
          hookType: h.hookType || '悬念',
          description: h.description || '',
          resolveChapter: h.resolveChapter || null,
          priority: h.priority || 'medium',
        })),
        generatedAt: new Date().toISOString(),
      }

      if (existingHooks) {
        // 合并新旧伏笔（按 chapterNo 去重）
        const oldHooks = ((existingHooks.content as any)?.hooks || []) as any[]
        const mergedHooks = [...oldHooks]
        for (const newHook of hooksContent.hooks) {
          const exists = mergedHooks.some(
            (h: any) => h.chapterNo === newHook.chapterNo && h.description === newHook.description
          )
          if (!exists) mergedHooks.push(newHook)
        }
        await prisma.hdzMemory.update({
          where: { id: existingHooks.id },
          data: { content: { ...hooksContent, hooks: mergedHooks } },
        })
      } else {
        await prisma.hdzMemory.create({
          data: { projectId: ctx.projectId, type: 'pending_hooks', content: hooksContent },
        })
      }
    }

    // ★ 写入 director_notes 类型的记忆（供后续 writer 参考）
    if (directorNotes.length > 0) {
      const existingNotes = await prisma.hdzMemory.findFirst({
        where: { projectId: ctx.projectId, type: 'director_notes' },
      })

      if (existingNotes) {
        await prisma.hdzMemory.update({
          where: { id: existingNotes.id },
          data: { content: { notes: directorNotes, overallAdvice: parsed?.overallAdvice || '', generatedAt: new Date().toISOString() } },
        })
      } else {
        await prisma.hdzMemory.create({
          data: {
            projectId: ctx.projectId,
            type: 'director_notes',
            content: { notes: directorNotes, overallAdvice: parsed?.overallAdvice || '', generatedAt: new Date().toISOString() },
          },
        })
      }
    }

    const message = directorNotes.length > 0
      ? `成功生成 ${directorNotes.length} 章写作指导${hookSuggestions.length > 0 ? `，${hookSuggestions.length} 个伏笔/悬念建议` : ''}`
      : 'Director Agent 完成分析，但未生成具体指导'

    console.log(`[HDZ/Director] ${message}`)

    await prisma.hdzAgentTask.update({
      where: { id: ctx.taskId },
      data: {
        output: {
          directorNotes: directorNotes.slice(0, 50), // 限制输出大小
          hookSuggestions: hookSuggestions.slice(0, 50),
          overallAdvice: parsed?.overallAdvice || '',
          message,
        },
        status: 'completed',
        completedAt: new Date(),
      },
    })

    console.log(`[HDZ/Director] Task ${ctx.taskId}: completed`)
  }
}

export const directorService = new DirectorService()
