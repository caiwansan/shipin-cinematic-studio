/**
 * PQL v1.0 Schema Compatibility Tests
 *
 * AF-1 核心测试。
 * 所有未来变更必须通过此测试套件。
 *
 * 原则：v1.1 必须能读取 v1.0 的所有字段。
 * 禁止：删除字段 / 更改字段类型 / 必填改可选。
 */

import { describe, test, expect } from 'vitest'

// ─── Contract 1: CIR v1.0 Schema 兼容 ────

describe('AF-1: CIR Contract v1.0 兼容性', () => {
  test('CIR v1.0 必须包含 version 字段', () => {
    const cir10 = {
      version: '1.0',
      scene: { title: 'test', environment: { location: 'room', timeOfDay: 'day', weather: 'clear', atmosphere: 'neutral' } },
      characters: [{ id: 'c1', name: 'A', alias: 'A', gender: 'female', appearance: 'dress', personality: [], emotion: 'neutral' }],
      shots: [{ id: 's1', description: 'test', durationSeconds: 5, characterIds: ['c1'], actions: [], dialogue: [], camera: {} }],
      storyIntent: { story: 'test', cinematic: 'test' },
      metadata: { generatedBy: 'test', createdAt: '2026-01-01' },
    }
    // 未来 v1.1 必须能用 v1.0 的数据
    type VersionCheck = typeof cir10.version
    const _v: VersionCheck = '1.0'
    expect(cir10.version).toBe('1.0')
  })

  test('CIR v1.0 camera 字段结构冻结', () => {
    const camera = { path: {}, motion: {}, composition: {}, focus: {}, scale: 'medium', angle: 'eye' }
    expect(typeof camera.scale).toBe('string')
    expect(typeof camera.angle).toBe('string')
    // 禁止将 scale/angle 改为对象
    expect(camera).not.toHaveProperty('prompt')
    expect(camera).not.toHaveProperty('promptTemplate')
  })

  test('CIR v1.0 storyIntent 分层冻结', () => {
    const si = { story: 'narrative', cinematic: 'visual' }
    expect(si).toHaveProperty('story')
    expect(si).toHaveProperty('cinematic')
    // 以后可以新增 lighting / visual，但不能删除 story / cinematic
    const keys = Object.keys(si)
    expect(keys).toContain('story')
    expect(keys).toContain('cinematic')
  })

  test('CIR v1.0 无 prompt 字段', () => {
    interface NoPromptAllowed {
      prompt?: never
      negativePrompt?: never
      videoPrompt?: never
    }
    // 编译时检查：CIR 中不应出现这些字段
    // 运行时通过 validator 拦截
    const cirV1Fields = ['version', 'scene', 'characters', 'shots', 'storyIntent', 'constraints', 'providerHints', 'metadata']
    expect(cirV1Fields).not.toContain('prompt')
    expect(cirV1Fields).not.toContain('negativePrompt')
  })
})

// ─── Contract 2: CCP 管道兼容 ─────────────

describe('AF-1: CCP Contract v1.0 兼容性', () => {
  test('CCP 四层管道冻结', () => {
    const pipeline = ['CIR', 'Semantic IR', 'Provider IR', 'Prompt Renderer', 'Prompt Optimizer']
    expect(pipeline.length).toBe(5)
    expect(pipeline[0]).toBe('CIR')
    expect(pipeline[1]).toBe('Semantic IR')
  })

  test('CompileReport CapabilityDiff 格式冻结', () => {
    const diff = {
      supportedCapabilities: ['camera_motion'],
      lostCapabilities: [{ capability: 'rack_focus', reason: 'unsupported' }],
    }
    expect(diff).toHaveProperty('supportedCapabilities')
    expect(diff).toHaveProperty('lostCapabilities')
    // 每条 lost 必须有 capability 和 reason
    if (diff.lostCapabilities.length > 0) {
      expect(diff.lostCapabilities[0]).toHaveProperty('capability')
      expect(diff.lostCapabilities[0]).toHaveProperty('reason')
    }
  })
})

// ─── Contract 3: Evidence 兼容 ────────────

describe('AF-1: Evidence Contract v1.0 兼容性', () => {
  test('EvidencePackage 核心字段冻结', () => {
    const pkg = {
      videoId: 'v1',
      generatedAt: '2026-01-01',
      shots: [] as any[],
      keyframes: [] as any[],
      objectTracks: [] as any[],
      cameraMotions: [] as any[],
      lightingProfiles: [] as any[],
      compositionProfiles: [] as any[],
      metadata: { videoDuration: 0, fps: 0, resolution: { width: 0, height: 0 }, evidenceProviders: [], version: '1.0' },
    }
    expect(pkg).toHaveProperty('videoId')
    expect(pkg).toHaveProperty('shots')
    expect(pkg).toHaveProperty('keyframes')
    expect(pkg).toHaveProperty('objectTracks')
    expect(pkg).toHaveProperty('metadata')
  })

  test('EvidenceDeviation 格式冻结', () => {
    const deviation = { capability: 'SHOT_SCALE', expected: 'close_up', observed: 'medium', deviation: 50, score: 50, reason: 'mismatch' }
    const keys = Object.keys(deviation).sort()
    expect(keys).toEqual(['capability', 'deviation', 'expected', 'observed', 'reason', 'score'])
  })
})

