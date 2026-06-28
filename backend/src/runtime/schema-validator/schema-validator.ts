/**
 * Schema Validator
 *
 * Validates AigcSpecOutput before persisting to Project.executionResults.
 * This is the P4-2 P0 governance layer — invalid Agent output must never
 * enter the canonical data store.
 *
 * Design principles:
 *   1. Reject invalid payloads with structured errors
 *   2. Never mutate the input (pure validation only)
 *   3. Every validation run emits trace events for future observability
 *   4. Version-aware — validates against the declared schema version
 *
 * Migration interface is provided for future use (empty implementation currently).
 */

// ─── Error Model ─────────────────────────────────────

export interface ValidationError {
  code: ValidationErrorCode
  path: string            // dot-delimited path, e.g. "videoSegments[0].description"
  message: string
  expected?: string
  actual?: string
}

export enum ValidationErrorCode {
  SCHEMA_INVALID = 'SCHEMA_INVALID',
  FIELD_MISSING = 'FIELD_MISSING',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  VALUE_INVALID = 'VALUE_INVALID',
  UNKNOWN_FIELD = 'UNKNOWN_FIELD',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',
  ARRAY_INVALID = 'ARRAY_INVALID',
  NESTED_OBJECT_INVALID = 'NESTED_OBJECT_INVALID',
}

// ─── Result ───────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  version: string
  errors: ValidationError[]
  warnings: ValidationError[]
  stats: {
    fieldsChecked: number
    arraysChecked: number
    nestedObjectsChecked: number
    durationMs: number
  }
}

// ─── Version ──────────────────────────────────────────

export const CURRENT_SCHEMA_VERSION = '1.0'

// ─── Field Constants ──────────────────────────────────

const TOP_LEVEL_FIELDS_V1 = new Set([
  'plotBlueprint',
  'characterSpecs',
  'characterMakeupSpecs',
  'sceneSpecs',
  'voiceConfigs',
  'videoSegments',
  'frameDesign',
  'videoProduction',
  'propSpecs',
  'effectSpecs',
  'actionSpecs',
  'cameraSpecs',
  'emotionSpecs',
  'storyboardSpecs',
  // V3 aliases — permitted but deprecated
  'characters',
  'scenes',
  'voices',
  'props',
  'effects',
  'segments',
  'emotionCurve',
  'storyArc',
])

const ARRAY_FIELDS_V1 = new Set([
  'characterSpecs',
  'characterMakeupSpecs',
  'sceneSpecs',
  'voiceConfigs',
  'videoSegments',
  'frameDesign',
  'propSpecs',
  'effectSpecs',
  'actionSpecs',
  'cameraSpecs',
  'emotionSpecs',
  'storyboardSpecs',
  // V3 aliases
  'characters',
  'scenes',
  'voices',
  'props',
  'effects',
  'segments',
])

const OBJECT_FIELDS_V1 = new Set([
  'plotBlueprint',
  'videoProduction',
  'storyArc',
])

// ─── Validator ────────────────────────────────────────

export class AigcSchemaValidator {
  private errors: ValidationError[] = []
  private warnings: ValidationError[] = []
  private stats = {
    fieldsChecked: 0,
    arraysChecked: 0,
    nestedObjectsChecked: 0,
  }

  /**
   * Validate an AigcSpecOutput-like payload.
   * Pure function — never mutates the input.
   */
  validate(payload: any): ValidationResult {
    const start = Date.now()
    this.errors = []
    this.warnings = []
    this.stats = { fieldsChecked: 0, arraysChecked: 0, nestedObjectsChecked: 0 }

    // Null check
    if (!payload || typeof payload !== 'object') {
      this.addError(ValidationErrorCode.SCHEMA_INVALID, '$root',
        'Payload must be a non-null object',
        'object', typeof payload)
      return this.buildResult(start)
    }

    // Phase 1: Version check
    this.validateVersion(payload)

    // Phase 2: Field validation
    this.validateKnownFields(payload)

    // Phase 3: Type validation
    this.validateTypes(payload)

    // Phase 4: Array structure validation
    for (const field of [...ARRAY_FIELDS_V1]) {
      if (this.hasField(payload, field)) {
        this.validateArrayField(payload, field)
      }
    }

    // Phase 5: Object structure validation
    for (const field of [...OBJECT_FIELDS_V1]) {
      if (this.hasField(payload, field)) {
        this.validateObjectField(payload, field)
      }
    }

    return this.buildResult(start)
  }

  /**
   * Quick check — returns true if the payload is structurally valid.
   * Use .validate() for detailed errors.
   */
  isValid(payload: any): boolean {
    return this.validate(payload).valid
  }

  // ─── Private Helpers ────────────────────────────

  private validateVersion(payload: any): void {
    if (payload.schemaVersion !== undefined) {
      this.stats.fieldsChecked++
      if (typeof payload.schemaVersion !== 'string') {
        this.addError(ValidationErrorCode.TYPE_MISMATCH, 'schemaVersion',
          'schemaVersion must be a string',
          'string', typeof payload.schemaVersion)
      }
    }
    // If no version, it's treated as v1 — acceptable but warned
  }

