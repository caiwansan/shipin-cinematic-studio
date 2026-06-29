// ============================================================
// SchemaValidator — KMKI-RUNTIME-011
// 统一 Schema 校验层
// 校验 LLM 输出是否符合 Agent 期望的结构
// 不负责修复数据——校验失败直接返回 RuntimeError
// ============================================================

export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum'

export interface SchemaField {
  name: string
  type: FieldType
  required?: boolean
  enumValues?: string[]
  arrayOf?: SchemaField  // 如果是 array 类型
  fields?: SchemaField[] // 如果是 object 类型
}

export interface SchemaValidationResult {
  valid: boolean
  errors: SchemaValidationError[]
}

export interface SchemaValidationError {
  path: string
  message: string
}

/**
 * 校验 JSON 数据是否符合 Schema
 */
export function validateSchema(data: any, schema: SchemaField[]): SchemaValidationResult {
  const errors: SchemaValidationError[] = []

  for (const field of schema) {
    const value = data[field.name]

    // Required check
    if (value === undefined || value === null) {
      if (field.required !== false) {
        errors.push({ path: field.name, message: `Required field "${field.name}" is missing` })
      }
      continue
    }

    // Type check
    validateField(field.name, value, field, errors)
  }

  return { valid: errors.length === 0, errors }
}

function validateField(path: string, value: any, field: SchemaField, errors: SchemaValidationError[]): void {
  switch (field.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push({ path, message: `Expected string, got ${typeof value}` })
      }
      break

    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push({ path, message: `Expected number, got ${typeof value}` })
      }
      break

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push({ path, message: `Expected boolean, got ${typeof value}` })
      }
      break

    case 'enum':
      if (!field.enumValues) break
      // 大小写不敏感 + 下划线 normalize
      const normalizedValue = String(value).toLowerCase().replace(/[-\s]/g, '_')
      const normalizedEnums = field.enumValues.map(e => e.toLowerCase())
      if (!normalizedEnums.includes(normalizedValue)) {
        errors.push({ path, message: `Expected one of [${field.enumValues?.join(', ')}], got "${value}"` })
      }
      break

    case 'array':
      if (!Array.isArray(value)) {
        errors.push({ path, message: `Expected array, got ${typeof value}` })
      } else if (field.arrayOf) {
        value.forEach((item, i) => {
          if (typeof item === 'object' && field.arrayOf!.fields) {
            for (const subField of field.arrayOf!.fields) {
              validateField(`${path}[${i}].${subField.name}`, item[subField.name], subField, errors)
            }
          } else if (typeof item !== field.arrayOf!.type) {
            errors.push({ path: `${path}[${i}]`, message: `Expected ${field.arrayOf!.type}, got ${typeof item}` })
          }
        })
      }
      break

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        errors.push({ path, message: `Expected object, got ${typeof value}` })
      } else if (field.fields) {
        for (const subField of field.fields) {
          validateField(`${path}.${subField.name}`, value[subField.name], subField, errors)
        }
      }
      break
  }
}

/**
 * 创建 Entity 数组的 Schema（最常用场景）
 */
export function createEntityArraySchema(): SchemaField[] {
  return [
    {
      name: 'entities',
      type: 'array',
      required: true,
      arrayOf: {
        name: 'entity',
        type: 'object',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'type', type: 'enum', required: true, enumValues: ['Person', 'Organization', 'Concept', 'Product', 'Location', 'Event', 'Technology', 'Field', 'Brand'] },
          { name: 'description', type: 'string', required: true },
          { name: 'sortOrder', type: 'number', required: false },
        ],
      },
    },
    {
      name: 'relations',
      type: 'array',
      required: true,
      arrayOf: {
        name: 'relation',
        type: 'object',
        fields: [
          { name: 'sourceName', type: 'string', required: true },
          { name: 'targetName', type: 'string', required: true },
          { name: 'type', type: 'enum', required: true, enumValues: ['related_to', 'subfield_of', 'part_of', 'produced_by', 'located_in', 'competes_with', 'collaborates_with', 'used_by', 'owns', 'parent_of', 'owned_by', 'supports', 'depends_on', 'built_on', 'developed_by', 'belongs_to'] },
          { name: 'description', type: 'string', required: false },
        ],
      },
    },
  ]
}
