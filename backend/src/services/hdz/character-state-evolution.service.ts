/**
 * services/hdz/character-state-evolution.service.ts — 角色状态自动演化引擎
 *
 * 职责：
 * - 根据剧情事件推演人物状态变化
 * - 判断事件是否影响角色（canAffectCharacter）
 * - 确定影响类型（determineImpactType）
 * - 调用 LLM 进行智能状态推演（evolveCharacterState）
 * - 保存状态快照到 HdzCharacterState 表
 * - 生成角色成长曲线数据
 *
 * BYOK：走 callLLM，不硬编码任何 Key
 */

import { prisma } from '../../utils/index.js'
import { callLLM, parseLLMJson, getUserLLMConfig } from './llm.client.js'
import type { LLMConfig } from './llm.client.js'

// ─── 类型定义 ───

/**
 * 剧情事件（可以是 StoryEvent 记录或提取的 ExtractedEvent）
 */
export interface StoryEventInput {
  id?: string
  projectId: string
  chapterNo: number
  eventType: string
  title: string
  description: string
  participants?: string[]  // 角色 ID 列表
  location?: string
  impacts?: any[]
}

/**
 * 角色信息
 */
export interface CharacterInput {
  id: string
  projectId: string
  name: string
  role: string
  properties: any
  relations?: any[]
  arc?: string
}

/**
 * 影响类型枚举（8 类）
 */
export type ImpactType =
  | 'health'       // 身体
  | 'ability'      // 能力
  | 'emotion'      // 心理
  | 'goal'         // 目标
  | 'relationship' // 关系
  | 'allegiance'   // 阵营
  | 'location'     // 位置
  | 'equipment'    // 装备

/**
 * 状态变化输出
 */
export interface StateChange {
  health?: { old: string; new: string }
  ability?: { old: string; new: string }
  emotion?: { old: string; new: string }
  goal?: { old: string; new: string }
  relationship?: Array<{ target: string; change: string }>
  allegiance?: { old: string; new: string }
  location?: { old: string; new: string }
  equipment?: { old: string; new: string }
  [key: string]: any
}

/**
 * 角色状态快照（用于时间轴）
 */
export interface CharacterStateSnapshot {
  id: string
  chapterNo: number
  stateType: string
  event: string
  description: string | null
  severity: string
  recoveryChapter: number | null
  createdAt: Date
}

/**
 * 成长曲线数据点
 */
export interface GrowthCurvePoint {
  chapterNo: number
  stateType: string
  stateValue: string
  event: string
}

// ─── 影响类型映射（ImpactType → HdzCharacterState.stateType） ───

const IMPACT_TO_STATE_TYPE: Record<ImpactType, string> = {
  health: 'HEALTH',
  ability: 'POWER',
  emotion: 'MENTAL',
  goal: 'IDENTITY',
  relationship: 'RELATIONSHIP',
  allegiance: 'IDENTITY',
  location: 'LOCATION',
  equipment: 'ITEM',
}

/**
 * 将影响类型映射为 HdzCharacterState 的 stateType
 */
function mapImpactToStateType(impactType: ImpactType): string {
  return IMPACT_TO_STATE_TYPE[impactType] || 'IDENTITY'
}

// ─── System Prompt ───

