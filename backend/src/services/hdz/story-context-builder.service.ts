/**
 * services/hdz/story-context-builder.service.ts
 *
 * HDZ-NOVEL-INTELLIGENCE-01: 小说故事上下文构建器
 *
 * 为 Writer Agent 注入：
 * 1. Master Plan（小说总体规划）
 * 2. Current Volume Planning（当前卷规划）
 * 3. Character Current State（角色当前动态状态）
 * 4. World State（世界状态快照）
 * 5. PhaseX Entity Contract
 *
 * 架构：
 *   Writer Agent
 *     ├── StoryContextBuilder（本服务）
 *     │     ├── Master Plan
 *     │     ├── Character State Timeline → CurrentCharacterProfile
 *     │     ├── World State
 *     │     └── PhaseX Entity Registry
 *     └── LLM
 */

import { prisma } from '../../utils/index.js'

export interface StoryContext {
  masterPlan: MasterPlanContext | null
  currentVolume: VolumeContext | null
  currentChapter: ChapterContext | null
  characters: CharacterCurrentProfile[]
  worldState: WorldStateContext | null
  consistencyWarnings: string[]
  currentChapterNo?: number
}

export interface MasterPlanContext {
  title: string
  genre: string
  totalChapter: number
  volumeCount: number
  targetWords: number
  worldDirection: string
  endingDirection: string
  forbiddenRules: string[]
  foreshadowing: Array<{ chapter: number; event: string; payoff: string }>
  volumes: Array<any>
}

export interface VolumeContext {
  volume: number
  chapterRange: string
  theme: string
  mainConflict: string
  characterGrowth: string
  keyEvents: string[]
}

export interface ChapterContext {
  chapterNo: number
  title: string
  outline: string
}

export interface CharacterCurrentProfile {
  id: string
  name: string
  role: string
  age?: string
  gender?: string
  appearance?: string
  personality?: string
  background?: string
  motivation?: string
  arc?: string
  relations: Array<{ target: string; type: string; description: string }>
  currentState: CharacterStateSummary
  restrictions: string[]  // 禁止行为
  mindState?: any        // 心理档案快照（CharacterMindState，Task 3）
}

export interface CharacterStateSummary {
  health: string[]
  injuries: string[]
  relationships: string[]
  power: string[]
  location: string
  items: string[]
  mental: string[]
  identity: string[]
}

export interface WorldStateContext {
  worldState: Record<string, any>[]
  locationStates: Record<string, any>[]
  timeline: Record<string, any>[]
  pendingHooks: Record<string, any>[]
}

/**
 * 构建完整 Story Context（供 Writer Agent 注入）
 */
export async function buildStoryContext(
  projectId: string,
  chapterNo: number
): Promise<StoryContext> {
  const project = await prisma.hdzProject.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new Error('项目不存在')
  }

  // 1. Master Plan
  const masterPlan = extractMasterPlan(project.masterPlan as any)

  // 2. 当前卷规划
  const currentVolume = extractCurrentVolume(masterPlan, chapterNo)

  // 3. 当前章节
  const chapter = await prisma.hdzChapter.findUnique({
    where: { projectId_chapterNo: { projectId, chapterNo } },
  })
  const currentChapter: ChapterContext | null = chapter
    ? { chapterNo: chapter.chapterNo, title: chapter.title || '', outline: chapter.outline || '' }
    : null

  // 4. 角色当前状态
  const characters = await buildCharacterCurrentProfiles(projectId)

  // 5. 世界状态
  const worldState = await buildWorldStateContext(projectId)

  // 6. 一致性警告
  const consistencyWarnings = await checkConsistencyViolations(projectId, chapterNo, characters)

  return {
    masterPlan,
    currentVolume,
    currentChapter,
    characters,
    worldState,
    consistencyWarnings,
    currentChapterNo: chapterNo,
  }
}

/**
 * 从 project.masterPlan JSON 提取 MasterPlanContext
 */
function extractMasterPlan(raw: any): MasterPlanContext | null {
  if (!raw || typeof raw !== 'object') return null
  return {
    title: raw.title || '',
    genre: raw.genre || '',
    totalChapter: raw.totalChapter || 0,
    volumeCount: raw.volumeCount || 0,
    targetWords: raw.targetWords || 0,
    worldDirection: raw.worldDirection || '',
    endingDirection: raw.endingDirection || '',
    forbiddenRules: Array.isArray(raw.forbiddenRules) ? raw.forbiddenRules : [],
    foreshadowing: Array.isArray(raw.foreshadowing) ? raw.foreshadowing : [],
    volumes: Array.isArray(raw.volumes) ? raw.volumes : [],
  }
}

/**
 * 提取当前卷规划
 */
