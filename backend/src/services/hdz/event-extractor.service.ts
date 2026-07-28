/**
 * services/hdz/event-extractor.service.ts — 事件提取器
 *
 * 职责：
 * - 章节生成后，自动使用 LLM 分析章节文本，提取结构化事件
 * - 将事件影响自动写入角色状态（hdz_character_states）
 * - 存储提取的事件到 story_events 表
 *
 * BYOK：走 callLLM，不硬编码任何 Key
 */

import { prisma } from '../../utils/index.js'
import { callLLM, parseLLMJson, getUserLLMConfig } from './llm.client.js'
import type { LLMConfig } from './llm.client.js'
import { createEventsBatch, type StoryEventData } from './story-event.service.js'
import {
  evolveCharacterState,
  saveStateSnapshot,
  canAffectCharacter,
  type StoryEventInput,
  type CharacterInput,
} from './character-state-evolution.service.js'

// ─── 类型定义 ───

export type ExtractedEventType =
  | 'battle'
  | 'dialogue'
  | 'revelation'
  | 'travel'
  | 'transformation'
  | 'death'
  | 'other'

export interface ExtractedImpact {
  characterId: string
  stateType: string  // HEALTH / INJURY / RELATIONSHIP / POWER / LOCATION / ITEM / MENTAL / IDENTITY
  change: string
  description: string
}

export interface ExtractedEvent {
  eventType: ExtractedEventType | string
  title: string
  description: string
  participants: string[]  // 角色 ID 列表
  impacts: ExtractedImpact[]
  location?: string
}

// ─── System Prompt ───

const EVENT_EXTRACTION_SYSTEM_PROMPT = `你是一位专业的小说剧情分析专家。请仔细阅读给定的章节文本，从中提取所有重要的剧情事件。

请严格按照以下 JSON 格式输出，不要包含 Markdown 代码块或其他文本：

{
  "events": [
    {
      "eventType": "事件类型（battle/dialogue/revelation/travel/transformation/death/other）",
      "title": "事件标题（简洁，10字以内）",
      "description": "事件详细描述（50-150字，包含事件经过和结果）",
      "participants": ["角色名1", "角色名2"],
      "impacts": [
        {
          "characterId": "角色名（与 participants 对应，后续会映射为角色ID）",
          "stateType": "影响类型（HEALTH/INJURY/RELATIONSHIP/POWER/LOCATION/ITEM/MENTAL/IDENTITY）",
          "change": "变化描述（如：受伤/恢复/突破/获得/失去/提升/下降）",
          "description": "具体影响描述"
        }
      ],
      "location": "事件发生地点（如无明确地点则为空字符串）"
    }
  ]
}

事件类型说明：
- battle：战斗、打斗、冲突对抗
- dialogue：重要对话、谈判、信息交流
- revelation：真相揭示、秘密暴露、新信息发现
- travel：移动、旅行、场景转换
- transformation：突破、进化、蜕变、实力变化
- death：角色死亡、重要人物陨落
- other：其他重要事件

提取规则：
1. 只提取对剧情有推动作用的重要事件，跳过日常描写
2. 每个事件必须包含至少一个参与者
3. impacts 要具体说明对角色状态的影响
4. 如果事件对角色没有直接影响，impacts 可以为空数组
5. 同一事件涉及多个角色时，每个角色的 impact 分别列出
6. 提取数量：每章 1-10 个事件，根据章节内容密度调整
7. 所有字段必须完整，不能为空字符串（除 location 外）
`

// ─── 服务函数 ───

/**
 * 从章节文本中提取事件
 * @param projectId 项目 ID
 * @param chapterNo 章节号
 * @param chapterText 章节正文文本
 * @returns 提取的事件列表
 */
