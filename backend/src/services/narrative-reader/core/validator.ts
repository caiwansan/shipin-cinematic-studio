/**
 * validator.ts — JSON Guard Pre-validator
 *
 * 在数据进入 EventLog 之前做快速校验。
 * 校验后的数据保证符合 Y.1 v0.1 schema。
 *
 * Schema（降级版）:
 * {
 *   "entities": [{ "name": string, "type": string, "weight": number }],
 *   "events": [{ "text": string, "actors": string[] }]
 * }
 */

export interface Y1ValidationResult {
  valid: boolean
  data: any | null
  errors: string[]
}

const VALID_TYPES = new Set(['person', 'place', 'object', 'organization', 'concept'])

/**
 * 校验 Y.1 JSON 输出是否符合 schema
 * 宽松模式：允许额外字段，只检查必要字段的存在和类型
 */
export function validateNarrativeJSON(input: any): Y1ValidationResult {
  const errors: string[] = []

  if (!input || typeof input !== 'object') {
    return { valid: false, data: null, errors: ['input must be a JSON object'] }
  }

  // --- entities ---
  if (!Array.isArray(input.entities)) {
    errors.push('entities must be an array')
  } else {
    for (let i = 0; i < input.entities.length; i++) {
      const e = input.entities[i]
      if (!e.name || typeof e.name !== 'string') {
        errors.push(`entities[${i}]: missing or invalid name`)
      }
      if (e.type && !VALID_TYPES.has(e.type)) {
        // 非标准 type 直接转成 "person"（默认）
        e.type = 'person'
      }
      if (e.weight !== undefined) {
        const w = Number(e.weight)
        if (isNaN(w) || w < 0 || w > 1) {
          e.weight = 0.5  // fallback
        } else {
          e.weight = w
        }
      } else {
        e.weight = 0.5
      }
    }
  }

  // --- events ---
  if (!Array.isArray(input.events)) {
    errors.push('events must be an array')
  } else {
    for (let i = 0; i < input.events.length; i++) {
      const ev = input.events[i]
      if (!ev.text || typeof ev.text !== 'string') {
        errors.push(`events[${i}]: missing or invalid text`)
      }
      if (ev.actors && !Array.isArray(ev.actors)) {
        errors.push(`events[${i}]: actors must be an array`)
      }
      if (!ev.actors) {
        ev.actors = []
      }
    }
  }

  // --- 恢复缺失字段 ---
  if (!input.entities) input.entities = []
  if (!input.events) input.events = []

  return {
    valid: errors.length === 0,
    data: input,
    errors,
  }
}