function extractCurrentVolume(masterPlan: MasterPlanContext | null, chapterNo: number): VolumeContext | null {
  if (!masterPlan || !Array.isArray(masterPlan.volumes) || masterPlan.volumes.length === 0) return null

  const volume = masterPlan.volumes.find((v: any) => {
    if (!v.chapterRange) return false
    const [start, end] = v.chapterRange.split('-').map((s: string) => parseInt(s.trim(), 10))
    return chapterNo >= start && chapterNo <= end
  })

  if (!volume) return null

  return {
    volume: volume.volume || 0,
    chapterRange: volume.chapterRange || '',
    theme: volume.theme || '',
    mainConflict: volume.mainConflict || '',
    characterGrowth: volume.characterGrowth || '',
    keyEvents: Array.isArray(volume.keyEvents) ? volume.keyEvents : [],
  }
}

/**
 * 构建角色当前状态档案（角色卡 + 状态时间线合并）
 */
async function buildCharacterCurrentProfiles(projectId: string): Promise<CharacterCurrentProfile[]> {
  const characters = await prisma.hdzCharacter.findMany({ where: { projectId } })
  const states = await prisma.hdzCharacterState.findMany({
    where: { projectId },
    orderBy: { chapterNo: 'asc' },
  })
  const mindStates = await prisma.characterMindState.findMany({ where: { projectId } })
  const mindMap = new Map(mindStates.map(m => [m.characterId, m]))

  return characters.map(char => {
    const charStates = states.filter(s => s.characterId === char.id)
    const props = (char.properties as any) || {}

    // 按类型收集最新状态（跳过已解决的）
    const stateSummary: CharacterStateSummary = {
      health: [],
      injuries: [],
      relationships: [],
      power: [],
      location: '',
      items: [],
      mental: [],
      identity: [],
    }

    const restrictions: string[] = []

    for (const s of charStates) {
      // Freeze Patch-02: 跳过已解决的状态
      if (s.description && s.description.includes('[已解决:')) continue

      switch (s.stateType) {
        case 'HEALTH':
          if (s.event === '恢复' || s.event === '康复') {
            // 清除伤病
            stateSummary.injuries = stateSummary.injuries.filter(i => i !== s.description)
          } else {
            stateSummary.health.push(s.description || s.event)
          }
          break
        case 'INJURY':
          stateSummary.injuries.push(`${s.event}${s.description ? `（${s.description}）` : ''}`)
          if (s.severity === 'serious' || s.severity === 'critical') {
            restrictions.push(`${s.event}，严重影响行动`)
          }
          break
        case 'RELATIONSHIP':
          stateSummary.relationships.push(`${s.event}${s.description ? `：${s.description}` : ''}`)
          break
        case 'POWER':
          stateSummary.power.push(`${s.event}${s.description ? `（${s.description}）` : ''}`)
          break
        case 'LOCATION':
          stateSummary.location = s.description || s.event
          break
        case 'ITEM':
          if (s.event === '失去' || s.event === '丢弃' || s.event === '损坏') {
            stateSummary.items = stateSummary.items.filter(i => i !== s.description)
          } else {
            stateSummary.items.push(s.description || s.event)
          }
          break
        case 'MENTAL':
          stateSummary.mental.push(`${s.event}${s.description ? `（${s.description}）` : ''}`)
          break
        case 'IDENTITY':
          stateSummary.identity.push(`${s.event}${s.description ? `（${s.description}）` : ''}`)
          break
      }
    }

    return {
      id: char.id,
      name: char.name,
      role: char.role,
      age: props.age,
      gender: props.gender,
      appearance: props.appearance,
      personality: props.personality,
      background: props.background,
      motivation: props.motivation,
      arc: char.arc,
      relations: Array.isArray(char.relations) ? (char.relations as any) : [],
      currentState: stateSummary,
      restrictions,
      mindState: mindMap.get(char.id) || null,
    }
  })
}

/**
 * 构建世界状态上下文
 */
async function buildWorldStateContext(projectId: string): Promise<WorldStateContext> {
  const memories = await prisma.hdzMemory.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
  })

  const WORLD_TYPES = ['world_state', 'location_state', 'timeline', 'pending_hooks']
  const result: WorldStateContext = {
    worldState: [],
    locationStates: [],
    timeline: [],
    pendingHooks: [],
  }

  for (const m of memories) {
    if (m.type === 'world_state') result.worldState.push(m.content as Record<string, any>)
    else if (m.type === 'location_state') result.locationStates.push(m.content as Record<string, any>)
    else if (m.type === 'timeline') result.timeline.push(m.content as Record<string, any>)
    else if (m.type === 'pending_hooks') result.pendingHooks.push(m.content as Record<string, any>)
  }

  return result
}

/**
 * 一致性检查：角色状态漂移检测
 */