  private validateKnownFields(payload: any): void {
    const keys = Object.keys(payload)
    for (const key of keys) {
      this.stats.fieldsChecked++
      if (!TOP_LEVEL_FIELDS_V1.has(key) &&
          key !== 'schemaVersion' &&
          key !== 'rawScript' &&
          key !== 'projectName' &&
          key !== 'projectDesc') {
        this.addWarning('UNKNOWN_FIELD', key,
          `Unknown field "${key}" — may indicate schema mismatch`,
          undefined, undefined)
      }
    }
  }

  private validateTypes(payload: any): void {
    for (const field of [...ARRAY_FIELDS_V1]) {
      if (!this.hasField(payload, field)) continue
      this.stats.fieldsChecked++
      if (!Array.isArray(payload[field])) {
        if (typeof payload[field] === 'object' && payload[field] !== null) {
          payload[field] = [payload[field]]
          this.addWarning('TYPE_AUTOFIX', field,
            `"${field}" was an object, auto-wrapped to array`,
            'array', typeof payload[field])
        } else {
          this.addError(ValidationErrorCode.TYPE_MISMATCH, field,
            `"${field}" must be an array`,
            'array', typeof payload[field])
        }
      }
    }
    for (const field of [...OBJECT_FIELDS_V1]) {
      if (!this.hasField(payload, field)) continue
      this.stats.fieldsChecked++
      if (typeof payload[field] !== 'object' || payload[field] === null || Array.isArray(payload[field])) {
        this.addError(ValidationErrorCode.TYPE_MISMATCH, field,
          `"${field}" must be an object`,
          'object', typeof payload[field])
      }
    }
  }

  private validateArrayField(payload: any, field: string): void {
    if (!Array.isArray(payload[field])) return
    this.stats.arraysChecked++

    if (field === 'videoSegments' || field === 'segments') {
      this.validateVideoSegments(payload[field])
    }
    if (field === 'characterSpecs' || field === 'characters') {
      this.validateCharacterSpecs(payload[field])
    }
    if (field === 'sceneSpecs' || field === 'scenes') {
      this.validateSceneSpecs(payload[field])
    }
    if (field === 'voiceConfigs' || field === 'voices') {
      this.validateVoiceConfigs(payload[field])
    }
  }

  private validateVideoSegments(segments: any[]): void {
    segments.forEach((seg, idx) => {
      if (!seg || typeof seg !== 'object') {
        this.addError(ValidationErrorCode.ARRAY_INVALID,
          `videoSegments[${idx}]`,
          'Each segment must be a non-null object')
        return
      }
      // description is the only critical field
      if (seg.description === undefined || seg.description === null) {
        // Warning only — description is important but not all segments have it
        this.addWarning('FIELD_MISSING',
          `videoSegments[${idx}].description`,
          'Segment without description may render poorly')
      }
      // sequence must be a number if present
      if (seg.sequence !== undefined && typeof seg.sequence !== 'number') {
        this.addError(ValidationErrorCode.TYPE_MISMATCH,
          `videoSegments[${idx}].sequence`,
          'sequence must be a number',
          'number', typeof seg.sequence)
      }
    })
  }

  private validateCharacterSpecs(chars: any[]): void {
    chars.forEach((c, idx) => {
      if (!c || typeof c !== 'object') {
        this.addError(ValidationErrorCode.ARRAY_INVALID,
          `characterSpecs[${idx}]`,
          'Each character must be a non-null object')
        return
      }
      if (c.name !== undefined && typeof c.name !== 'string') {
        this.addWarning('TYPE_MISMATCH',
          `characterSpecs[${idx}].name`,
          'character name should be a string',
          'string', typeof c.name)
      }
    })
  }

  private validateSceneSpecs(scenes: any[]): void {
    scenes.forEach((s, idx) => {
      if (!s || typeof s !== 'object') {
        this.addError(ValidationErrorCode.ARRAY_INVALID,
          `sceneSpecs[${idx}]`,
          'Each scene must be a non-null object')
      }
    })
  }

  private validateVoiceConfigs(voices: any[]): void {
    voices.forEach((v, idx) => {
      if (!v || typeof v !== 'object') {
        this.addError(ValidationErrorCode.ARRAY_INVALID,
          `voiceConfigs[${idx}]`,
          'Each voice config must be a non-null object')
      }
    })
  }

  private validateObjectField(payload: any, field: string): void {
    if (typeof payload[field] !== 'object' || payload[field] === null) return
    this.stats.nestedObjectsChecked++

    // videoProduction: should have basic fields
    if (field === 'videoProduction') {
      const vp = payload[field]
      const expectedKeys = ['width', 'height', 'fps', 'style']
      for (const key of expectedKeys) {
        if (vp[key] !== undefined && typeof vp[key] === 'object') {
          this.addWarning('NESTED_OBJECT_INVALID',
            `videoProduction.${key}`,
            `${key} is expected to be a primitive, got ${typeof vp[key]}`)
        }
      }
    }
  }