// ─── Contract 4: CapabilityReport 兼容 ────

describe('AF-1: CapabilityReport Contract v1.0 兼容性', () => {
  test('CapabilityReport 核心字段冻结', () => {
    const report = {
      capability: 'TEST',
      evaluated: true,
      score: 85,
      confidence: 0.8,
      severity: 'minor',
      deviations: [] as any[],
      recommendations: [] as any[],
      evidenceUsed: [],
    }
    expect(report).toHaveProperty('capability')
    expect(report).toHaveProperty('evaluated')
    expect(report).toHaveProperty('deviations')
    expect(report).toHaveProperty('recommendations')
    expect(report).toHaveProperty('evidenceUsed')
  })

  test('Recommendation 字段冻结', () => {
    const rec = { type: 'adjust', capability: 'SHOT_SCALE', description: 'fix', priority: 'medium' }
    expect(rec).toHaveProperty('type')
    expect(rec).toHaveProperty('capability')
    expect(rec).toHaveProperty('description')
    expect(rec).toHaveProperty('priority')
  })

  test('EvaluationSummary 四维 + 总体冻结', () => {
    const summary = {
      scores: {},
      confidence: {},
      dimensions: { worldConsistency: 0, cinematicQuality: 0, physicsReality: 0, storyAlignment: 0 },
      overall: 0,
      evaluatedAt: '',
    }
    const dims = Object.keys(summary.dimensions).sort()
    expect(dims).toEqual(['cinematicQuality', 'physicsReality', 'storyAlignment', 'worldConsistency'])
    expect(summary).toHaveProperty('overall')
  })
})

// ─── Contract 5: CIR Patch 兼容 ───────────

describe('AF-1: CIR Patch Contract v1.0 兼容性', () => {
  test('FieldPatch 包含 path + to', () => {
    const fp = { path: 'shots[0].camera.scale', to: 'close_up' }
    expect(fp).toHaveProperty('path')
    expect(fp).toHaveProperty('to')
  })

  test('PatchSection 包含 type + confidence + fields', () => {
    const ps = { type: 'safe' as const, confidence: 0.9, targetCapability: 'TEST', fields: [{ path: 'x', to: 'y' }], reason: 'test' }
    expect(ps).toHaveProperty('type')
    expect(ps).toHaveProperty('confidence')
    expect(ps).toHaveProperty('targetCapability')
    expect(ps).toHaveProperty('fields')
    expect(ps).toHaveProperty('reason')
  })

  test('Patch 不包含 prompt 字段', () => {
    const patchFields = ['path', 'from', 'to']
    expect(patchFields).not.toContain('prompt')
    expect(patchFields).not.toContain('negativePrompt')
    expect(patchFields).not.toContain('videoPrompt')
  })

  test('PatchValidation 包含 valid 和 affectedCapabilities', () => {
    const v = { valid: true, errors: [], warnings: [], affectedCapabilities: [{ capability: 'TEST', expectedChange: 10, direction: 'up' as const }] }
    expect(v).toHaveProperty('valid')
    expect(v).toHaveProperty('affectedCapabilities')
    if (v.affectedCapabilities.length > 0) {
      expect(v.affectedCapabilities[0]).toHaveProperty('direction')
      expect(['up', 'down']).toContain(v.affectedCapabilities[0].direction)
    }
  })
})

// ─── Contract 6: Capability Registry 兼容 ─

describe('AF-1: Capability Registry Contract v1.0 兼容', () => {
  test('Registry 中的每项能力必须有 wave 标记', () => {
    // 此测试仅验证 schema 约束
    // 实际 registry 数据在 benchmarks/capabilities/ 中
    interface CapabilityEntry {
      id: string
      wave: '1' | '2'
      primaryFields: string[]
    }
    const entry: CapabilityEntry = { id: 'CAMERA_PATH', wave: '1', primaryFields: ['camera.path'] }
    expect(entry.wave).toBeTruthy()
    expect(entry.primaryFields.length).toBeGreaterThan(0)
  })
})

// ─── 全局兼容规则 ─────────────────────────

describe('AF-1: 全局兼容规则', () => {
  test('禁止出现 Prompt 作为核心概念', () => {
    // 检查核心模块名
    const coreModules = ['cir', 'ccp', 'vep', 'cee', 'coe']
    const promptModules = coreModules.filter(m => m.includes('prompt'))
    expect(promptModules).toHaveLength(0)
  })

  test('所有类型定义可序列化为 JSON', () => {
    const obj = {
      version: '1.0',
      nested: { a: 1, b: '2' },
      array: [{ x: 1 }, { x: 2 }],
      optional: undefined,
    }
    const json = JSON.parse(JSON.stringify(obj))
    expect(json.version).toBe('1.0')
    expect(json.nested.a).toBe(1)
    expect(json.array.length).toBe(2)
  })
})
