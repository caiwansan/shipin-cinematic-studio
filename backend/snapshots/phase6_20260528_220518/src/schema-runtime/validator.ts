// ⭐ schema 校验器：WARN/FAIL 双模式 + 递归 Array Item

import { AGENT_SCHEMAS, SchemaNode } from './registry'

export interface ValidateResult {
  valid: boolean
  errors: string[]
  normalized: any
}

/**
 * 校验 Agent 输出
 * @param schemaName AGENT_SCHEMAS 中的 key
 * @param data 已 normalize 后的数据
 * @param mode warn（只记录）| fail（抛出）
 */
export function validateAgentOutput(
  schemaName: string,
  data: any,
  mode: 'warn' | 'fail' = (process.env.VALIDATOR_MODE as any) || 'warn',
): ValidateResult {
  const schema = AGENT_SCHEMAS[schemaName]
  if (!schema) {
    console.warn(`[SCHEMA_RUNTIME] Unknown schema: ${schemaName}, skipping validation`)
    return { valid: true, errors: [], normalized: data }
  }

  const errors: string[] = []

  function walk(value: any, node: SchemaNode, path: string): any {
    if (value === null || value === undefined) {
      if (node.required) errors.push(`${path}: required field missing`)
      return value
    }

    const actualType = Array.isArray(value) ? 'array' : typeof value

    // array
    if (node.type === 'array' && actualType === 'array') {
      const itemDef: SchemaNode = node.itemSchema
        ? { type: 'object', fields: node.itemSchema }
        : { type: 'any' }
      return value.map((item: any, i: number) => walk(item, itemDef, `${path}[${i}]`))
    }

    // object
    if (node.type === 'object' && actualType === 'object' && node.fields) {
      const result: Record<string, any> = {}
      for (const key of Object.keys(node.fields)) {
        result[key] = walk(value[key], node.fields[key]!, `${path}.${key}`)
      }
      for (const key of Object.keys(value)) {
        if (!node.fields[key]) result[key] = value[key]
      }
      return result
    }

    // 基本类型
    if (node.type !== 'any' && node.type !== actualType) {
      errors.push(`${path}: expected ${node.type}, got ${actualType}`)
    }

    // 值域
    if (node.oneOf) {
      if (mode === 'fail' && !node.oneOf.includes(value)) {
        errors.push(`${path}: value "${value}" not in [${node.oneOf.join(', ')}]`)
      } else if (!node.oneOf.includes(value)) {
        console.warn(`[SCHEMA_WARN_VALUES] ${path}: "${value}" not in enum (WARN mode)`)
      }
    }

    return value
  }

  const normalized = walk(data, schema, '$root')

  if (errors.length > 0) {
    console.warn(`[SCHEMA_RUNTIME] ${schemaName}: ${errors.join('; ')}`)
  }

  return {
    valid: errors.length === 0 || mode === 'warn',
    errors,
    normalized,
  }
}
