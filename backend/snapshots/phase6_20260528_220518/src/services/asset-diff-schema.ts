/**
 * A3-2 asset-diff-schema.ts — 字段级 Diff 定义（EXPORTED，供 C2 直接 import）
 *
 * diff 是纯函数，无 DB 访问，无副作用。
 */

// ─── 单字段 Diff ───

export type ChangeType = 'modified' | 'added' | 'removed'

export interface FieldDiff {
  field: string
  label: string
  originalValue: any
  optimizedValue: any
  changeType: ChangeType
}

// ─── 完整 Diff 结果 ───

export interface AssetDiffResult {
  versionA: number
  versionB: number
  changedFields: FieldDiff[]
  addedFields: FieldDiff[]
  removedFields: FieldDiff[]
}

// ─── Diff Engine ───

/**
 * 比较两个 JSON 对象，返回字段级 diff。
 * 纯函数，无 DB 依赖。
 */
export function diffObjects(
  objA: Record<string, any>,
  objB: Record<string, any>,
  versionA: number,
  versionB: number,
  labelMap?: Record<string, string>,
): AssetDiffResult {
  const changedFields: FieldDiff[] = []
  const addedFields: FieldDiff[] = []
  const removedFields: FieldDiff[] = []

  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)])

  for (const key of allKeys) {
    const vA = objA[key]
    const vB = objB[key]
    const label = labelMap?.[key] || key

    if (key in objA && !(key in objB)) {
      removedFields.push({
        field: key,
        label,
        originalValue: vA,
        optimizedValue: undefined,
        changeType: 'removed',
      })
    } else if (!(key in objA) && key in objB) {
      addedFields.push({
        field: key,
        label,
        originalValue: undefined,
        optimizedValue: vB,
        changeType: 'added',
      })
    } else if (JSON.stringify(vA) !== JSON.stringify(vB)) {
      changedFields.push({
        field: key,
        label,
        originalValue: vA,
        optimizedValue: vB,
        changeType: 'modified',
      })
    }
  }

  return {
    versionA,
    versionB,
    changedFields,
    addedFields,
    removedFields,
  }
}

/**
 * 单个字段的 diff 摘要（用于 version list 显示）
 */
export function summarizeDiff(diff: AssetDiffResult): string {
  const parts: string[] = []
  if (diff.changedFields.length) parts.push(`修改 ${diff.changedFields.length} 项`)
  if (diff.addedFields.length) parts.push(`新增 ${diff.addedFields.length} 项`)
  if (diff.removedFields.length) parts.push(`删除 ${diff.removedFields.length} 项`)
  return parts.join('，') || '无变化'
}
