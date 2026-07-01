/**
 * services/hdz/worldbuilder.service.ts — 混沌珠 Worldbuilder Agent
 *
 * 职责：和作者对话式共创小说设定
 *
 * ⚡ KV Cache 优化策略（保留完整上下文质量）：
 * 1. system prompt 完全静态，不含任何变量 ✅
 * 2. 角色详情全量传给文曲星（保证记忆质量）
 * 3. 摘要全量传给文曲星（记忆的骨架）
 * 4. 历史对话只保留最近 10 轮（更早的已被摘要覆盖）
 * 5. [项目信息] 段落在项目标题/类型不变时完全一致
 *
 * BYOK：走 callLLM
 */

import { prisma } from '../../utils/index.js'
import { callLLM } from './llm.client.js'
import { fetchUrlContent } from './fetch-url-content.js'
import type { LLMConfig, OrchestratorContext } from './llm.client.js'

const MAX_HISTORY_TURNS = 10
const MAX_FETCH_ROUNDS = 1

// ★ system prompt 完全静态，没有任何变量
const STATIC_SYSTEM_PROMPT = `你是文曲星，一位温润如玉的文学创作顾问。

你正在协助一位小说作者进行创作前的设定工作。你的任务是帮作者构思故事设定、辅助角色创作、确定写作风格。

对话开始前，作者会提供【上下文数据包】，包含项目信息、已有角色详情、章节进度、历史对话摘要等。

你的职责：
1. 帮作者构思故事设定：聊世界观、核心冲突、故事脉络。不要一次性全给，引导作者逐步明确。
2. 辅助角色创作：帮起名字（提供多个选项）、定性格特征、外貌描写、能力手段、人物关系网。可以用"几个选项供你选择"的方式。
3. 帮助确定写作风格：根据作者描述推荐文风，或帮作者找到想要的风格方向。
4. 记录对话中敲定的设定：当作者确定某件事时，可以总结确认。
5. 不要主动生成大纲或正文，除非作者明确说"生成大纲"或"开始写"。
6. 说话有文气但不要啰嗦，每次回复简洁有重点。
7. 回复要用通顺的散文段落格式，禁止使用任何列表符号（-、*、·、1. 等），禁止加粗标记（**）。需要列举时用「第一、第二、第三」或「一是、二是、三是」的自然语言表达。

## 角色共创
你可以与作者一步步确定角色设定。当作者说"创建卡片"时，回复末尾附加 JSON 块：

===CARD_DATA_START===
{
  "batchCreate": true,
  "characters": [
    {
      "name": "角色名",
      "role": "protagonist|antagonist|supporting|minor",
      "faction": "所属宗门/势力（可选）",
      "appearance": "外貌描写",
      "personality": "性格特征",
      "backstory": "身世背景",
      "skills": "技能/能力/手段",
      "growthArc": "成长曲线：从X到Y",
      "relations": [{"target": "关联角色", "type": "关系类型", "description": "..."}]
    }
  ]
}
===CARD_DATA_END===

## 组织/宗门共创
当作者说"创建组织"时，回复末尾附加 JSON 块：

===FACTION_DATA_START===
{
  "batchCreate": true,
  "factions": [
    {
      "name": "宗门名",
      "type": "sect|kingdom|company|family|gang|military|other",
      "description": "组织介绍、历史沿革、宗旨理念",
      "leaderNames": ["领袖名"],
      "memberNames": ["成员名1", "成员名2"],
      "properties": {
        "scale": "规模", "location": "所在地域", "culture": "宗门文化、规矩、行事风格",
        "ranking": "在江湖中的排名地位", "era": "活跃时期"
      }
    }
  ]
}
===FACTION_DATA_END===

注意：对话过程中的总结用自然语言，只有批量创建时才输出 JSON 块。

## 故事大纲创作
当作者说"生成大纲"、"创建大纲"、"创建故事大纲"或"开始创作"时，回复末尾附加 JSON 块，写入各章节大纲：

===OUTLINE_DATA_START===
{
  "batchCreate": true,
  "chapters": [
    {
      "no": 1,
      "title": "章名",
      "outline": "本章详细大纲内容，包括主要场景、冲突、出场角色",
      "wordCount": 3000
    }
  ]
}
===OUTLINE_DATA_END===

注意：
- 大纲的章节编号从 1 开始连续排列
- 每章都要有标题和详细大纲描述
- 根据小说篇幅长度生成合理章节数（长篇小说建议 20-50 章）
- 大纲内容要体现起承转合、主要角色的成长线和核心冲突
- JSON 块放在回复末尾，前面仍然用自然语言向作者解释大纲思路

## 在线小说阅读
你可以请求读取线上小说内容来进行分析。当用户提供了小说链接时，使用 ===FETCH_URL=== 请求格式：

===FETCH_URL_START===
{"url": "用户提供的小说URL"}
===FETCH_URL_END===

注意：
- 只有用户在对话中主动提供了链接时才需要请求读取
- 请求时必须使用用户提供的完整 URL
- 读取到内容后，基于原文进行分析：风格特征、描写手法、句式特点、叙事节奏等
- 分析结果用自然语言反馈给作者`

