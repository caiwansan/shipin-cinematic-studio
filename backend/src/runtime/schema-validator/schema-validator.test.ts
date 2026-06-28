/**
 * Schema Validator — Unit Tests
 *
 * Covers:
 *   - Valid payload acceptance
 *   - Invalid payload rejection
 *   - Version handling
 *   - Array/object type validation
 *   - Nested validation (videoSegments, characterSpecs)
 *   - Migration interface (empty but contract-defined)
 */

import { describe, it, expect } from 'vitest'
import { AigcSchemaValidator, migratePayload, registerMigration, CURRENT_SCHEMA_VERSION, ValidationErrorCode } from './schema-validator.js'

function makeValidSpec(): any {
  return {
    schemaVersion: '1.0',
    plotBlueprint: { storyType: 'drama', characters: [], scenes: [] },
    characterSpecs: [
      { name: '李华', gender: '男', role: '主角', personality: '勇敢' },
    ],
    sceneSpecs: [
      { name: '森林', description: '密林深处', environment: '户外', mood: '紧张' },
    ],
    videoSegments: [
      { sequence: 1, description: '李华走进森林', emotion: 'tension', sceneId: 'scene_0', characterName: '李华' },
      { sequence: 2, description: '李华发现线索', emotion: 'shock', sceneId: 'scene_0' },
    ],
    voiceConfigs: [
      { characterName: '李华', voiceType: '沉稳男声' },
    ],
    frameDesign: [],
    videoProduction: { width: 1080, height: 1920, fps: 24 },
    propSpecs: [],
    effectSpecs: [],
    actionSpecs: [],
    cameraSpecs: [],
    emotionSpecs: [],
    storyboardSpecs: [],
  }
}

const validator = new AigcSchemaValidator()

