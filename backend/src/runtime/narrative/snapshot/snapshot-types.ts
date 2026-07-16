/**
 * Snapshot Types — NOS 快照层类型定义
 * 
 * Snapshot 是 Runtime Facts 按消费者组织的临时视图。
 * 
 * Facts are permanent. Views are temporary.
 * 
 * 每个 Builder 实现 SnapshotBuilder<T> 接口，
 * 将原始 Runtime Facts 组织成消费者需要的 Fact View。
 */

// ─── Builder 接口 ───

export interface SnapshotBuilder<T> {
  build(projectId: string, context: SnapshotContext): Promise<T>
}

export interface SnapshotContext {
  projectId: string
  chapterNo?: number
  /** 时间窗口（前 N 章） */
  windowSize?: number
  /** 聚焦角色（可选） */
  focusCharacter?: string
}

// ─── Writer Snapshot — Writer 消费的完整 Fact View ───

export interface WriterSnapshotCharacter {
  name: string
  role: string
  lifecycle: string
  statusFlags: Array<{ flag: string; value: string | number | boolean }>
  currentGoal?: string
  /** 该角色当前知道的秘密/知识 */
  knownSecrets: string[]
  /** 该角色不知道的秘密（戏剧反讽） */
  unknownSecrets: string[]
}

export interface WriterSnapshotEvent {
  id: string
  title: string
  description: string
  category: string
  chapterNo: number
  participants: Array<{ characterName: string; role: string }>
  consequences: string[]
}

export interface WriterSnapshotRelationship {
  characterA: string
  characterB: string
  bondType: string
  status: string
  trustLevel: number
  recentStages: Array<{
    type: string
    turningPoint: string
    chapterNo: number
  }>
}

export interface WriterSnapshotKnowledge {
  id: string
  description: string
  knownBy: string[]
  revealedChapterNo: number
}

export interface WriterSnapshotForeshadow {
  id: string
  description: string
  status: string
  plantedChapterNo: number
  expectedPayoffWindow?: { fromChapter: number; toChapter: number }
}

export interface WriterSnapshotInventoryItem {
  itemName: string
  itemType: string
  ownerCharacterName: string
  description: string
}

export interface WriterSnapshotOrganization {
  name: string
  type: string
  description: string
  leaderName: string
  status: string
}

export interface WriterSnapshotTimelineEntry {
  chapterNo: number
  summary: string
  linkedEventIds: string[]
  storyTime?: string
}

export interface WriterSnapshotConstraints {
  /** 三大锁定状态 */
  outlineLocked: boolean
  logicLocked: boolean
  styleLocked: boolean
  /** 风格参考 */
  styleReference?: string
}

export interface WriterSnapshotWritingContext {
  /** 当前章号 */
  currentChapterNo: number
  /** 当前章标题 */
  chapterTitle: string
  /** 当前章大纲 */
  outline: string
  /** 前 N 章摘要 */
  recentChapterSummaries: Array<{ chapterNo: number; title: string; summary: string }>
  /** 全量大纲索引（标题行） */
  fullOutlineIndex: string
  /** 字数目标 */
  wordTarget: number
}

export interface WriterSnapshot {
  characters: WriterSnapshotCharacter[]
  events: WriterSnapshotEvent[]
  timeline: WriterSnapshotTimelineEntry[]
  relationships: WriterSnapshotRelationship[]
  knowledge: WriterSnapshotKnowledge[]
  foreshadows: WriterSnapshotForeshadow[]
  inventory: WriterSnapshotInventoryItem[]
  organizations: WriterSnapshotOrganization[]
  world: string  // 全局世界观状态摘要
  constraints: WriterSnapshotConstraints
  writingContext: WriterSnapshotWritingContext
}

// ─── Planner Snapshot — Planner 消费的 Fact View ───

export interface PlannerSnapshotChapterHistory {
  chapterNo: number
  title: string
  summary: string
  outline: string
  /** 本章发生的 Runtime Events */
  keyEventIds: string[]
  /** 本章引入的角色 */
  charactersIntroduced: string[]
}

export interface PlannerSnapshotCharacterBlock {
  name: string
  role: string
  personality: string
  lifecycle: string
  /** 该角色还未完成的故事线 */
  pendingArcs: string[]
}

export interface PlannerSnapshot {
  chapterHistory: PlannerSnapshotChapterHistory[]
  characters: PlannerSnapshotCharacterBlock[]
  unconsumedForeshadows: WriterSnapshotForeshadow[]
  worldStatus: string
  constraints: WriterSnapshotConstraints
  /** 当前总计字数/目标字数 */
  wordTarget: number
  existingWordCount: number
}

// ─── Validation Snapshot — Integrity Checker 消费的 Fact View ───

export interface ValidationSnapshotTraceValidation {
  /** 角色 trace 完整性 */
  charactersWithTrace: number
  charactersWithoutTrace: number
  /** 事件 trace 完整性 */
  eventsWithTrace: number
  eventsWithoutTrace: number
  /** 关系 trace 完整性 */
  relationshipsWithTrace: number
  relationshipsWithoutTrace: number
}

export interface ValidationSnapshotCrossReference {
  /** Inventory 物品持有者查到的比例 */
  inventoryOwnerMatchRate: number
  /** Organization 首领查到的比例 */
  orgLeaderMatchRate: number
  /** Event 参与者查到的比例 */
  eventParticipantMatchRate: number
}

export interface ValidationSnapshot {
  traceValidation: ValidationSnapshotTraceValidation
  crossReference: ValidationSnapshotCrossReference
  timestamp: string
}