const EVOLUTION_SYSTEM_PROMPT = `你是一位资深小说角色分析师，擅长根据剧情事件推演角色状态的动态变化。

你的任务是：给定一个剧情事件和角色的当前状态，判断该事件对角色产生了哪些影响。

## 影响类型限定（只能从以下 8 类中选择）

1. **health（身体）**：身体健康状况、伤势、体力变化
2. **ability（能力）**：实力、技能、修为、战斗力变化
3. **emotion（心理）**：情绪、心态、精神状态变化
4. **goal（目标）**：人生目标、短期目的、追求变化
5. **relationship（关系）**：与其他角色的关系变化
6. **allegiance（阵营）**：所属势力、立场、派系变化
7. **location（位置）**：所在地点、位置移动
8. **equipment（装备）**：法宝、武器、道具的获得或失去

## 输出格式

请严格以 JSON 格式输出，不要包含 Markdown 代码块或其他文本：

\`\`\`json
{
  "affected": true,
  "changes": {
    "health": {"old": "健康", "new": "重伤"},
    "emotion": {"old": "坚定", "new": "怀疑"},
    "goal": {"old": "寻找神器", "new": "调查师父死因"},
    "relationship": [{"target": "师父", "change": "信任下降，产生怀疑"}],
    "ability": {"old": "筑基期", "new": "金丹期"},
    "location": {"old": "青云山", "new": "幽冥谷"},
    "equipment": {"old": "铁剑", "new": "灵剑·霜寒"},
    "allegiance": {"old": "正道联盟", "new": "独自行动"}
  },
  "reasoning": "推演理由（100字以内，说明为什么事件导致这些变化）"
}
\`\`\`

## 推演规则

1. **只输出实际发生变化的维度**：如果事件不影响某个维度，不要包含该维度
2. **old 和 new 必须有实质区别**：不能 old 和 new 完全相同
3. **relationship 是数组**：可能同时影响多个角色关系
4. **描述要具体**：避免"略有提升"这种模糊描述，要写清楚具体变化
5. **符合角色设定**：变化要符合角色的性格、背景和当前处境
6. **符合事件逻辑**：变化必须能从事件中合理推导出来
7. **affected 为 false 时**：changes 为空对象，reasoning 说明原因

## 特别注意

- 背景描写（如"天空下雨"、"夜幕降临"）通常不影响角色
- 涉及角色亲身经历的事件才会产生影响
- 间接影响（如"听说某地发生战争"）可能影响心理或目标，但不直接影响身体
`

// ─── 核心功能 ───

/**
 * 判断事件是否影响角色
 *
 * 规则：
 * - 背景描写（如"天空下雨"）→ 不影响，跳过
 * - 涉及角色的事件（如"主角看到父亲遗物"）→ 影响
 *
 * @param event 剧情事件
 * @param character 角色信息
 * @returns 是否影响该角色
 */