describe('AigcSchemaValidator', () => {
  describe('valid payloads', () => {
    it('accepts a fully valid spec', () => {
      const result = validator.validate(makeValidSpec())
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts a minimal spec (only required fields)', () => {
      const minimal = {
        characterSpecs: [],
        sceneSpecs: [],
        videoSegments: [],
      }
      const result = validator.validate(minimal)
      expect(result.valid).toBe(true)
    })

    it('accepts empty arrays', () => {
      const spec = makeValidSpec()
      spec.voiceConfigs = []
      spec.propSpecs = []
      spec.effectSpecs = []
      const result = validator.validate(spec)
      expect(result.valid).toBe(true)
    })

    it('accepts spec without schemaVersion (treated as v1)', () => {
      const spec = makeValidSpec()
      delete spec.schemaVersion
      const result = validator.validate(spec)
      expect(result.valid).toBe(true)
    })

    it('accepts V3 alias fields', () => {
      const spec = {
        characters: [{ name: '李华' }],
        scenes: [{ name: '森林' }],
        segments: [{ sequence: 1, description: 'test' }],
      }
      const result = validator.validate(spec)
      expect(result.valid).toBe(true)
    })
  })

  describe('invalid payloads', () => {
    it('rejects null payload', () => {
      const result = validator.validate(null)
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe(ValidationErrorCode.SCHEMA_INVALID)
    })

    it('rejects non-object payload', () => {
      const result = validator.validate('not an object')
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe(ValidationErrorCode.SCHEMA_INVALID)
    })

    it('rejects array field that is not an array', () => {
      const spec = makeValidSpec()
      spec.characterSpecs = 'not an array'
      const result = validator.validate(spec)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === ValidationErrorCode.TYPE_MISMATCH && e.path === 'characterSpecs')).toBe(true)
    })

    it('rejects object field that is an array', () => {
      const spec = makeValidSpec()
      spec.plotBlueprint = ['not', 'an', 'object']
      const result = validator.validate(spec)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === ValidationErrorCode.TYPE_MISMATCH && e.path === 'plotBlueprint')).toBe(true)
    })

    it('rejects object field that is null', () => {
      const spec = makeValidSpec()
      spec.videoProduction = null
      const result = validator.validate(spec)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === ValidationErrorCode.TYPE_MISMATCH && e.path === 'videoProduction')).toBe(true)
    })
  })

  describe('nested validation', () => {
    it('warns on segments without description', () => {
      const spec = makeValidSpec()
      spec.videoSegments.push({ sequence: 3 })
      const result = validator.validate(spec)
      // Should still pass (description is optional but warned)
      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.path.includes('description'))).toBe(true)
    })

    it('errors on segments with invalid sequence type', () => {
      const spec = makeValidSpec()
      spec.videoSegments.push({ sequence: 'three', description: 'test' })
      const result = validator.validate(spec)
      expect(result.errors.some(e => e.code === ValidationErrorCode.TYPE_MISMATCH && e.path.includes('sequence'))).toBe(true)
    })

    it('errors on null segment items', () => {
      const spec = makeValidSpec()
      spec.videoSegments.push(null)
      const result = validator.validate(spec)
      expect(result.valid).toBe(false)
    })

    it('errors on null character items', () => {
      const spec = makeValidSpec()
      spec.characterSpecs.push(null)
      const result = validator.validate(spec)
      expect(result.valid).toBe(false)
    })

    it('warns on videoProduction sub-field with unexpected type', () => {
      const spec = makeValidSpec()
      spec.videoProduction.style = { nested: 'object' } // expected string
      const result = validator.validate(spec)
      // Should pass — videoProduction sub-fields are type-checked as warnings
      expect(result.valid).toBe(true)
    })
  })

  describe('isValid()', () => {
    it('returns true for valid payload', () => {
      expect(validator.isValid(makeValidSpec())).toBe(true)
    })

    it('returns false for null payload', () => {
      expect(validator.isValid(null)).toBe(false)
    })

    it('returns false for malformed payload', () => {
      expect(validator.isValid({ characterSpecs: 'wrong' })).toBe(false)
    })
  })

  describe('stats tracking', () => {
    it('reports fieldsChecked > 0', () => {
      const result = validator.validate(makeValidSpec())
      expect(result.stats.fieldsChecked).toBeGreaterThan(0)
      expect(result.stats.arraysChecked).toBeGreaterThan(0)
      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('Migration Interface', () => {
  it('migratePayload returns as-is when version matches', () => {
    const payload = { schemaVersion: CURRENT_SCHEMA_VERSION, data: 'test' }
    const result = migratePayload(payload, CURRENT_SCHEMA_VERSION)
    expect(result).toBe(payload)
  })

  it('migratePayload returns null when no migration path', () => {
    const payload = { schemaVersion: '0.5', data: 'test' }
    const result = migratePayload(payload, CURRENT_SCHEMA_VERSION)
    expect(result).toBeNull()
  })

  it('registerMigration and apply', () => {
    registerMigration('0.5', '1.0', (payload) => {
      return { ...payload, data: payload.data + '_migrated' }
    })
    const payload = { data: 'test' }
    delete payload.schemaVersion // simulate old data
    const result = migratePayload({ ...payload, schemaVersion: '0.5' }, '1.0')
    expect(result).not.toBeNull()
    expect(result!.data).toBe('test_migrated')
    expect(result!.schemaVersion).toBe('1.0')
  })
})

describe('ValidationErrorCode enum', () => {
  it('has all expected codes', () => {
    const codes = Object.values(ValidationErrorCode)
    expect(codes).toContain('SCHEMA_INVALID')
    expect(codes).toContain('FIELD_MISSING')
    expect(codes).toContain('TYPE_MISMATCH')
    expect(codes).toContain('VALUE_INVALID')
    expect(codes).toContain('UNKNOWN_FIELD')
    expect(codes).toContain('UNSUPPORTED_VERSION')
    expect(codes).toContain('ARRAY_INVALID')
    expect(codes).toContain('NESTED_OBJECT_INVALID')
    expect(codes).toHaveLength(8)
  })
})