export async function extractEventsFromChapter(
  projectId: string,
  chapterNo: number,
  chapterText: string,
): Promise<ExtractedEvent[]> {
  if (!chapterText || chapterText.trim().length < 50) {
    console.log(`[EventExtractor] 章节文本过短，跳过提取: chapter=${chapterNo}`)
    return []
  }

  const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('项目不存在')

  const userId = project.userId
  const llmCfg = await getUserLLMConfig(userId)
  if (!llmCfg) throw new Error('请先配置大模型 API Key（LLM）')

  // 获取项目角色列表（用于将角色名映射为 ID）
  const characters = await prisma.hdzCharacter.findMany({
    where: { projectId },
    select: { id: true, name: true },
  })
  const nameToIdMap = new Map<string, string>()
  for (const c of characters) {
    nameToIdMap.set(c.name, c.id)
  }

  // 构建用户消息
  const userMessage = `【第${chapterNo}章正文】\n${chapterText.slice(0, 15000)}`

  console.log(`[EventExtractor] 开始提取事件: project=${projectId}, chapter=${chapterNo}, textLen=${chapterText.length}`)

  try {
    const raw = await callLLM(llmCfg, EVENT_EXTRACTION_SYSTEM_PROMPT, userMessage, {
      maxTokens: 16384,
      temperature: 0.3,  // 低温度确保提取结果稳定
    })

    const result = parseLLMJson(raw) as { events: ExtractedEvent[] }
    if (!result.events || !Array.isArray(result.events)) {
      throw new Error('LLM 返回的事件格式不正确')
    }

    // 将角色名映射为角色 ID
    const eventsWithIds = result.events.map(event => ({
      ...event,
      participants: event.participants
        .map(name => nameToIdMap.get(name) || '')
        .filter(id => id !== ''),
      impacts: event.impacts.map(impact => ({
        ...impact,
        characterId: nameToIdMap.get(impact.characterId) || impact.characterId,
      })),
    }))

    console.log(`[EventExtractor] ✅ 提取完成: chapter=${chapterNo}, events=${eventsWithIds.length}`)
    return eventsWithIds
  } catch (err: any) {
    console.error(`[EventExtractor] ❌ 提取失败: chapter=${chapterNo}, error=${err.message}`)
    throw new Error(`事件提取失败: ${err.message}`)
  }
}

/**
 * 将事件影响自动写入角色状态
 * @param projectId 项目 ID
 * @param chapterNo 章节号
 * @param events 提取的事件列表
 */
export async function applyImpacts(
  projectId: string,
  chapterNo: number,
  events: ExtractedEvent[],
): Promise<void> {
  try {
    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project) throw new Error('项目不存在')

    // 收集所有需要写入的状态变更
    const stateChanges: {
      projectId: string
      characterId: string
      chapterNo: number
      stateType: string
      event: string
      description: string
      severity: string
      recoveryChapter: number | null
    }[] = []

    for (const event of events) {
      for (const impact of event.impacts) {
        if (!impact.characterId) continue

        // 判断严重程度
        let severity = 'normal'
        const changeLower = impact.change.toLowerCase()
        if (changeLower.includes('死') || changeLower.includes('重伤') || changeLower.includes('陨落')) {
          severity = 'critical'
        } else if (changeLower.includes('突破') || changeLower.includes('飞升') || changeLower.includes('觉醒')) {
          severity = 'high'
        } else if (changeLower.includes('轻伤') || changeLower.includes('小突破')) {
          severity = 'low'
        }

        // 计算预计恢复章节（伤势类）
        let recoveryChapter: number | null = null
        if (impact.stateType === 'INJURY') {
          if (severity === 'critical') recoveryChapter = chapterNo + 20
          else if (severity === 'high') recoveryChapter = chapterNo + 10
          else if (severity === 'normal') recoveryChapter = chapterNo + 5
          else recoveryChapter = chapterNo + 2
        }

        stateChanges.push({
          projectId,
          characterId: impact.characterId,
          chapterNo,
          stateType: impact.stateType,
          event: event.title,
          description: impact.description,
          severity,
          recoveryChapter,
        })
      }
    }

    if (stateChanges.length > 0) {
      await prisma.hdzCharacterState.createMany({
        data: stateChanges,
      })
      console.log(`[EventExtractor] ✅ 写入 ${stateChanges.length} 条角色状态: chapter=${chapterNo}`)
    }
  } catch (err: any) {
    console.error(`[EventExtractor] ❌ 写入角色状态失败: ${err.message}`)
    throw new Error(`写入角色状态失败: ${err.message}`)
  }
}

/**
 * 完整流程：提取事件 + 存储 + 应用影响
 * @param projectId 项目 ID
 * @param chapterNo 章节号
 * @param chapterText 章节正文文本
 * @returns 存储的事件列表
 */