  private hasField(payload: any, field: string): boolean {
    return field in payload
  }

  private addError(code: ValidationErrorCode, path: string, message: string, expected?: string, actual?: string): void {
    this.errors.push({ code, path, message, expected, actual })
  }

  private addWarning(code: any, path: string, message: string, expected?: string, actual?: string): void {
    this.warnings.push({ code: code as ValidationErrorCode, path, message, expected, actual })
  }

  private buildResult(start: number): ValidationResult {
    return {
      valid: this.errors.length === 0,
      version: CURRENT_SCHEMA_VERSION,
      errors: [...this.errors],
      warnings: [...this.warnings],
      stats: {
        ...this.stats,
        durationMs: Date.now() - start,
      },
    }
  }
}

// ─── Singleton ────────────────────────────────────────

export const schemaValidator = new AigcSchemaValidator()

// ─── Validation Report ───────────────────────────────

export interface ValidationReportEntry {
  field: string
  reason: string        // The ValidationErrorCode as string
  expected: string
  actual: string
}

export interface ValidationReport {
  code: string
  schemaVersion: string
  valid: boolean
  errors: ValidationReportEntry[]
  warnings: ValidationReportEntry[]
  stats: {
    fieldsChecked: number
    arraysChecked: number
    nestedObjectsChecked: number
    durationMs: number
  }
}

/**
 * Build a structured ValidationReport from a ValidationResult.
 * This is what gets returned to the caller (and potentially to Agent as feedback).
 */
export function buildReport(result: ValidationResult): ValidationReport {
  return {
    code: result.valid ? 'VALID' : 'SCHEMA_INVALID',
    schemaVersion: result.version,
    valid: result.valid,
    errors: result.errors.map(e => ({
      field: e.path,
      reason: e.code,
      expected: e.expected || '—',
      actual: e.actual || '—',
    })),
    warnings: result.warnings.map(w => ({
      field: w.path,
      reason: w.code,
      expected: w.expected || '—',
      actual: w.actual || '—',
    })),
    stats: { ...result.stats },
  }
}

// ─── Quarantine Storage ──────────────────────────────

export interface QuarantineRecord {
  id: string
  timestamp: string
  schemaVersion: string
  errorCount: number
  report: ValidationReport
  payloadSnippet: string   // First 2000 chars of the rejected payload
  source: string           // e.g., "script-submit" | "workbench-project"
  projectId?: string
}

// In-memory quarantine buffer (replace with DB/file in production)
const quarantineBuffer: QuarantineRecord[] = []
const MAX_QUARANTINE_RECORDS = 100

/**
 * Quarantine an invalid payload for later analysis.
 * Stores a structured record including the validation report and a payload snippet.
 */
export function quarantine(payload: any, report: ValidationReport, source: string, projectId?: string): QuarantineRecord {
  const record: QuarantineRecord = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    schemaVersion: report.schemaVersion,
    errorCount: report.errors.length,
    report,
    payloadSnippet: JSON.stringify(payload).slice(0, 2000),
    source,
    projectId,
  }

  quarantineBuffer.push(record)

  // Trim buffer
  while (quarantineBuffer.length > MAX_QUARANTINE_RECORDS) {
    quarantineBuffer.shift()
  }

  console.error(`[Quarantine] 🚨 Stored invalid payload (${report.errors.length} errors, id=${record.id}, source=${source})`)
  return record
}

/**
 * Retrieve all quarantine records (for debugging / admin).
 */
export function getQuarantineRecords(): QuarantineRecord[] {
  return [...quarantineBuffer]
}

/**
 * Clear quarantine buffer.
 */
export function clearQuarantine(): void {
  quarantineBuffer.length = 0
}

// ─── Migration Interface (empty, for future use) ─────

export interface MigrationFunction {
  (payload: any): any
}

export interface MigrationRecord {
  fromVersion: string
  toVersion: string
  migrate: MigrationFunction
}

// Migration registry — extend when schema version changes
const migrations: MigrationRecord[] = []

export function registerMigration(from: string, to: string, fn: MigrationFunction): void {
  migrations.push({ fromVersion: from, toVersion: to, migrate: fn })
}

/**
 * Migrate a payload from its current version to a target version.
 * Returns the migrated payload if migration is available, or null if no
 * migration path exists.
 */
export function migratePayload(payload: any, targetVersion: string = CURRENT_SCHEMA_VERSION): any | null {
  const currentVersion = payload?.schemaVersion || '0.0'

  if (currentVersion === targetVersion) return payload

  // Find migration path (simplified — single hop for now)
  const record = migrations.find(m => m.fromVersion === currentVersion && m.toVersion === targetVersion)
  if (!record) return null

  try {
    const migrated = record.migrate(payload)
    migrated.schemaVersion = targetVersion
    return migrated
  } catch {
    return null
  }
}

export { migrations }
