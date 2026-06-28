/**
 * FilmIR Snapshot v0.1
 * ====================
 * 代表一次完整的制作状态，封装 FilmLanguageIR + 运行上下文 + 诊断 + 决策历史。
 *
 * 价值：
 * - 回滚到任意历史状态
 * - 自动保存
 * - Undo / Redo
 * - 崩溃恢复
 * - 调试重放
 * - 与 WorkbenchSnapshot 自然衔接
 *
 * 原则：
 * - Snapshot 不可变（一旦创建，不应修改）
 * - 每个 Agent 产生一个 Snapshot
 * - Pipeline 由 Snapshot 链构成
 */

import type { FilmLanguageIR } from './film-language-ir.js'
import type { FilmIRDiagnostics } from './film-ir-diagnostics.js'
import type { FilmIRDiff } from './film-ir-diff.js'
import type { ExecutionContext } from './execution-context.js'

export type SnapshotSource = 'user-edit' | 'llm-optimize' | 'film-compiler' | 'validator' | 'director-agent' | 'camera-agent' | 'lighting-agent' | 'physics-agent' | 'storyboard-agent' | 'clone'

export interface TransformRecord {
  agent: string
  reason: string
  changes: string[]           // 变更摘要
  confidence: number          // 0-1
  timestamp: string           // ISO 8601
}

export interface FilmIRSnapshot {
  snapshotId: string           // snap_xxx
  parentSnapshotId?: string    // 来源 snapshot（用于 Undo / Redo 链）
  source: SnapshotSource

  // 三件套
  filmIR: FilmLanguageIR       // ⭐ 不可变实例
  context: Partial<ExecutionContext>  // 运行上下文（当前阶段只含 requestId / projectId 等关键字段）
  diagnostics: FilmIRDiagnostics

  // 决策历史
  transformHistory: TransformRecord[]

  // 时间
  createdAt: string            // ISO 8601
}

/** 生成 Snapshot ID */
export function generateSnapshotId(): string {
  return `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 从 FilmIR 创建 Snapshot */
export function createSnapshot(
  filmIR: FilmLanguageIR,
  overrides?: {
    parentSnapshotId?: string
    source?: SnapshotSource
    context?: Partial<ExecutionContext>
    diagnostics?: FilmIRDiagnostics
    transformHistory?: TransformRecord[]
  },
): FilmIRSnapshot {
  return {
    snapshotId: generateSnapshotId(),
    parentSnapshotId: overrides?.parentSnapshotId,
    source: overrides?.source || 'clone',
    filmIR,  // 应为已 freeze 的实例（由调用方保证）
    context: overrides?.context || {},
    diagnostics: overrides?.diagnostics || { problems: [], score: { overall: 1, byCategory: {} as any }, summary: { errors: 0, warnings: 0, infos: 0, autoFixes: 0 } },
    transformHistory: overrides?.transformHistory || [],
    createdAt: new Date().toISOString(),
  }
}

/** 创建空 Snapshot */
export function createEmptySnapshot(ir: FilmLanguageIR): FilmIRSnapshot {
  return createSnapshot(ir, { source: 'user-edit' })
}
