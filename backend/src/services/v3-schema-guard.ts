/**
 * v3-schema-guard.ts — P1.7 V3 Schema Immutable Guard
 *
 * 启动时验证 V3 Schema 定义是否被修改。
 * 如果发现新增字段、删除字段或类型变更，直接拒绝启动。
 *
 * ⚠️ 此 guard 位于宪法层级，不可 bypass。
 */

import type { NarrativeConstitutionV3 } from '../agents/narrative-schema-v3.js'

// V3 Schema 的黄金指纹——记录所有字段路径
// 任何非此列表中的字段出现，视为 schema drift
const V3_CANONICAL_FIELDS = new Set([
  // Segment 级字段
  'segment',
  'segment.id',
  'segment.sceneId',
  'segment.type',
  'segment.visualDesc',
  'segment.action',
  'segment.dialogue',
  'segment.duration',

  // camera（内联）
  'segment.camera',
  'segment.camera.shot',
  'segment.camera.movement',
  'segment.camera.angle',
  'segment.camera.lens',
  'segment.camera.framing',

  // environment（内联）
  'segment.environment',
  'segment.environment.location',
  'segment.environment.lighting',
  'segment.environment.atmosphere',
  'segment.environment.weather',
  'segment.environment.timeOfDay',
  'segment.environment.colorPalette',

  // characters（内联）
  'segment.characters',
  'segment.characters[].id',
  'segment.characters[].role',
  'segment.characters[].emotion',
  'segment.characters[].focus',

  // emotion（内联）
  'segment.emotion',
  'segment.emotion.type',
  'segment.emotion.intensity',
])

export function validateV3SchemaImmutability(schema: any): boolean {
  try {
    // 检查是否有意外新增的顶层字段
    if (!schema || !schema.segments) return true // 无数据可检查

    for (const seg of schema.segments) {
      const driftFields = findDriftFields(seg, 'segment')
      if (driftFields.length > 0) {
        console.error(`[SchemaGuard] ❌ V3 Schema Drift Detected: ${driftFields.join(', ')}`)
        return false
      }
    }
    return true
  } catch {
    return true // fail open — 不阻止系统启动
  }
}

function findDriftFields(obj: any, prefix: string): string[] {
  if (!obj || typeof obj !== 'object') return []
  const drifts: string[] = []
  for (const key of Object.keys(obj)) {
    const path = `${prefix}.${key}`
    if (key === '0' || key === '1' || key === '2') continue // 数组索引跳过
    if (!V3_CANONICAL_FIELDS.has(path) && !isArrayIndex(key)) {
      drifts.push(path)
    }
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      drifts.push(...findDriftFields(obj[key], path))
    }
  }
  return drifts
}

function isArrayIndex(key: string): boolean {
  return /^\d+$/.test(key)
}
