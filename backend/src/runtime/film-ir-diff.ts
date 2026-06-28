/**
 * FilmIR Diff Engine v0.1
 * =======================
 * 比较两个 FilmLanguageIR 版本，输出结构化变更记录。
 *
 * 价值：
 * - Agent 决策回放
 * - 用户查看 AI 到底改了什么
 * - 自动生成变更日志
 * - 多 Agent 冲突检测
 * - 为未来的协同编辑、撤销/重做、版本比较提供统一基础
 *
 * 依赖：Immutable + UUID + parentId + Migration（均已就绪）
 */

import type { FilmLanguageIR } from './film-language-ir.js'
import type { FilmIRDiagnostics } from './film-ir-diagnostics.js'

// ─── 变更类型 ───

export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged'

export interface FilmIRFieldChange {
  field: string           // 字段路径，如 "camera.shotType"
  type: DiffType
  from?: any
  to?: any
}

export interface FilmIRArrayChange {
  field: string           // 数组字段路径，如 "characters"
  type: DiffType
  index?: number
  key?: string            // 如 character name
  from?: any
  to?: any
}

export interface FilmIRDiff {
  fromId: string          // 源 IR id
  toId: string            // 目标 IR id
  fromVersion: string     // 源版本号
  toVersion: string       // 目标版本号
  fieldChanges: FilmIRFieldChange[]
  arrayChanges: FilmIRArrayChange[]
  summary: {
    added: number
    removed: number
    modified: number
    total: number
  }
  agent?: string          // 产生变更的 Agent（可选）
  reason?: string         // 变更原因（可选）
  timestamp: string       // ISO 8601
}

// ─── 比较两个 FilmLanguageIR ───

/** 比较两个 IR 的 fieldChanges 级别 */
function diffScalar(from: any, to: any, prefix: string): FilmIRFieldChange[] {
  const changes: FilmIRFieldChange[] = []

  // 比较 from 中所有字段
  for (const key of Object.keys(from || {})) {
    const path = prefix ? `${prefix}.${key}` : key
    const fv = from?.[key]
    const tv = to?.[key]

    if (typeof fv === 'object' && typeof tv === 'object' && fv !== null && tv !== null && !Array.isArray(fv) && !Array.isArray(tv)) {
      // 递归比较嵌套对象（排除 metadata）
      if (path !== 'metadata') {
        changes.push(...diffScalar(fv, tv, path))
      }
    } else if (fv !== tv) {
      changes.push({ field: path, type: 'modified', from: fv, to: tv })
    }
  }

  // 找出 to 中有但 from 中没有的新字段
  for (const key of Object.keys(to || {})) {
    if (!(key in (from || {}))) {
      const path = prefix ? `${prefix}.${key}` : key
      if (path !== 'metadata') {
        changes.push({ field: path, type: 'added', to: to[key] })
      }
    }
  }

  return changes
}

/** 比较字符数组（如 constraints.physics） */
function diffStringArray(from: string[], to: string[], field: string): FilmIRFieldChange[] {
  const changes: FilmIRFieldChange[] = []

  // 查找删除
  for (const item of from || []) {
    if (!(to || []).includes(item)) {
      changes.push({ field, type: 'removed', from: item })
    }
  }

  // 查找新增
  for (const item of to || []) {
    if (!(from || []).includes(item)) {
      changes.push({ field, type: 'added', to: item })
    }
  }

  return changes
}

/** 比较对象数组（如 characters） */
function diffObjectArray(
  from: any[],
  to: any[],
  field: string,
  keyField: string,
): FilmIRArrayChange[] {
  const changes: FilmIRArrayChange[] = []

  const fromMap = new Map((from || []).map((item: any) => [item[keyField], item]))
  const toMap = new Map((to || []).map((item: any) => [item[keyField], item]))

  // 查找删除和修改
  for (const [key, fv] of fromMap) {
    const tv = toMap.get(key)
    if (!tv) {
      changes.push({ field, type: 'removed', key, from: fv })
    } else if (JSON.stringify(fv) !== JSON.stringify(tv)) {
      changes.push({ field, type: 'modified', key, from: fv, to: tv })
    }
  }

  // 查找新增
  for (const [key, tv] of toMap) {
    if (!fromMap.has(key)) {
      changes.push({ field, type: 'added', key, to: tv })
    }
  }

  return changes
}