export async function extractAndStoreEvents(
  projectId: string,
  chapterNo: number,
  chapterText: string,
): Promise<StoryEventData[]> {
  // 1. 提取事件
  const extractedEvents = await extractEventsFromChapter(projectId, chapterNo, chapterText)

  if (extractedEvents.length === 0) return []

  // 2. 转换为 StoryEventData 格式
  const eventDataList: StoryEventData[] = extractedEvents.map(event => ({
    projectId,
    chapterNo,
    eventType: event.eventType,
    title: event.title,
    description: event.description,
    participants: event.participants,
    impacts: event.impacts,
    location: event.location,
  }))

  // 3. 批量存储事件
  await createEventsBatch(projectId, eventDataList)

  // 4. 应用影响
  await applyImpacts(projectId, chapterNo, extractedEvents)

  return eventDataList
}

// ═══════════════════════════════════════════════════════════════════════════
// 集成点：processChapterEvents — 章节事件处理 + 角色状态演化
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 章节事件处理入口（供 writer.service.ts 调用）
 *
 * 流程：
 * 1. 从章节文本提取事件
 * 2. 对每个事件，使用角色状态演化引擎推演受影响角色的状态变化
 * 3. 自动写入 HdzCharacterState 表
 *
 * @param projectId 项目 ID
 * @param chapterNo 章节号
 * @param chapterText 章节正文文本
 * @param userId 用户 ID（用于获取 LLM 配置）
 * @returns 提取的事件数和产生的状态变更数
 */
export async function processChapterEvents(
  projectId: string,
  chapterNo: number,
  chapterText: string,
  userId: string,
): Promise<{ events: StoryEventData[]; statesCreated: number }> {
  // 1. 提取事件
  const extractedEvents = await extractEventsFromChapter(projectId, chapterNo, chapterText)

  if (extractedEvents.length === 0) {
    return { events: [], statesCreated: 0 }
  }

  // 2. 存储事件
  const eventDataList: StoryEventData[] = extractedEvents.map(event => ({
    projectId,
    chapterNo,
    eventType: event.eventType,
    title: event.title,
    description: event.description,
    participants: event.participants,
    impacts: event.impacts,
    location: event.location,
  }))
  await createEventsBatch(projectId, eventDataList)

  // 3. 获取项目所有角色
  const characters = await prisma.hdzCharacter.findMany({
    where: { projectId },
  })

  // 4. 构建角色输入
  const characterInputs: CharacterInput[] = characters.map(c => ({
    id: c.id,
    projectId: c.projectId,
    name: c.name,
    role: c.role,
    properties: c.properties || {},
    relations: c.relations as any[] || [],
    arc: c.arc || undefined,
  }))

  // 5. 对每个事件，使用演化引擎推演受影响角色的状态变化
  let totalStatesCreated = 0

  for (const extractedEvent of extractedEvents) {
    // 构建事件输入
    const eventInput: StoryEventInput = {
      projectId,
      chapterNo,
      eventType: extractedEvent.eventType,
      title: extractedEvent.title,
      description: extractedEvent.description,
      participants: extractedEvent.participants,
      location: extractedEvent.location,
      impacts: extractedEvent.impacts,
    }

    for (const character of characterInputs) {
      try {
        // 使用 canAffectCharacter 判断事件是否影响该角色
        if (!canAffectCharacter(eventInput, character)) {
          continue
        }

        // 使用演化引擎推演状态变化
        const changes = await evolveCharacterState(eventInput, character)

        if (Object.keys(changes).length > 0) {
          // 保存状态快照
          const savedRecords = await saveStateSnapshot(
            projectId,
            character.id,
            chapterNo,
            eventInput,
            changes,
          )
          totalStatesCreated += savedRecords.length
        }
      } catch (err: any) {
        // 单个角色推演失败不影响其他角色
        console.warn(
          `[processChapterEvents] 角色「${character.name}」推演失败: ${err.message}`,
        )
      }
    }
  }

  // 6. 同时保留原有的 applyImpacts 逻辑（兼容旧版影响写入）
  try {
    await applyImpacts(projectId, chapterNo, extractedEvents)
  } catch (err: any) {
    console.warn(`[processChapterEvents] applyImpacts 失败: ${err.message}`)
  }

  console.log(
    `[processChapterEvents] 完成: chapter=${chapterNo}, events=${eventDataList.length}, states=${totalStatesCreated}`,
  )

  return { events: eventDataList, statesCreated: totalStatesCreated }
}
