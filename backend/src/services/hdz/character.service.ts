/**
 * services/hdz/character.service.ts — 混沌珠 Character Agent
 *
 * 职责：根据已有的大纲章节，自动生成一套完整的小说角色设定（主角、反派、关键配角）
 * - 读取项目的 chapters（所有章的大纲/正文），分析哪些角色已经出现或将被引入
 * - 阅读已有的 characters（可能已有部分手工设定）
 * - 调用 LLM 生成补充角色设定
 * - 写入 hdz_characters 表
 * - 输出：{ characters: [...], message: "..." }
 *
 * BYOK：走 callLLM，不硬编码任何 Key
 */

import { callLLM, parseLLMJson, getAgentPrompt, getLockContext } from './llm.client.js'
import type { LLMConfig, OrchestratorContext } from './llm.client.js'
import { hdzProjectRepository } from './repositories/hdz-project.repository.js'
import { hdzChapterRepository } from './repositories/hdz-chapter.repository.js'
import { hdzCharacterRepository } from './repositories/hdz-character.repository.js'
import { hdzAgentTaskRepository } from './repositories/hdz-agent-task.repository.js'

class CharacterService {
  async execute(ctx: OrchestratorContext, llmCfg: LLMConfig): Promise<void> {
    console.log(`[HDZ/Character] execute start: task=${ctx.taskId}, project=${ctx.projectId}`)
    const project = await hdzProjectRepository.findUnique({ where: { id: ctx.projectId } })
    if (!project) throw new Error('项目不存在')

    // ★ 读取所有章节大纲（含正文片段），分析角色
    const chapters = await hdzChapterRepository.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { chapterNo: 'asc' },
    })

    // ★ 读取已有的角色设定
    const existingCharacters = await hdzCharacterRepository.findMany({
      where: { projectId: ctx.projectId },
    })

    // 已有角色名称集合，用于去重
    const existingNames = new Set(existingCharacters.map(c => c.name))

    // ★ 构建章节上下文（给 LLM 分析角色用）
    const chapterContext = chapters.map(ch => {
      let text = `第${ch.chapterNo}章「${ch.title || ''}」`
      if (ch.outline) text += `\n大纲：${ch.outline.slice(0, 300)}`
      if (ch.content) text += `\n正文片段：${ch.content.slice(0, 500)}`
      return text
    }).join('\n\n---\n\n')

    // ★ 已有角色信息
    const existingCharStr = existingCharacters.length > 0
      ? existingCharacters.map(c => {
          const props = (c.properties as any) || {}
          return `- ${c.name}（角色定位: ${c.role}）${props.age ? `年龄: ${props.age}` : ''}${props.gender ? `性别: ${props.gender}` : ''}${props.personality ? `性格: ${props.personality}` : ''}${c.arc ? `角色弧: ${c.arc}` : ''}`
        }).join('\n')
      : '（暂无角色设定）'

    // ★ 读取风格锁定上下文
    const lockContext = await getLockContext(ctx.projectId)

    // ★ 获取 Agent prompt（带 fallback）
    let systemPrompt: string
    try {
      systemPrompt = await getAgentPrompt('hdz-character', {
        '$TITLE': project.title,
        '$GENRE': project.genre || '未指定',
      })
    } catch {
      // Fallback: 硬编码默认 prompt
      systemPrompt = `你是一位资深小说角色设计师，擅长从大纲和正文中提炼人物设定。你的任务是为小说「${project.title}」（类型：${project.genre || '未指定'}）设计完整的角色体系。

## 输出要求
请严格以 JSON 格式输出，结构如下：
{
  "characters": [
    {
      "name": "角色名",
      "role": "protagonist | antagonist | supporting | minor",
      "properties": {
        "age": "年龄描述",
        "gender": "性别",
        "appearance": "外貌描写",
        "personality": "性格特征描述",
        "background": "背景故事",
        "motivation": "核心动机"
      },
      "relations": [
        { "target": "关联角色名", "type": "师徒/兄弟/宿敌/恋人/朋友/君臣/同门", "description": "关系描述" }
      ],
      "arc": "角色弧线：从 X 到 Y 的转变"
    }
  ]
}

## 原则
1. 至少识别并生成 1 个主角（protagonist）、1 个反派（antagonist）、2-3 个关键配角（supporting）
2. 如果已有部分角色设定（见下），在此基础上补充，不要重复
3. 角色设定要鲜明，避免套路化
4. 角色关系要形成网络，互相交织
5. 每个角色都要有清晰的动机和弧线`
    }

    const fullSystemPrompt = systemPrompt + (lockContext ? `\n${lockContext}` : '')

    // ★ 构建用户消息
    const userMessage = ctx.userInput || `请根据以下小说的章节大纲和已有角色设定，分析并生成完整的角色体系。

【章节大纲/正文】
${chapterContext.slice(0, 8000)}

【已有角色设定】
${existingCharStr}

请生成此小说的角色设定：包含主角（protagonist）、反派（antagonist）和关键配角（supporting）。如果已有角色设定不完整，请补充完善。注意不要重复已有的角色。`

    console.log(`[HDZ/Character] sending to LLM (${llmCfg.provider}/${llmCfg.modelName})`)
    const text = await callLLM(llmCfg, fullSystemPrompt, userMessage, { maxTokens: 16384, temperature: 0.7 })

    // ★ 健壮解析 LLM 返回的 JSON
    let parsed: any
    try {
      parsed = parseLLMJson(text)
    } catch (e: any) {
      console.warn(`[HDZ/Character] JSON parsing failed, trying fallback regex: ${e.message}`)
      // 最后一搏：正则抓取 characters 数组
      const chMatch = text.match(/"characters"\s*:\s*(\[[\s\S]*?\])\s*\}/)
      if (chMatch) {
        try {
          parsed = { characters: JSON.parse(chMatch[1]) }
        } catch {}
      }
    }

    const newCharacters: any[] = parsed?.characters || []

    if (!Array.isArray(newCharacters) || newCharacters.length === 0) {
      throw new Error('Character Agent 未能生成任何角色设定，请重试')
    }

    // ★ 写入数据库（去重：不覆盖已有同名角色）
    const created: any[] = []
    for (const ch of newCharacters) {
      if (!ch.name || typeof ch.name !== 'string') continue
      const normalizedName = ch.name.trim()
      if (existingNames.has(normalizedName)) {
        console.log(`[HDZ/Character] 跳过已有角色: ${normalizedName}`)
        continue
      }

      const role = ['protagonist', 'antagonist', 'supporting', 'minor'].includes(ch.role)
        ? ch.role
        : 'supporting'

      const record = await hdzCharacterRepository.create({
        data: {
          projectId: ctx.projectId,
          name: normalizedName,
          role,
          properties: ch.properties || {},
          relations: ch.relations || [],
          arc: ch.arc || null,
        },
      })
      created.push(record)
      existingNames.add(normalizedName) // 防止同一批次内重复
    }

    const message = created.length > 0
      ? `成功生成 ${created.length} 个新角色（已跳过 ${newCharacters.length - created.length} 个重复角色）`
      : '未生成新角色（所有角色已存在）'

    console.log(`[HDZ/Character] ${message}`)

    await hdzAgentTaskRepository.update({
      where: { id: ctx.taskId },
      data: {
        output: {
          characters: created.map(c => ({
            id: c.id,
            name: c.name,
            role: c.role,
            properties: c.properties,
            relations: c.relations,
            arc: c.arc,
          })),
          message,
          totalInProject: existingCharacters.length + created.length,
        },
        status: 'completed',
        completedAt: new Date(),
      },
    })

    console.log(`[HDZ/Character] Task ${ctx.taskId}: completed`)
  }
}

export const characterService = new CharacterService()
