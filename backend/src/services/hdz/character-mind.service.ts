/**
 * services/hdz/character-mind.service.ts — 人物心理状态卡（CharacterMindState）
 *
 * 掌柜 02-A Task 3 设计落地：
 * - 复用：HdzCharacterState.stateType='MENTAL' 事件流（已工作，记录心理事件）
 * - 新增：CharacterMindState 快照表（每章更新的结构化心理档案）
 * - 关系：mindState ↔ characterState 通过 characterId + projectId 关联
 * - 写入：initMindState（规则初始化）+ updateMindStateFromEvents（MENTAL 事件聚合）
 * - 读取：story-context-builder 注入 writer/文曲星上下文（角色心理档案）
 */

import { prisma } from '../../utils/index.js'

export interface MindStateInput {
  fear?: string
  desire?: string
  belief?: string
  trauma?: string
  moralBoundary?: string
  personalityDrift?: string
  summary?: string
}

/** 从角色卡 properties 规则初始化心理档案（不调 LLM，确定性） */
export function deriveInitialMindState(character: any): MindStateInput {
  const props = (character?.properties || {}) as any
  const personality = props.personality || ''
  const motivation = props.motivation || ''
  const background = props.background || ''

  const mind: MindStateInput = {}
  if (motivation) mind.desire = String(motivation).slice(0, 500)
  if (background) {
    // 背景中常见创伤关键词 → trauma 初值
    const traumaKeywords = ['失去', '背叛', '灭门', '死亡', '抛弃', '追杀', '阴影', '痛失']
    const found = traumaKeywords.filter(k => String(background).includes(k))
    if (found.length > 0) {
      mind.trauma = `背景提及：${found.join('、')}（${String(background).slice(0, 120)}）`
    }
  }
  if (personality) {
    // 性格特征 → belief 初值（如"重情重义"→"情义至上"）
    mind.belief = `性格底色：${String(personality).slice(0, 200)}`
  }
  mind.summary = `初始心理档案：${personality || '待塑造'}${motivation ? `；执念：${motivation.slice(0, 80)}` : ''}`
  return mind
}

/** 获取角色心理档案（无则自动初始化） */
export async function getMindState(projectId: string, characterId: string): Promise<any> {
  let mind = await prisma.characterMindState.findUnique({
    where: { projectId_characterId: { projectId, characterId } },
  })
  if (!mind) {
    const character = await prisma.hdzCharacter.findUnique({ where: { id: characterId } })
    if (!character) return null
    const initial = deriveInitialMindState(character)
    mind = await prisma.characterMindState.create({
      data: {
        projectId, characterId, chapterNo: 0,
        ...initial,
      },
    })
  }
  return mind
}

/** 用户手动更新心理档案（校正 AI 推导） */
export async function upsertMindState(projectId: string, characterId: string, chapterNo: number, input: MindStateInput): Promise<any> {
  return prisma.characterMindState.upsert({
    where: { projectId_characterId: { projectId, characterId } },
    create: { projectId, characterId, chapterNo, ...input },
    update: { chapterNo, ...input },
  })
}

/**
 * 每章更新：聚合该章 MENTAL 事件进心理档案
 * - summary：追加该章心理事件摘要（保留最近 5 条）
 * - personalityDrift：检测 MENTAL 事件与初始性格的冲突信号（规则关键词）
 */
export async function updateMindStateFromEvents(
  projectId: string,
  characterId: string,
  chapterNo: number,
  mentalEvents: Array<{ event: string; description?: string }>,
): Promise<any> {
  if (!mentalEvents || mentalEvents.length === 0) return null

  const mind = await getMindState(projectId, characterId)
  if (!mind) return null

  // 该章心理事件摘要
  const chapterSummary = mentalEvents
    .map(e => `第${chapterNo}章：${e.event}${e.description ? `（${String(e.description).slice(0, 60)}）` : ''}`)
    .join('；')

  // summary 滚动：保留最近 5 章
  const prevSummary = (mind.summary || '').split('\n').filter(Boolean).slice(-4)
  const newSummary = [...prevSummary, chapterSummary].join('\n')

  // 性格漂移检测：初始性格 vs 事件情绪词（规则）
  const character = await prisma.hdzCharacter.findUnique({ where: { id: characterId } })
  const personality = String((character?.properties as any)?.personality || '').toLowerCase()
  const driftSignals: string[] = []
  const cautious = /谨慎|稳重|冷静|隐忍|理智/
  const impulsive = /冲动|莽撞|暴怒|失控|疯狂/
  const text = mentalEvents.map(e => `${e.event}${e.description || ''}`).join(' ')
  if (cautious.test(personality) && impulsive.test(text)) {
    driftSignals.push(`⚠️ 谨慎底色角色出现冲动行为（第${chapterNo}章），警惕性格漂移`)
  }
  const gentle = /善良|温和|仁慈|心软/
  const cruel = /残忍|冷血|杀|复仇|无情/
  if (gentle.test(personality) && cruel.test(text)) {
    driftSignals.push(`⚠️ 善良底色角色出现冷酷行为（第${chapterNo}章），警惕黑化漂移`)
  }
  const drift = driftSignals.length > 0 ? driftSignals.join('\n') : mind.personalityDrift || null

  return prisma.characterMindState.update({
    where: { id: mind.id },
    data: { chapterNo, summary: newSummary, personalityDrift: drift },
  })
}

/** 格式化心理档案供 LLM 上下文（writer/文曲星读取） */
export function formatMindStateForLLM(mind: any): string {
  if (!mind) return '（无心理档案）'
  const parts: string[] = []
  if (mind.desire) parts.push(`欲望/执念：${mind.desire}`)
  if (mind.fear) parts.push(`恐惧：${mind.fear}`)
  if (mind.belief) parts.push(`信念：${mind.belief}`)
  if (mind.trauma) parts.push(`创伤：${mind.trauma}`)
  if (mind.moralBoundary) parts.push(`道德底线：${mind.moralBoundary}`)
  if (mind.personalityDrift) parts.push(`性格漂移警告：${mind.personalityDrift}`)
  const summary = (mind.summary || '').split('\n').slice(-3).join(' ')
  if (summary) parts.push(`近期心理动态：${summary}`)
  return parts.length > 0 ? parts.join('；') : '（心理档案待塑造）'
}