async function checkConsistencyViolations(
  _projectId: string,
  _chapterNo: number,
  characters: CharacterCurrentProfile[]
): Promise<string[]> {
  const warnings: string[] = []

  for (const char of characters) {
    // 检测：有重伤但未标记限制
    const seriousInjuries = char.currentState.injuries.filter(i =>
      i.includes('断') || i.includes('重伤') || i.includes('昏迷') || i.includes('濒死')
    )
    if (seriousInjuries.length > 0 && char.restrictions.length === 0) {
      warnings.push(`⚠️ ${char.name}：有重伤记录【${seriousInjuries.join('、')}】但未标记行动限制，请确保写作中体现伤痛影响`)
    }

    // 检测：身份矛盾
    if (char.currentState.identity.length > 1) {
      const identities = char.currentState.identity
      if (identities.includes('死亡') || identities.includes('殒命')) {
        // 死亡角色不应有后续状态
        const hasPostDeathActivity = [
          ...char.currentState.power,
          ...char.currentState.relationships,
          ...char.currentState.location,
        ].some(s => s && !s.includes('死前'))
        if (hasPostDeathActivity) {
          warnings.push(`🚫 ${char.name}：已标记死亡但存在死亡后的状态更新，请修正状态时间线`)
        }
      }
    }
  }

  return warnings
}

/**
 * 将 StoryContext 格式化为 LLM 可注入的文本
 */
