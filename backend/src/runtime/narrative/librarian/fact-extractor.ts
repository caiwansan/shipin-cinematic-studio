/**
 * Fact Extractor — 从正文提取叙事事实（LLM 驱动）
 * 
 * 职责：给定一章正文 + 上下文，输出结构化的 ExtractedEvent[] 和 ExtractedFact[]
 * 
 * Phase 2 核心组件。
 * 由 Story Librarian 调用。
 */

import { callLLM, getUserLLMConfig, parseLLMJson } from '../../../services/hdz/llm.client.js'
import type { ExtractedEvent, ExtractedFact } from './story-librarian.js'
import { narrativeRuntime } from '../index.js'

const FACT_EXTRACTION_SYSTEM_PROMPT = `你是一位专业的叙事分析专家。你的任务是从小说章节正文中提取所有叙事事实。

输出格式：JSON 对象，包含两个数组：

1. "events": 本章发生的重要事件
2. "facts": 本章揭示的角色状态变化、关系变化、知识变化等

每个 event 的格式：
{
  "title": "事件标题（简短，如"林辰中毒"）",
  "description": "事件描述",
  "category": "事件类型（combat/political/romance/discovery/betrayal/death/ceremony/travel/dialogue/internal_conflict/world_event/other）",
  "participants": [{"characterName": "角色名", "role": "initiator/target/witness/bystander"}],
  "locationName": "发生地点（可选）",
  "consequences": ["后果描述1", "后果描述2"],
  "relatedForeshadowIds": []
}

每个 fact 的格式：
{
  "type": "事实类型（character_event/character_state/relationship/knowledge/world/foreshadow/item/organization）",
  "description": "事实描述",
  "characterName": "关联角色名（如适用）",
  "targetName": "关联对象名（如适用）",
  "value": "具体数值/状态变化",
  "evidence": "原文证据（摘录原文句子）",
  "confidence": 0.95
}

规则：
1. 只提取本章节中明确发生或揭示的事实
2. 不要推断还未发生的事件
3. 如果有角色死亡，必须创建 category 为 death 的事件
4. 如果有角色获得/失去物品，type 用 item
5. 如果有组织/势力的变化，type 用 organization
6. 每个 event 必须有至少一个 participant
7. 每个 fact 必须有 evidence 字段（摘录原文）
8. 保持 objectivity，不要加入你的解读
9. 如果本章没有重要事件，events 数组可以为空
10. 请确保 JSON 格式严格有效，不要包含 markdown 代码块`

export async function extractFactsFromChapter(
  projectId: string,
  userId: string,
  chapterNo: number,
  content: string,
  chapterTitle?: string,
  povCharacter?: string,
): Promise<[ExtractedEvent[], ExtractedFact[]]> {
  // 1. 获取 LLM 配置
  const llmCfg = await getUserLLMConfig(userId)
  if (!llmCfg) {
    console.warn(`[FactExtractor] 用户 ${userId.substring(0, 8)} 未配置 LLM，使用规则提取`)
    return ruleBasedExtraction(projectId, chapterNo, content, chapterTitle, povCharacter)
  }

  // 2. 构建上下文
  const context = await buildExtractionContext(projectId, chapterNo)

  const userMessage = `# 章节信息
项目ID: ${projectId}
章节号: ${chapterNo}
章节标题: ${chapterTitle || '无'}
POV角色: ${povCharacter || '未知'}

# 当前故事上下文
${context}

# 正文
${content.slice(0, 8000)}

请提取本章节中的所有叙事事实，以 JSON 格式输出。`

  // 3. 调用 LLM
  try {
    const raw = await callLLM(llmCfg, FACT_EXTRACTION_SYSTEM_PROMPT, userMessage, {
      maxTokens: 4096,
      temperature: 0.1,  // 低温度，保证准确性
    })

    // 4. 解析 JSON
    const parsed = parseLLMJson(raw)
    const events: ExtractedEvent[] = (parsed.events || []).map((e: any) => ({
      title: e.title || '未命名事件',
      description: e.description || '',
      category: e.category || 'other',
      participants: (e.participants || []).map((p: any) => ({
        characterName: p.characterName || '未知',
        role: p.role || 'witness',
      })),
      locationName: e.locationName,
      consequences: e.consequences || [],
      relatedForeshadowIds: e.relatedForeshadowIds || [],
    }))

    const facts: ExtractedFact[] = (parsed.facts || []).map((f: any) => ({
      type: f.type || 'character_event',
      description: f.description || '',
      characterName: f.characterName,
      targetName: f.targetName,
      value: f.value,
      evidence: f.evidence || '',
      confidence: f.confidence || 0.5,
    }))

    console.log(`[FactExtractor] ✅ LLM extracted ${events.length} events, ${facts.length} facts from Ch.${chapterNo}`)
    return [events, facts]

  } catch (err) {
    console.warn(`[FactExtractor] ⚠️ LLM extraction failed: ${(err as Error).message} — fallback to rule-based`)
    return ruleBasedExtraction(projectId, chapterNo, content, chapterTitle, povCharacter)
  }
}

/**
 * 构建提取上下文——当前 Runtime 的快照摘要
 */
async function buildExtractionContext(projectId: string, chapterNo: number): Promise<string> {
  try {
    const snapshot = await narrativeRuntime.getUnifiedSnapshot(projectId)
    const parts: string[] = []

    // 已知角色
    if (snapshot.characters.length > 0) {
      parts.push(`活跃角色: ${snapshot.characters.slice(0, 20).map((c: any) => 
        `${c.characterName}(${c.lifecycle})`
      ).join(', ')}`)
    }

    // 近期事件（前 5 章）
    const recentEvents = snapshot.events.filter((e: any) =>
      e.chapterNo >= chapterNo - 5 && e.chapterNo < chapterNo
    )
    if (recentEvents.length > 0) {
      parts.push(`近期事件: ${recentEvents.slice(-5).map((e: any) =>
        `Ch.${e.chapterNo} ${e.title}`
      ).join(', ')}`)
    }

    // 活跃伏笔
    const activeForeshadows = snapshot.foreshadows.filter((f: any) =>
      f.status === 'planted' || f.status === 'active'
    )
    if (activeForeshadows.length > 0) {
      parts.push(`未回收伏笔: ${activeForeshadows.slice(0, 5).map((f: any) =>
        f.description
      ).join(', ')}`)
    }

    return parts.join('\n') || '无上下文'
  } catch {
    return '无上下文'
  }
}

/**
 * 规则提取（fallback — 当 LLM 不可用时）
 */
function ruleBasedExtraction(
  projectId: string, chapterNo: number, content: string,
  chapterTitle?: string, povCharacter?: string
): [ExtractedEvent[], ExtractedFact[]] {
  const events: ExtractedEvent[] = []
  const facts: ExtractedFact[] = []

  // 如果设置了 POV，生成 POV 事件
  if (povCharacter) {
    events.push({
      title: `${povCharacter}的视角`,
      description: `第${chapterNo}章：${povCharacter}的视角`,
      category: 'internal_conflict',
      participants: [{ characterName: povCharacter, role: 'initiator' }],
      locationName: undefined,
      consequences: [],
      relatedForeshadowIds: [],
    })
  }

  // TODO: 后续可加更多规则（关键词匹配）
  return [events, facts]
}
