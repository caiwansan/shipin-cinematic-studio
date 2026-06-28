/**
 * Schema Validator — Extended Tests
 *
 * Covers ValidationReport and Quarantine functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  AigcSchemaValidator,
  buildReport,
  quarantine,
  getQuarantineRecords,
  clearQuarantine,
  CURRENT_SCHEMA_VERSION,
} from './schema-validator.js'

function makeValidSpec(): any {
  return {
    schemaVersion: '1.0',
    plotBlueprint: { storyType: 'drama', characters: [], scenes: [] },
    characterSpecs: [{ name: '李华', gender: '男', role: '主角' }],
    sceneSpecs: [{ name: '森林', description: '密林深处' }],
    videoSegments: [{ sequence: 1, description: '李华走进森林' }],
    voiceConfigs: [{ characterName: '李华', voiceType: '沉稳男声' }],
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

describe('ValidationReport', () => {
  it('buildReport returns VALID for valid payload', () => {
    const result = validator.validate(makeValidSpec())
    const report = buildReport(result)
    expect(report.code).toBe('VALID')
    expect(report.valid).toBe(true)
    expect(report.errors).toHaveLength(0)
    expect(report.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(report.stats.fieldsChecked).toBeGreaterThan(0)
  })

  it('buildReport returns SCHEMA_INVALID with structured errors for invalid payload', () => {
    const result = validator.validate(null)
    const report = buildReport(result)
    expect(report.code).toBe('SCHEMA_INVALID')
    expect(report.valid).toBe(false)
    expect(report.errors.length).toBeGreaterThan(0)
    expect(report.errors[0].field).toBe('$root')
    expect(report.errors[0].reason).toBe('SCHEMA_INVALID')
    expect(report.errors[0].expected).toBe('object')
  })

  it('buildReport includes field path and reason for type mismatch', () => {
    const spec = makeValidSpec()
    spec.characterSpecs = 'not-an-array'
    const result = validator.validate(spec)
    const report = buildReport(result)
    const error = report.errors.find(e => e.field === 'characterSpecs')
    expect(error).toBeDefined()
    expect(error!.reason).toBe('TYPE_MISMATCH')
    expect(error!.expected).toBe('array')
    expect(error!.actual).toBe('string')
  })

  it('buildReport includes nested validation errors', () => {
    const spec = makeValidSpec()
    spec.videoSegments.push(null)
    const result = validator.validate(spec)
    const report = buildReport(result)
    expect(report.errors.some(e => e.field.includes('videoSegments'))).toBe(true)
  })

  it('buildReport includes warnings for suspect fields', () => {
    const spec = makeValidSpec()
    delete spec.characterSpecs
    spec.bogusField = 'should-warn'
    const result = validator.validate(spec)
    const report = buildReport(result)
    expect(report.warnings.some(w => w.field === 'bogusField')).toBe(true)
  })
})

describe('Quarantine', () => {
  beforeEach(() => {
    clearQuarantine()
  })

  it('stores quarantine record on invalid payload', () => {
    const result = validator.validate(null)
    const report = buildReport(result)
    const record = quarantine(null, report, 'test-source', 'proj-123')
    expect(record.id).toMatch(/^q_/)
    expect(record.timestamp).toBeTruthy()
    expect(record.errorCount).toBeGreaterThan(0)
    expect(record.source).toBe('test-source')
    expect(record.projectId).toBe('proj-123')
    expect(record.payloadSnippet).toBeTruthy()
  })

  it('stores multiple quarantine records', () => {
    const r1 = validator.validate(null)
    const r2 = validator.validate('bad')
    quarantine(null, buildReport(r1), 'src1')
    quarantine('bad', buildReport(r2), 'src2')
    const records = getQuarantineRecords()
    expect(records).toHaveLength(2)
  })

  it('quarantine includes schema version and error count', () => {
    const result = validator.validate({ characterSpecs: 'wrong' })
    const report = buildReport(result)
    const record = quarantine({ characterSpecs: 'wrong' }, report, 'test')
    expect(record.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(record.errorCount).toBe(1)
  })

  it('clearQuarantine empties the buffer', () => {
    const r = validator.validate(null)
    quarantine(null, buildReport(r), 'test')
    expect(getQuarantineRecords()).toHaveLength(1)
    clearQuarantine()
    expect(getQuarantineRecords()).toHaveLength(0)
  })

  it('getQuarantineRecords returns a copy (immutable)', () => {
    const r = validator.validate(null)
    quarantine(null, buildReport(r), 'test')
    const records = getQuarantineRecords()
    records.pop()
    expect(getQuarantineRecords()).toHaveLength(1)
  })
})
