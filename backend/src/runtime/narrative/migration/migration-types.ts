/**
 * Migration Types — NOS 迁移引擎类型定义
 * 
 * 迁移引擎负责从历史数据中补齐 Runtime 缺失的事实。
 * 不是 Seeder（一次性）。迁移可以重复、增量、标记来源。
 * 
 * 每个 Fact 必须标注 Origin，以便后续区分作者/迁移/LLM/规则来源。
 */

export type FactOrigin = 
  | 'AUTHOR'       // 用户主动创建/编辑
  | 'LIBRARIAN'    // Story Librarian 从正文提取
  | 'MIGRATION'    // Migration Engine 从历史数据补齐
  | 'RULE'         // 规则引擎推断（低置信度）
  | 'MANUAL'       // 手动录入

/**
 * 迁移记录 — 记录每次迁移的状态和范围
 */
export interface MigrationRecord {
  id: string
  projectId: string
  type: 'event' | 'relationship' | 'character' | 'world' | 'knowledge' | 'foreshadow'
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed'
  origin: FactOrigin
  migratedAt: string
  sourceDescription: string  // 迁移来源描述（"chapter_summary", "character_matrix"）
  itemCount: number
  errors: string[]
}

/**
 * 迁移引擎选项
 */
export interface MigrationOptions {
  projectId: string
  /** 只迁移指定的 Runtime 类型 */
  targetRuntimes: Array<'event' | 'relationship'>
  /** 起始章节（可选，支持增量） */
  fromChapter?: number
  /** 结束章节（可选） */
  toChapter?: number
  /** 覆盖已有事实（默认 false） */
  overwrite?: boolean
}

/**
 * 高置信度关系 — 迁移只建立这个级别的关系
 * 
 * 不推断：夫妻/朋友/师徒（这些需要正文确认）
 * 只建立：同门/同组织/同阵营（可以从 hdzCharacter 确定）
 */
export interface HighConfidenceRelation {
  characterA: string
  characterB: string
  bondType: 'same_organization' | 'same_faction' | 'known_associate'
  trustLevel: number  // 0.9 以上为高置信度
  evidence: string    // 来源描述
  chapterNo: number   // 最早出现的章节
  origin: FactOrigin
}
