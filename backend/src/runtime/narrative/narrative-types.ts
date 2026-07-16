/**
 * NOS Runtime Types — 所有 Runtime 共享的类型定义
 * 
 * 领域隔离：仅 Novel Domain 使用
 */

// ─── 通用类型 ───

/** 追溯信息：每个 Fact 必须可追踪到来源 */
export interface TraceInfo {
  chapterNo: number
  chapterTitle?: string
  eventId?: string
  /** 证据：正文中的具体句子或段落引用 */
  evidence?: string
  provenance: 'runtime' | 'event_extraction' | 'chapter_summary' | 'planner_outline' | 'foreshadow_init'
}

/** 时间锚点（故事内时间） */
export interface StoryTime {
  /** 第几章（默认时间锚点） */
  chapterNo: number
  /** 故事内时间描述，如 "万年前" "三日后" "傍晚" */
  timeDescription?: string
  /** 相对顺序（用于跨章排序） */
  sortOrder: number
}

/** Fact 基类：所有 Runtime 的 Fact 都带有追溯和版本 */
export interface FactBase {
  id: string
  projectId: string
  trace: TraceInfo
  createdAt: string
  updatedAt: string
  /** 版本号，每次变更递增 */
  version: number
  /** fact 是否仍有效（false 表示已被后续事件覆盖/废弃） */
  active: boolean
}

// ─── Character Runtime Types ───

export type CharacterLifecycle = 'alive' | 'dead' | 'missing' | 'incapacitated' | 'unknown'

export interface CharacterStatusFlag {
  flag: string           // e.g. "poisoned", "injured_left_arm", "undercover"
  value: string | number | boolean
  trace: TraceInfo
  active: boolean
  expiredAt?: number     // 在第几章后过期
}

export interface CharacterLocation {
  locationId: string
  locationName: string
  trace: TraceInfo
}

export interface CharacterRelationshipLink {
  targetCharacterId: string
  targetName: string
  relationshipType: string     // e.g. "master_disciple", "lovers", "sworn_enemies"
  state: string                // e.g. "allied", "hostile", "neutral"
  trace: TraceInfo
}

export interface CharacterFact {
  id: string
  projectId: string
  characterId: string
  characterName: string
  /** 角色当前生命周期状态 */
  lifecycle: CharacterLifecycle
  lifecycleTrace: TraceInfo
  /** 当前位置 */
  currentLocation: CharacterLocation | null
  /** 当前状态标签 */
  statusFlags: CharacterStatusFlag[]
  /** 已知与其他角色的关系 */
  relationships: CharacterRelationshipLink[]
  /** 角色已获得/失去的能力列表 */
  abilityChanges: Array<{
    ability: string
    change: 'gained' | 'lost' | 'awakened' | 'sealed' | 'enhanced' | 'depleted'
    trace: TraceInfo
  }>
  /** 是否为主要 POV 角色 */
  isPov: boolean
  /** 角色 arc / 成长状态 */
  currentArcStage: string       // e.g. "initiation", "rise", "fall", "redemption"
  version: number
  updatedAt: string
}

// ─── Event Runtime Types ───

export type EventCategory = 'combat' | 'political' | 'romance' | 'discovery' | 'betrayal' | 'death' | 'ceremony' | 'travel' | 'dialogue' | 'internal_conflict' | 'world_event' | 'other'

export interface EventFact {
  id: string
  projectId: string
  /** 事件名称（可读） */
  title: string
  /** 事件描述 */
  description: string
  category: EventCategory
  /** 发生章节 */
  chapterNo: number
  /** 故事内时间描述 */
  storyTime: StoryTime
  /** 参与角色 */
  participants: Array<{
    characterId: string
    characterName: string
    role: 'initiator' | 'target' | 'witness' | 'bystander'
  }>
  /** 发生地点 */
  locationId?: string
  locationName?: string
  /** 事件产生的后果（引用其他 Fact ID） */
  consequences: Array<{
    type: 'character_status_change' | 'relationship_change' | 'knowledge_update' | 'world_state_change' | 'foreshadow_triggered'
    factId: string
    description: string
  }>
  /** 关联伏笔 */
  foreshadowIds: string[]
  trace: TraceInfo
  active: boolean
}

// ─── Timeline Runtime Types ───

