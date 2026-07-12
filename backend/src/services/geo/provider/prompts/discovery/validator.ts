// ============================================================
// Discovery Result Validator
// RC2-T002: DeepSeek Discovery Provider
//
// Validates parsed JSON against JSON Schema + additional rules.
// ============================================================

import { resolveFilePath, getPromptSearchPaths } from './path-resolver'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

// ─── Schema definition (inline, no ajv dependency needed) ───

interface SchemaField {
  type: string
  required?: boolean
  minimum?: number
  maximum?: number
  enum?: string[]
}

interface SchemaDefinition {
  type: string
  required?: string[]
  properties?: Record<string, SchemaField | SchemaDefinition>
  items?: SchemaDefinition
  minimum?: number
  maximum?: number
}

let schemaCache: SchemaDefinition | null = null

function loadSchema(): SchemaDefinition {
  if (schemaCache) return schemaCache

  const searchDirs = getPromptSearchPaths('services/geo/provider/prompts/discovery')
  const content = resolveFilePath(
    ['schema.json'],
    searchDirs
  )

  if (content) {
    try {
      schemaCache = JSON.parse(content)
      return schemaCache!
    } catch {
      // Fall through to fallback schema
    }
  }

  // Fallback schema if file not found
  schemaCache = {
    type: 'object',
    required: ['scenarios', 'coverage', 'share', 'position'],
    properties: {
      scenarios: {
        type: 'array',
        items: {
          type: 'object',
          required: ['scenarioId', 'scenarioName', 'coverageScore', 'confidence', 'trend'],
        },
      },
    },
  }
  return schemaCache!
}

/**
 * Clear the schema cache (useful for testing).
 */
export function clearSchemaCache(): void {
  schemaCache = null
}

/**
 * Validate a parsed discovery result against the JSON schema.
 *
 * @param data - The parsed data object
 * @returns ValidationResult with errors array
 */
export function validateDiscoveryResult(data: any): ValidationResult {
  const errors: string[] = []
  const schema = loadSchema()

  // Type check: must be object
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Response must be a JSON object'] }
  }

  // Required fields
  const requiredFields = schema.required || []
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: "${field}"`)
    }
  }

  // If scenarios is missing or not an array, we can skip scenario validation
  if (!Array.isArray(data.scenarios)) {
    if (!errors.find(e => e.includes('scenarios'))) {
      errors.push('"scenarios" must be an array')
    }
  } else {
    // Validate each scenario
    const scenarioSchema = schema.properties?.scenarios as SchemaDefinition | undefined
    const scenarioItemSchema = scenarioSchema?.items

    for (let i = 0; i < data.scenarios.length; i++) {
      const s = data.scenarios[i]
      const prefix = `scenarios[${i}]`

      if (!s || typeof s !== 'object') {
        errors.push(`${prefix}: must be an object`)
        continue
      }

      // Required scenario fields
      const scenarioRequired = scenarioItemSchema?.required || ['scenarioId', 'scenarioName', 'coverageScore', 'confidence', 'trend']
      for (const field of scenarioRequired) {
        if (s[field] === undefined || s[field] === null) {
          errors.push(`${prefix}.${field}: is required`)
        }
      }

      // Validate coverageScore range (0-100)
      if (typeof s.coverageScore === 'number') {
        if (s.coverageScore < 0 || s.coverageScore > 100) {
          errors.push(`${prefix}.coverageScore: must be between 0 and 100, got ${s.coverageScore}`)
        }
      } else if (s.coverageScore !== undefined) {
        errors.push(`${prefix}.coverageScore: must be a number`)
      }

      // Validate confidence range (0-100)
      if (typeof s.confidence === 'number') {
        if (s.confidence < 0 || s.confidence > 100) {
          errors.push(`${prefix}.confidence: must be between 0 and 100, got ${s.confidence}`)
        }
      } else if (s.confidence !== undefined) {
        errors.push(`${prefix}.confidence: must be a number`)
      }

      // Validate trend enum
      if (s.trend !== undefined) {
        if (!['up', 'stable', 'down'].includes(s.trend)) {
          errors.push(`${prefix}.trend: must be one of "up", "stable", "down", got "${s.trend}"`)
        }
      }

      // Validate scenarioId type
      if (s.scenarioId !== undefined && typeof s.scenarioId !== 'string') {
        errors.push(`${prefix}.scenarioId: must be a string`)
      }

      // Validate scenarioName type
      if (s.scenarioName !== undefined && typeof s.scenarioName !== 'string') {
        errors.push(`${prefix}.scenarioName: must be a string`)
      }
    }
  }

  // Validate top-level numeric fields
  const numericFields = [
    { name: 'coverage', min: 0, max: 100 },
    { name: 'share', min: 0, max: 100 },
    { name: 'position', min: 0 },
  ]

  for (const field of numericFields) {
    const value = data[field.name]
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number') {
        errors.push(`"${field.name}": must be a number, got ${typeof value}`)
      } else if (field.min !== undefined && value < field.min) {
        errors.push(`"${field.name}": must be >= ${field.min}, got ${value}`)
      } else if (field.max !== undefined && value > field.max) {
        errors.push(`"${field.name}": must be <= ${field.max}, got ${value}`)
      }
    }
  }

  // Validate position is integer
  if (typeof data.position === 'number' && !Number.isInteger(data.position)) {
    errors.push(`"position": must be an integer, got ${data.position}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Quick check: is the parsed result structure valid for mapping?
 * (Less strict than full schema validation — allows missing optional fields)
 */
export function isMappableResult(data: any): boolean {
  if (!data || typeof data !== 'object') return false
  if (!Array.isArray(data.scenarios)) return false
  if (typeof data.coverage !== 'number') return false
  if (typeof data.share !== 'number') return false
  if (typeof data.position !== 'number') return false
  return true
}