/** 主入口：比较两个 IR */
export function diffFilmIR(from: Readonly<FilmLanguageIR>, to: Readonly<FilmLanguageIR>, meta?: { agent?: string; reason?: string }): FilmIRDiff {
  const fieldChanges: FilmIRFieldChange[] = []
  const arrayChanges: FilmIRArrayChange[] = []

  // 1. 比较标量字段（global, scene, camera, lighting, environment, style）
  const scalarFields = ['global', 'scene', 'camera', 'lighting', 'environment', 'style'] as const
  for (const field of scalarFields) {
    const diff = diffScalar((from as any)[field], (to as any)[field], field)
    fieldChanges.push(...diff)
  }

  // 2. 比较对象数组（characters, action）
  const objArrFields: Array<{ field: string; key: string }> = [
    { field: 'characters', key: 'name' },
    { field: 'action', key: 'type' },
  ]
  for (const { field, key } of objArrFields) {
    const diff = diffObjectArray((from as any)[field], (to as any)[field], field, key)
    arrayChanges.push(...diff)
  }

  // 3. 比较 constraints（字符串数组）
  if (from.constraints && to.constraints) {
    const constraintFields = ['continuity', 'physics', 'identity', 'spatial', 'temporal', 'cameraSafety', 'visibility'] as const
    for (const cf of constraintFields) {
      const diff = diffStringArray(
        (from.constraints as any)[cf] || [],
        (to.constraints as any)[cf] || [],
        `constraints.${cf}`,
      )
      fieldChanges.push(...diff)
    }
  }

  // 4. 比较 references（URL 数组）
  if (from.references && to.references) {
    const refFields = ['characterImages', 'sceneImages', 'propImages', 'keyframeImages'] as const
    for (const rf of refFields) {
      const diff = diffStringArray(
        (from.references as any)[rf] || [],
        (to.references as any)[rf] || [],
        `references.${rf}`,
      )
      fieldChanges.push(...diff)
    }
  }

  const added = fieldChanges.filter(c => c.type === 'added').length + arrayChanges.filter(c => c.type === 'added').length
  const removed = fieldChanges.filter(c => c.type === 'removed').length + arrayChanges.filter(c => c.type === 'removed').length
  const modified = fieldChanges.filter(c => c.type === 'modified').length + arrayChanges.filter(c => c.type === 'modified').length

  return {
    fromId: from.metadata.id,
    toId: to.metadata.id,
    fromVersion: from.metadata.version,
    toVersion: to.metadata.version,
    fieldChanges,
    arrayChanges,
    summary: { added, removed, modified, total: added + removed + modified },
    agent: meta?.agent,
    reason: meta?.reason,
    timestamp: new Date().toISOString(),
  }
}

/** 格式化 Diff 为可读文本 */
export function formatDiff(diff: FilmIRDiff): string {
  const lines: string[] = [
    `📋 FilmIR Diff: ${diff.fromId} → ${diff.toId}`,
    `   Version: ${diff.fromVersion} → ${diff.toVersion}`,
    `   Changes: +${diff.summary.added} -${diff.summary.removed} ~${diff.summary.modified}`,
    diff.agent ? `   Agent: ${diff.agent}` : '',
    diff.reason ? `   Reason: ${diff.reason}` : '',
    '',
  ]

  for (const c of diff.fieldChanges) {
    const icon = c.type === 'added' ? '🟢' : c.type === 'removed' ? '🔴' : '🟡'
    const val = c.type === 'added' ? ` → ${JSON.stringify(c.to)}` : c.type === 'removed' ? ` ← ${JSON.stringify(c.from)}` : ` ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`
    lines.push(`  ${icon} ${c.field}${val}`)
  }

  for (const c of diff.arrayChanges) {
    const icon = c.type === 'added' ? '🟢' : c.type === 'removed' ? '🔴' : '🟡'
    const keyInfo = c.key ? ` (${c.key})` : c.index !== undefined ? `[${c.index}]` : ''
    lines.push(`  ${icon} ${c.field}${keyInfo}: ${c.type}`)
  }

  return lines.filter(Boolean).join('\n')
}