export interface TimelineEntry {
  id: string
  projectId: string
  chapterNo: number
  /** 章节标题 */
  chapterTitle: string
  /** 故事内时间 */
  storyTime: StoryTime
  /** 本时间点发生的关键事件 ID 列表 */
  eventIds: string[]
  /** 本时间点活跃的角色 ID 列表 */
  activeCharacterIds: string[]
  /** 本时间点的 POV 角色 */
  povCharacterId?: string
  /** 本时间点摘要（来自 chapter_summary memory） */
  summary: string
}

// ─── Relationship Runtime Types ───

export type BondType = 
  | 'familial' | 'romantic' | 'friendship' | 'rivalry' | 'enmity'
  | 'master_disciple' | 'colleague' | 'alliance' | 'servitude'
  | 'betrayal' | 'indebtedness' | 'admiration' | 'distrust'

export type BondStatus = 'active' | 'dormant' | 'severed' | 'transformed'

export interface RelationshipStage {
  type: BondType
  status: BondStatus
  /** 描述关系质变的事件 */
  turningPoint?: string
  turningPointChapter?: number
  trace: TraceInfo
  from: string       // ISO date
  to?: string         // ISO date, null if current
}

export interface RelationshipFact {
  id: string
  projectId: string
  /** 角色 A */
  characterAId: string
  characterAName: string
  /** 角色 B */
  characterBId: string
  characterBName: string
  /** 关系演变历史 */
  stages: RelationshipStage[]
  /** 当前状态（最新 stage 的 type） */
  currentType: BondType
  currentStatus: BondStatus
  /** 关系强度 (0-100) */
  intensity: number
  /** 权力平衡：A 对 B 的主导程度 (-100 完全 B 主导, 0 平等, +100 完全 A 主导) */
  powerBalance: number
  /** 互相信任度 (-100 完全敌对, 0 中立, +100 完全信任) */
  trustLevel: number
  trace: TraceInfo
  active: boolean
}

// ─── Knowledge Runtime Types ───

export type KnowledgeCategory = 'identity' | 'secret' | 'event' | 'plan' | 'location' | 'relationship' | 'past' | 'prophecy' | 'object'

export interface KnowledgePiece {
  id: string
  projectId: string
  /** 知识/真相的描述 */
  description: string
  category: KnowledgeCategory
  /** 知道这个知识的角色 ID 列表 */
  knownBy: string[]
  /** 不知道的角色 ID 列表（明确不知道的，用于 generating dramatic irony） */
  unknownBy: string[]
  /** 知识来源事件 ID */
  sourceEventId?: string
  /** 首次揭示章节 */
  revealedChapterNo: number
  /** 知识的准确程度（true = 准确，false = 误解/假消息） */
  isAccurate: boolean
  /** 如有误解，描述误解内容 */
  misconception?: string
  /** 谁散布了这个误解 */
  spreadByCharacterId?: string
  trace: TraceInfo
  active: boolean
}

// ─── World Runtime Types ───

export interface FactionFact {
  id: string
  projectId: string
  name: string
  type: string
  description: string
  /** 首领 */
  leaderIds: string[]
  /** 成员 */
  memberIds: string[]
  /** 当前状态 */
  currentState: 'prosperous' | 'stable' | 'declining' | 'fractured' | 'destroyed'
  /** 势力控制的范围/领地 */
  controlledLocations: string[]
  /** 敌对势力 */
  enemyFactionIds: string[]
  /** 盟友 */
  allyFactionIds: string[]
  trace: TraceInfo
}

export interface LocationFact {
  id: string
  projectId: string
  name: string
  type: string       // city, sect, fortress, wilderness, dungeon, etc.
  description: string
  /** 当前掌控势力 */
  controllingFactionId?: string
  /** 当前状态 */
  currentState: 'peaceful' | 'under_siege' | 'ruined' | 'occupied' | 'contested'
  /** 重要事件 */
  majorEvents: Array<{
    chapterNo: number
    event: string
  }>
  trace: TraceInfo
}

export interface WorldStateFact {
  id: string
  projectId: string
  /** 世界观层面的全局状态描述 */
  description: string
  /** 关键变化列表 */
  majorChanges: Array<{
    chapterNo: number
    change: string
    impact: 'minor' | 'moderate' | 'major' | 'cataclysmic'
  }>
  /** 当前时代 */
  currentEra?: string
  /** 自然法则/天道异常 */
  heavenlyAnomalies: string[]
  /** 战力天花板 */
  powerCeiling: string
  trace: TraceInfo
}