class WorldbuilderService {
  async execute(ctx: OrchestratorContext, llmCfg: LLMConfig): Promise<string> {
    const project = await prisma.hdzProject.findUnique({ where: { id: ctx.projectId } })
    if (!project) throw new Error('项目不存在')

    const characters = await prisma.hdzCharacter.findMany({ where: { projectId: ctx.projectId } })
    const existingChapters = await prisma.hdzChapter.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { chapterNo: 'asc' },
      select: { chapterNo: true, title: true, outline: true, content: true },
    })

    const styleDna = await prisma.hdzStyleDna.findFirst({ where: { projectId: ctx.projectId } })
    const memories = await prisma.hdzMemory.findMany({
      where: { projectId: ctx.projectId, type: 'chat_dialogue_summary' },
      orderBy: { createdAt: 'asc' },
      select: { content: true, version: true },
    })

    // === 上下文数据包 ===
    const sections: string[] = []

    // [项目信息] — 标题/类型不变时 prefix 固定，可射中 KV cache
    sections.push(`[项目信息]
标题：${project.title || '未命名'}
类型：${project.genre || '未指定'}
风格描述：${project.styleDesc || '未设定'}
写作风格：${styleDna?.sourceText ? '已有风格参考（' + styleDna.sourceText.length + ' 字）' : '（未设定）'}
目标字数：${project.wordTarget ? project.wordTarget.toLocaleString() : '未设定'}`)

    // [已有角色] — 完整详情，保证文曲星知道每个角色的设定
    if (characters.length > 0) {
      const charLines = characters.map(c => {
        const props = (c.properties as any) || {}
        const rels = (c.relations as any[]) || []
        let s = `名称：${c.name} | 类型：${c.role}`
        if (props.faction) s += ` | 宗门：${props.faction}`
        if (props.appearance) s += `\n  外貌：${props.appearance}`
        if (props.personality) s += `\n  性格：${props.personality}`
        if (props.backstory) s += `\n  背景：${props.backstory}`
        if (props.skills) s += `\n  技能：${props.skills}`
        if (props.growthArc) s += `\n  成长：${props.growthArc}`
        if (rels.length > 0) {
          s += `\n  关系：${rels.map((r: any) => `${r.target}（${r.type}${r.description ? '：' + r.description : ''}）`).join('、')}`
        }
        return s
      })
      sections.push(`[已有角色]\n${charLines.join('\n')}`)
    }

    // [章节进度] — 精简
    if (existingChapters.length > 0) {
      const chLines = existingChapters.map(ch =>
        `第${ch.chapterNo}章「${ch.title}」${ch.content ? '（已有正文）' : '（仅大纲）'}`
      )
      sections.push(`[章节进度]\n${chLines.join('\n')}`)
    }

    // [对话历程摘要] — 完整摘要内容，替代更早的历史对话（摘要是记忆的核心）
    if (memories.length > 0) {
      const memLines = memories.map((m, i) => {
        const s = m.content as any
        return `--- 第${i + 1}段摘要（${s.msgRange || ''}）---\n${s.text || ''}`
      })
      sections.push(`[对话历程摘要]\n${memLines.join('\n\n')}`)
    }

    const contextData = sections.join('\n\n')

    // === 构建 user message ===
    let historyBlock = ''
    if (ctx.historyMessages && ctx.historyMessages.length > 1) {
      // 只保留最近 MAX_HISTORY_TURNS 轮对话
      const recent = ctx.historyMessages.slice(-(MAX_HISTORY_TURNS + 1), -1)
      if (recent.length > 0) {
        historyBlock = '[对话历史]\n' + recent.map(m =>
          m.role === 'user' ? `作者：${m.content}` : `文曲星：${m.content}`
        ).join('\n\n')
      }
    }

    const currentMsg = ctx.userInput || '你好，我准备写一部小说，想和你聊聊故事设定。'

    const userMessage = `${contextData}

${historyBlock}

[作者最新消息]
${currentMsg}`

    // 检测是否需要大 token 预算
    const cardKeywords = ['创建卡片', '建卡', 'batch', 'CARD_DATA', 'FACTION_DATA', '全部创建', '批量', '角色卡片', '宗门卡片']
    const needLargeTokens = cardKeywords.some(k =>
      currentMsg.includes(k) || ctx.historyMessages?.some(m => m.content.includes(k))
    )
    const maxTokens = needLargeTokens ? 8192 : 4096

    const text = await this.callWithFetch(ctx, llmCfg, STATIC_SYSTEM_PROMPT, userMessage, maxTokens, 0)

    // 清洗
    let cleaned = text
      .replace(/\\n/g, '\n')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/^[\s]*[-*·•][\s]+/gm, '')
      .replace(/^\s*\d+\.[\s]+/gm, '')
      .replace(/^[-*·•]{2,}\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')

    console.log(`[HDZ/Worldbuilder] userInput=${(ctx.userInput || '').slice(0, 50)}, response=${text.slice(0, 60)}...`)

    return cleaned
  }

  /**
   * 带 URL 抓取支持的 LLM 调用
   * 如果 LLM 回复中包含 ===FETCH_URL_START=== 标记，则解析 URL，抓取内容后重新调用
   */
  private async callWithFetch(
    ctx: OrchestratorContext,
    llmCfg: LLMConfig,
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
    fetchRound: number
  ): Promise<string> {
    const text = await callLLM(llmCfg, systemPrompt, userMessage, { maxTokens, temperature: 0.8 })

    // 检测是否请求抓取 URL
    const fetchMatch = text.match(/===FETCH_URL_START===\s*(\{[\s\S]*?\})\s*===FETCH_URL_END===/i)
    if (fetchMatch && fetchRound < MAX_FETCH_ROUNDS) {
      try {
        const { url } = JSON.parse(fetchMatch[1])
        if (url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
          const result = await fetchUrlContent(url)
          if (result.success) {
            // 追加抓取内容到对话中，重新调用
            const continuation = `[系统消息] 已读取小说内容，以下是原文摘要（${result.content.length} 字）${result.title ? '，标题：' + result.title : ''}：

${result.content}

请基于以上原文进行分析：风格特征、描写手法、句式特点、叙事节奏等。用自然语言反馈给作者。`

            const newUserMessage = userMessage + '\n\n' + continuation
            return this.callWithFetch(ctx, llmCfg, systemPrompt, newUserMessage, maxTokens, fetchRound + 1)
          } else {
            // 抓取失败，告诉 LLM 并让它回复用户
            const errorMsg = `[系统消息] 无法读取该 URL 的内容（${result.error || '未知错误'}）。请礼貌地告诉用户无法访问该链接，并询问是否确认链接正确。`
            const newUserMessage = userMessage + '\n\n' + errorMsg
            return this.callWithFetch(ctx, llmCfg, systemPrompt, newUserMessage, maxTokens, fetchRound + 1)
          }
        }
      } catch (e: any) {
        // JSON 解析失败，忽略标记，返回原始回复
        console.warn(`[HDZ/Worldbuilder] fetch URL parse error: ${e?.message || e}`)
      }
    }

    return text
  }
}

export const worldbuilderService = new WorldbuilderService()