export function formatStoryContextForLLM(ctx: StoryContext): string {
  const parts: string[] = []

  // Master Plan
  if (ctx.masterPlan) {
    const mp = ctx.masterPlan
    const statusLabel = mp.status === 'locked' ? '🔒 已锁定（绝对遵循）' : mp.status === 'confirmed' ? '✅ 已确认（作者认可）' : '📝 草稿（作者尚未确认，需谨慎）'
    parts.push(`【📖 小说总规划（作者创作意图 — 最高优先级）】
书名：${mp.title}
类型：${mp.genre}
总篇幅：${mp.totalChapter}章 / ${mp.volumeCount}卷 / ${mp.targetWords}万字
状态：${statusLabel}
世界观方向：${mp.worldDirection || '未指定'}
结局方向：${mp.endingDirection || '未指定'}`)

    if (mp.forbiddenRules.length > 0) {
      parts.push(`\n**🚫 创作禁则（绝对不可违反）：**\n${mp.forbiddenRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`)
    }

    if (mp.foreshadowing.length > 0) {
      // Phase 5 分层裁剪：只保留与当前章相关的伏笔（已回收的省略，防止 token 膨胀）
      const nowCh = ctx.currentChapterNo || 0
      const active = mp.foreshadowing.filter((f: any) => {
        if (nowCh <= 0) return true
        // 尝试解析兑现章号（支持 "890" / "第890章" / "第890章：..."）
        const payoffStr = typeof f.payoff === 'string' ? f.payoff : ''
        const m = payoffStr.match(/(\d{1,5})/)
        const payoffCh = m ? parseInt(m[1], 10) : 0
        // 已回收（兑现章早于当前章 100+ 章）→ 省略；其余保留
        if (payoffCh > 0 && payoffCh < nowCh - 100) return false
        return true
      })
      if (active.length > 0) {
        parts.push(`\n**🔮 伏笔规划（活跃 ${active.length}/${mp.foreshadowing.length} 条）：**\n${active.slice(0, 15).map(f => `- 第${f.chapter}章：${f.event} → 兑现${f.payoff}`).join('\n')}`)
      }
    }
  }

  // 当前卷
  if (ctx.currentVolume) {
    const v = ctx.currentVolume
    parts.push(`\n【📗 当前第${v.volume}卷规划（${v.chapterRange}）】
主题：${v.theme || '未指定'}
主要冲突：${v.mainConflict || '未指定'}
角色成长线：${v.characterGrowth || '未指定'}
关键事件：${v.keyEvents.length > 0 ? v.keyEvents.join('、') : '无特殊规划'}`)
  }

  // 角色当前状态
  if (ctx.characters.length > 0) {
    parts.push('\n【👤 角色当前状态（写作必须以此为准，不能凭记忆）：】')
    for (const char of ctx.characters) {
      const stateParts: string[] = []
      const cs = char.currentState

      if (cs.health.length > 0) stateParts.push(`健康状况：${cs.health.join('、')}`)
      if (cs.injuries.length > 0) stateParts.push(`伤势：${cs.injuries.join('、')}`)
      if (cs.power.length > 0) stateParts.push(`能力/修为：${cs.power.join('、')}`)
      if (cs.location) stateParts.push(`当前位置：${cs.location}`)
      if (cs.items.length > 0) stateParts.push(`持有物品：${cs.items.join('、')}`)
      if (cs.mental.length > 0) stateParts.push(`心理状态：${cs.mental.join('、')}`)
      if (cs.identity.length > 0) stateParts.push(`身份：${cs.identity.join('、')}`)

      let charBlock = `**${char.name}**（${char.role === 'protagonist' ? '主角' : char.role === 'antagonist' ? '反派' : char.role === 'supporting' ? '配角' : '龙套'}）`
      if (char.personality) charBlock += `\n  性格：${char.personality}`
      // 心理档案（CharacterMindState，Task 3）：欲望/恐惧/信念/创伤/道德底线/漂移警告
      if (char.mindState) {
        const m = char.mindState
        const mindParts: string[] = []
        if (m.desire) mindParts.push(`欲望/执念：${m.desire}`)
        if (m.fear) mindParts.push(`恐惧：${m.fear}`)
        if (m.belief) mindParts.push(`信念：${m.belief}`)
        if (m.trauma) mindParts.push(`创伤：${m.trauma}`)
        if (m.moralBoundary) mindParts.push(`道德底线：${m.moralBoundary}`)
        if (m.personalityDrift) mindParts.push(`⚠️ 漂移警告：${m.personalityDrift}`)
        if (mindParts.length > 0) charBlock += `\n  🧠 心理档案：${mindParts.join('；')}`
      }
      if (stateParts.length > 0) charBlock += `\n  ${stateParts.join('\n  ')}`
      if (char.restrictions.length > 0) {
        charBlock += `\n  ⛔ 行为限制：${char.restrictions.join('；')}`
      }

      parts.push(charBlock)
    }
  }

  // 世界状态（world_state / location_state / timeline / pending_hooks）
  if (ctx.worldState) {
    const ws = ctx.worldState
    const wsParts: string[] = []

    const latestWorld = ws.worldState[0] as any
    if (latestWorld) {
      const worldDesc = typeof latestWorld.summary === 'string' ? latestWorld.summary
        : typeof latestWorld.content === 'string' ? latestWorld.content
        : JSON.stringify(latestWorld).slice(0, 800)
      if (worldDesc) wsParts.push(`**世界观现状：**${worldDesc}`)
    }

    if (ws.locationStates.length > 0) {
      const locLines = ws.locationStates.slice(0, 8).map((l: any) => {
        const name = l.name || l.location || l.key || '未知地点'
        const desc = typeof l.summary === 'string' ? l.summary : typeof l.description === 'string' ? l.description : ''
        return desc ? `- ${name}：${desc.slice(0, 200)}` : `- ${name}`
      })
      if (locLines.length > 0) wsParts.push(`**地点状态：**\n${locLines.join('\n')}`)
    }

    if (ws.timeline.length > 0) {
      const tlLines = ws.timeline.slice(0, 8).map((t: any) => {
        const ch = t.chapterNo || t.chapter || '?'
        const desc = typeof t.summary === 'string' ? t.summary : typeof t.content === 'string' ? t.content : ''
        return desc ? `- 第${ch}章：${desc.slice(0, 200)}` : `- 第${ch}章`
      })
      if (tlLines.length > 0) wsParts.push(`**时间线：**\n${tlLines.join('\n')}`)
    }

    if (ws.pendingHooks.length > 0) {
      const hookLines = ws.pendingHooks.slice(0, 6).map((h: any) => {
        const desc = typeof h.summary === 'string' ? h.summary : typeof h.content === 'string' ? h.content : JSON.stringify(h).slice(0, 150)
        return `- ${desc}`
      })
      if (hookLines.length > 0) wsParts.push(`**🔗 未回收伏笔（写作时不得提前泄露/遗忘）：**\n${hookLines.join('\n')}`)
    }

    if (wsParts.length > 0) {
      parts.push(`\n【🌍 世界状态（写作必须与此一致）：】\n${wsParts.join('\n')}`)
    }
  }

  // 一致性警告
  if (ctx.consistencyWarnings.length > 0) {
    parts.push(`\n【⚠️ 一致性警告 — 写作前必须注意：】\n${ctx.consistencyWarnings.join('\n')}`)
  }

  return parts.join('\n')
}

/**
 * 更新角色状态（章节生成后自动调用）
 */
export async function updateCharacterStates(
  projectId: string,
  chapterNo: number,
  stateChanges: Array<{
    characterId: string
    stateType: string
    event: string
    description?: string
    severity?: string
    recoveryChapter?: number
  }>
): Promise<void> {
  for (const change of stateChanges) {
    await prisma.hdzCharacterState.create({
      data: {
        projectId,
        characterId: change.characterId,
        chapterNo,
        stateType: change.stateType,
        event: change.event,
        description: change.description,
        severity: change.severity || 'normal',
        recoveryChapter: change.recoveryChapter,
      },
    })
  }
}
