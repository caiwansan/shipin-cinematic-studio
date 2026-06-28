// ⭐ 自动编译自 FIELD_MAP，禁止手写规则
// 递归标准化所有层级

import { FIELD_MAP } from './registry'

// 反查表：alias → { canonical, coerce }
const ALIAS_TO_CANONICAL = new Map<string, { canonical: string; coerce?: (v: any) => any }>()

for (const [canonical, def] of Object.entries(FIELD_MAP)) {
  for (const alias of def.alias) {
    ALIAS_TO_CANONICAL.set(alias, { canonical, coerce: def.coerce })
  }
}

/**
 * ⭐ 递归字段标准化
 *   - 所有层级的字段名统一（如 scene_id → sceneKey）
 *   - 类型安全转换（如 "1" → "1" safe）
 *   - 不匹配的字段透传
 */
export function normalizeFields(raw: any): any {
  if (raw === null || raw === undefined) return raw
  if (typeof raw !== 'object') return raw

  // 数组 → 递归每个元素
  if (Array.isArray(raw)) {
    return raw.map(item => normalizeFields(item))
  }

  // 对象 → 递归所有字段
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(raw)) {
    const entry = ALIAS_TO_CANONICAL.get(key)
    if (entry) {
      const coerced = entry.coerce ? entry.coerce(value) : value
      result[entry.canonical] = normalizeFields(coerced)
    } else {
      result[key] = normalizeFields(value)
    }
  }
  return result
}

/** 统计 normalize 命中率 */
export function collectNormalizeStats(raw: any, normalized: any): NormalizeStats {
  let totalFields = 0
  let mappedFields = 0

  function count(obj: any, norm: any) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => count(item, norm?.[i]))
      return
    }
    for (const key of Object.keys(obj)) {
      totalFields++
      if (ALIAS_TO_CANONICAL.has(key)) mappedFields++
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        count(obj[key], norm?.[key])
      }
    }
  }

  count(raw, normalized)
  return {
    totalFields,
    mappedFields,
    hitRate: totalFields > 0 ? mappedFields / totalFields : 1,
  }
}

export interface NormalizeStats {
  totalFields: number
  mappedFields: number
  hitRate: number
}