export function canAffectCharacter(event: StoryEventInput, character: CharacterInput): boolean {
  // 1. 检查角色是否是事件参与者
  if (event.participants && event.participants.length > 0) {
    if (event.participants.includes(character.id)) {
      return true
    }
    // 如果 participants 包含角色名而非 ID
    if (event.participants.includes(character.name)) {
      return true
    }
  }

  // 2. 检查事件描述中是否提及角色名
  const charName = character.name
  if (event.description && event.description.includes(charName)) {
    return true
  }
  if (event.title && event.title.includes(charName)) {
    return true
  }

  // 3. 检查事件类型：某些类型的事件天然影响所有角色（如世界事件）
  const globalEventTypes = ['world_change', 'cataclysm', 'era_shift']
  if (globalEventTypes.includes(event.eventType.toLowerCase())) {
    return true
  }

  // 4. 检查角色关系网：如果事件参与者和角色有关系，可能间接受影响
  if (event.participants && event.participants.length > 0 && character.relations) {
    for (const relation of character.relations) {
      if (relation.target && event.participants.includes(relation.target)) {
        // 关系密切的配角会受间接影响
        if (['师徒', '兄弟', '恋人', '父子', '挚友'].includes(relation.type)) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * 确定事件对角色的影响类型
 *
 * @param event 剧情事件
 * @param character 角色信息
 * @returns 影响类型（8 类之一）
 */
export function determineImpactType(event: StoryEventInput, character: CharacterInput): ImpactType {
  const eventType = event.eventType.toLowerCase()
  const desc = (event.description || '').toLowerCase()
  const title = (event.title || '').toLowerCase()

  // 战斗类事件 → 主要影响身体和能力
  if (eventType === 'battle' || eventType === 'fight' || eventType === 'conflict') {
    if (desc.includes('突破') || desc.includes('晋升') || desc.includes('觉醒') || desc.includes('进化')) {
      return 'ability'
    }
    if (desc.includes('死') || desc.includes('伤') || desc.includes('损')) {
      return 'health'
    }
    return 'health'  // 战斗默认影响身体
  }

  // 对话类事件 → 主要影响心理和关系
  if (eventType === 'dialogue' || eventType === 'negotiation') {
    if (desc.includes('决裂') || desc.includes('背叛') || desc.includes('反目')) {
      return 'relationship'
    }
    return 'emotion'
  }

  // 揭示类事件 → 主要影响心理和目标
  if (eventType === 'revelation' || eventType === 'discovery') {
    if (desc.includes('真相') || desc.includes('秘密') || desc.includes('身世')) {
      return 'goal'
    }
    return 'emotion'
  }

  // 移动类事件 → 主要影响位置
  if (eventType === 'travel' || eventType === 'move' || eventType === 'escape') {
    return 'location'
  }

  // 蜕变类事件 → 主要影响能力
  if (eventType === 'transformation' || eventType === 'breakthrough' || eventType === 'evolution') {
    return 'ability'
  }

  // 死亡类事件 → 影响关系（对旁观者）
  if (eventType === 'death') {
    return 'emotion'
  }

  // 装备/获得类
  if (desc.includes('获得') || desc.includes('得到') || desc.includes('拾取') || desc.includes('奖励')) {
    if (desc.includes('剑') || desc.includes('刀') || desc.includes('法宝') || desc.includes('武器') || desc.includes('装备')) {
      return 'equipment'
    }
    if (desc.includes('功法') || desc.includes('秘籍') || desc.includes('技能') || desc.includes('绝学')) {
      return 'ability'
    }
  }

  // 阵营变化
  if (desc.includes('加入') || desc.includes('脱离') || desc.includes('背叛') || desc.includes('投靠')) {
    return 'allegiance'
  }

  // 默认：根据事件描述长度判断（描述越长，越可能是复杂影响）
  if (desc.length > 100) {
    return 'emotion'
  }

  return 'emotion'
}

/**
 * 调用 LLM 推演角色状态变化
 *
 * @param llmCfg LLM 配置
 * @param event 剧情事件
 * @param character 角色信息
 * @param currentState 当前状态（各维度的最新值）
 * @returns 状态变化结果
 */
async function llmEvolveState(
  llmCfg: LLMConfig,
  event: StoryEventInput,
  character: CharacterInput,
  currentState: Record<string, any>,
): Promise<{ affected: boolean; changes: StateChange; reasoning: string }> {
  // 构建当前状态描述
  const currentStateDesc = Object.entries(currentState)
    .filter(([_, v]) => v && v !== '')
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}: ${v.map((item: any) => item.target ? `${item.target}(${item.change || item.type})` : JSON.stringify(item)).join(', ')}`
      }
      return `${k}: ${v}`
    })
    .join('\n')

  const userMessage = `【剧情事件】
标题：${event.title}
类型：${event.eventType}
描述：${event.description}
章节：第${event.chapterNo}章
${event.location ? `地点：${event.location}` : ''}

【角色信息】
姓名：${character.name}
定位：${character.role}
${character.properties?.personality ? `性格：${character.properties.personality}` : ''}
${character.properties?.background ? `背景：${character.properties.background}` : ''}
${character.properties?.motivation ? `动机：${character.properties.motivation}` : ''}

【角色当前状态】
${currentStateDesc || '（初始状态，暂无记录）'}

请分析该事件对角色状态的影响：`

  const raw = await callLLM(llmCfg, EVOLUTION_SYSTEM_PROMPT, userMessage, {
    maxTokens: 4096,
    temperature: 0.4,  // 较低温度确保推演稳定
  })

  const result = parseLLMJson(raw)

  return {
    affected: result.affected !== false,
    changes: result.changes || {},
    reasoning: result.reasoning || '',
  }
}

/**
 * 推演角色状态变化（核心入口）
 *
 * @param event 剧情事件
 * @param character 角色信息
 * @param currentState 当前状态（可选，不传则从数据库查询）
 * @returns 状态变化结果
 */
export async function evolveCharacterState(
  event: StoryEventInput,
  character: CharacterInput,
  currentState?: Record<string, any>,
): Promise<StateChange> {
  // 1. 判断事件是否影响角色
  if (!canAffectCharacter(event, character)) {
    console.log(`[CharacterEvolution] 事件「${event.title}」不影响角色「${character.name}」，跳过`)
    return {}
  }

  // 2. 获取 LLM 配置
  const project = await prisma.hdzProject.findUnique({
    where: { id: event.projectId },
    select: { userId: true },
  })
  if (!project) throw new Error('项目不存在')

  const llmCfg = await getUserLLMConfig(project.userId)
  if (!llmCfg) throw new Error('请先配置大模型 API Key（LLM）')

  // 3. 获取当前状态（如果未提供）
  let stateContext: Record<string, any> = currentState || {}
  if (!currentState || Object.keys(currentState).length === 0) {
    stateContext = await getCharacterCurrentStateContext(event.projectId, character.id)
  }

  // 4. 调用 LLM 推演
  console.log(`[CharacterEvolution] 推演开始: character=${character.name}, event=${event.title}`)
  const { affected, changes, reasoning } = await llmEvolveState(llmCfg, event, character, stateContext)

  if (!affected || Object.keys(changes).length === 0) {
    console.log(`[CharacterEvolution] 事件「${event.title}」对「${character.name}」无实质影响`)
    return {}
  }

  console.log(`[CharacterEvolution] 推演完成: character=${character.name}, changes=${Object.keys(changes).join(',')}`)
  console.log(`[CharacterEvolution] 推演理由: ${reasoning}`)

  return changes
}

/**
 * 保存角色状态快照
 *
 * @param projectId 项目 ID
 * @param characterId 角色 ID
 * @param chapterNo 章节号
 * @param event 触发事件
 * @param changes 状态变化
 * @returns 保存的状态记录
 */
export async function saveStateSnapshot(
  projectId: string,
  characterId: string,
  chapterNo: number,
  event: StoryEventInput,
  changes: StateChange,
): Promise<any[]> {
  const records: any[] = []

  for (const [changeType, changeData] of Object.entries(changes)) {
    if (changeType === 'relationship') {
      // 关系变化：每个关系目标一条记录
      if (Array.isArray(changeData)) {
        for (const rel of changeData) {
          const record = await prisma.hdzCharacterState.create({
            data: {
              projectId,
              characterId,
              chapterNo,
              stateType: mapImpactToStateType('relationship' as ImpactType),
              event: event.title,
              description: `${rel.target}: ${rel.change}`,
              severity: calculateSeverity(rel.change),
            },
          })
          records.push(record)
        }
      }
    } else {
      // 其他变化：每个维度一条记录
      const changeObj = changeData as { old: string; new: string }
      if (changeObj.old !== changeObj.new) {
        const record = await prisma.hdzCharacterState.create({
          data: {
            projectId,
            characterId,
            chapterNo,
            stateType: mapImpactToStateType(changeType as ImpactType),
            event: event.title,
            description: `${changeObj.old} → ${changeObj.new}`,
            severity: calculateSeverity(changeObj.new),
          },
        })
        records.push(record)
      }
    }
  }

  console.log(`[CharacterEvolution] 保存 ${records.length} 条状态快照: character=${characterId}, chapter=${chapterNo}`)
  return records
}

/**
 * 获取角色当前状态上下文（用于 LLM 推演）
 *
 * @param projectId 项目 ID
 * @param characterId 角色 ID
 * @returns 当前状态字典
 */
export async function getCharacterCurrentStateContext(
  projectId: string,
  characterId: string,
): Promise<Record<string, any>> {
  const states = await prisma.hdzCharacterState.findMany({
    where: { projectId, characterId },
    orderBy: [{ chapterNo: 'desc' }, { createdAt: 'desc' }],
  })

  const context: Record<string, any> = {}
  const STATE_PRIORITY = ['HEALTH', 'POWER', 'MENTAL', 'IDENTITY', 'RELATIONSHIP', 'LOCATION', 'ITEM']

  // 按类型取最新值
  for (const state of states) {
    const type = state.stateType.toLowerCase()
    if (!context[type]) {
      context[type] = state.description || state.event
    }
  }

  // 补充角色基础信息
  const character = await prisma.hdzCharacter.findUnique({
    where: { id: characterId },
  })
  if (character) {
    const props = (character.properties as any) || {}
    if (!context.personality && props.personality) context.personality = props.personality
    if (!context.background && props.background) context.background = props.background
    if (!context.motivation && props.motivation) context.motivation = props.motivation
    if (!context.relations && character.relations) context.relations = character.relations
  }

  return context
}

/**
 * 获取角色状态时间轴
 *
 * @param projectId 项目 ID
 * @param characterId 角色 ID
 * @returns 状态快照列表
 */
export async function getCharacterStateTimeline(
  projectId: string,
  characterId: string,
): Promise<CharacterStateSnapshot[]> {
  return prisma.hdzCharacterState.findMany({
    where: { projectId, characterId },
    orderBy: [{ chapterNo: 'asc' }, { createdAt: 'asc' }],
  }) as Promise<CharacterStateSnapshot[]>
}

/**
 * 生成角色成长曲线数据
 *
 * @param projectId 项目 ID
 * @param characterId 角色 ID
 * @param stateType 状态类型（可选，不传则返回所有类型）
 * @returns 成长曲线数据点列表
 */
export async function generateGrowthCurve(
  projectId: string,
  characterId: string,
  stateType?: string,
): Promise<GrowthCurvePoint[]> {
  const where: any = { projectId, characterId }
  if (stateType) {
    where.stateType = stateType.toUpperCase()
  }

  const states = await prisma.hdzCharacterState.findMany({
    where,
    orderBy: [{ chapterNo: 'asc' }, { createdAt: 'asc' }],
  })

  return states.map(s => ({
    chapterNo: s.chapterNo,
    stateType: s.stateType,
    stateValue: s.description || s.event,
    event: s.event,
  }))
}

/**
 * 批量处理事件对多个角色的影响
 *
 * @param event 剧情事件
 * @param characters 角色列表
 * @returns 各角色的状态变化
 */
export async function batchEvolveCharacters(
  event: StoryEventInput,
  characters: CharacterInput[],
): Promise<Map<string, StateChange>> {
  const results = new Map<string, StateChange>()

  for (const character of characters) {
    try {
      const changes = await evolveCharacterState(event, character)
      if (Object.keys(changes).length > 0) {
        results.set(character.id, changes)
        // 保存状态快照
        await saveStateSnapshot(event.projectId, character.id, event.chapterNo, event, changes)
      }
    } catch (err: any) {
      console.error(`[CharacterEvolution] 推演失败: character=${character.name}, error=${err.message}`)
      // 继续处理其他角色，不中断
    }
  }

  return results
}

// ─── 辅助函数 ───

/**
 * 根据变化描述计算严重程度
 */
function calculateSeverity(changeDesc: string): string {
  const desc = changeDesc.toLowerCase()
  if (desc.includes('死') || desc.includes('陨落') || desc.includes('重伤') || desc.includes('破碎')) {
    return 'critical'
  }
  if (desc.includes('突破') || desc.includes('飞升') || desc.includes('觉醒') || desc.includes('晋升')) {
    return 'high'
  }
  if (desc.includes('轻伤') || desc.includes('小') || desc.includes('微')) {
    return 'low'
  }
  return 'normal'
}

// ─── 导出单例 ───

export const characterStateEvolutionService = {
  canAffectCharacter,
  determineImpactType,
  evolveCharacterState,
  saveStateSnapshot,
  getCharacterCurrentStateContext,
  getCharacterStateTimeline,
  generateGrowthCurve,
  batchEvolveCharacters,
}