// ─── Foreshadow Runtime Types ───

export type ForeshadowStatus = 'planted' | 'active' | 'payoff_initiated' | 'paid_off' | 'abandoned'

export interface ForeshadowFact {
  id: string
  projectId: string
  /** 伏笔简述 */
  description: string
  category: string   // 'character', 'plot', 'object', 'prophecy', 'mystery'
  /** 埋下伏笔的章节 */
  plantedChapterNo: number
  /** 伏笔当前状态 */
  status: ForeshadowStatus
  /** 预期回收章节范围（可选） */
  expectedPayoffWindow?: {
    fromChapter: number
    toChapter: number
  }
  /** 实际回收章节 */
  payoffChapterNo?: number
  /** 关联角色 */
  relatedCharacterIds: string[]
  /** 关联事件 */
  relatedEventIds: string[]
  /** 超期警告（如果当前章节超过了 expectedPayoffWindow 仍未回收） */
  overdue: boolean
  trace: TraceInfo
}

// ─── Inventory Runtime Types（Phase 2 新增） ───

export type ItemState = 'owned' | 'lost' | 'broken' | 'consumed' | 'returned' | 'transferred' | 'hidden'
export type ItemType = 'weapon' | 'artifact' | 'key_item' | 'letter' | 'medicine' | 'treasure' | 'token' | 'other'

export interface ItemTransition {
  state: ItemState
  chapterNo: number
  eventId?: string
  description: string
  /** 如果转移/交换，新持有者 */
  newOwnerId?: string
  newOwnerName?: string
  trace: TraceInfo
  timestamp: string
}

export interface InventoryFact {
  id: string
  projectId: string
  /** 物品唯一标识 */
  itemName: string
  itemType: ItemType
  description: string
  /** 当前持有者 */
  ownerCharacterId: string
  ownerCharacterName: string
  /** 最初持有者 */
  originalOwnerId?: string
  originalOwnerName?: string
  /** 物品状态演化历史 */
  transitions: ItemTransition[]
  /** 当前状态（最新 transition 的 state） */
  currentState: ItemState
  /** 关联事件 */
  relatedEventIds: string[]
  /** 关联伏笔 */
  relatedForeshadowIds: string[]
  trace: TraceInfo
  active: boolean
}

// ─── Organization Runtime Types（Phase 2 新增） ───

export type OrganizationType = 'sect' | 'clan' | 'empire' | 'kingdom' | 'merchant_guild' | 'secret_society' | 'rebel_group' | 'mercenary' | 'religious'
export type OrganizationStatus = 'founding' | 'prosperous' | 'stable' | 'declining' | 'fractured' | 'destroyed' | 'dormant' | 'reforming'

export interface OrganizationStage {
  status: OrganizationStatus
  chapterNo: number
  eventId?: string
  description: string
  trace: TraceInfo
  from: string
  to?: string
}

export interface OrganizationFact {
  id: string
  projectId: string
  name: string
  type: OrganizationType
  description: string
  /** 历代首领 */
  leaderHistory: Array<{
    characterId: string
    characterName: string
    title: string       // 宗主, 掌门, 盟主...
    fromChapter: number
    toChapter?: number
  }>
  /** 核心成员 */
  memberIds: string[]
  /** 成员数量等级 */
  memberCountLevel: 'few' | 'small' | 'moderate' | 'large' | 'countless'
  /** 总部位置 */
  headquartersLocation?: string
  /** 势力范围 */
  controlledLocations: string[]
  /** 敌对其他组织 */
  enemyOrganizationIds: string[]
  /** 盟友 */
  allyOrganizationIds: string[]
  /** 附属组织 */
  subordinateOrganizationIds: string[]
  /** 发展历程 */
  stages: OrganizationStage[]
  currentStatus: OrganizationStatus
  /** 关联事件 */
  relatedEventIds: string[]
  trace: TraceInfo
  active: boolean
}

// ─── Runtime 统一接口 ───

export interface NarrativeRuntime {
  /** Runtime 名称 */
  readonly name: string
  /** 初始化 Runtime（项目创建时） */
  initialize(projectId: string): Promise<void>
  /** 获取项目所有事实快照 */
  getSnapshot(projectId: string): Promise<any>
  /** 重置项目（删除所有数据） */
  resetProject(projectId: string): Promise<void>
}
