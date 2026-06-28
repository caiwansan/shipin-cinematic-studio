/**
 * Script Source Info — 剧本来源信息
 */

export interface ScriptSourceInfo {
  /** 来源类型 */
  type: 'user_input' | 'generated' | 'imported' | 'template' | 'unknown'

  /** 原始长度（字符数） */
  originalLength: number

  /** 语言 */
  language: string

  /** 来源文件名（如果是导入） */
  fileName?: string

  /** 额外元数据 */
  metadata?: Record<string, unknown>
}
