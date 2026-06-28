/**
 * CEE — 测试
 */

import { describe, test, expect } from 'vitest'
import { ObjectPersistenceEvaluator, LightingEvaluator, CompositionEvaluator, FocusEvaluator, CameraMotionEvaluator, ShotScaleEvaluator, ShotAngleEvaluator } from '../cee-evaluators.js'
import { CapabilityEvaluationEngine } from '../cee-engine.js'
import type { EvidencePackage, ExpectedEvidence } from '../vep-types.js'

function sampleEvidence(overrides?: Partial<EvidencePackage>): EvidencePackage {
  return {
    videoId: 'cee_test_001',
    generatedAt: new Date().toISOString(),
    shots: [
      { shotId: 'shot_1', startTime: 0, endTime: 4, duration: 4, estimatedScale: 'close_up', estimatedAngle: 'eye' },
      { shotId: 'shot_2', startTime: 4, endTime: 8, duration: 4, estimatedScale: 'medium', estimatedAngle: 'high' },
    ],
    keyframes: [
      { id: 'kf_1', shotId: 'shot_1', timestamp: 1, imageUrl: '/f/kf_1.jpg', focusSubject: 'face', estimatedDepthOfField: 'shallow' },
      { id: 'kf_2', shotId: 'shot_2', timestamp: 5, imageUrl: '/f/kf_2.jpg', focusSubject: 'face', estimatedDepthOfField: 'medium' },
    ],
    objectTracks: [
      { trackId: 'obj_1', label: 'person', characterId: 'char_1', frames: [], persistent: true, identityChanges: 0 },
      { trackId: 'obj_2', label: 'person', characterId: 'char_2', frames: [], persistent: true, identityChanges: 0 },
    ],
    cameraMotions: [{ shotId: 'shot_1', motionType: 'dolly_in', smoothnessScore: 85, pathType: 'linear' }],
    lightingProfiles: [{
      shotId: 'shot_1',
      keyLightDirectionFrames: [{ timestamp: 0, direction: 'left', confidence: 0.9 }, { timestamp: 2, direction: 'left', confidence: 0.9 }],
      colorTemperatureFrames: [{ timestamp: 0, temperature: 'warm', confidence: 0.9 }, { timestamp: 2, temperature: 'warm', confidence: 0.9 }],
      exposureFrames: [{ timestamp: 0, exposure: 'normal', confidence: 0.9 }, { timestamp: 2, exposure: 'normal', confidence: 0.9 }],
      shadowConsistencyFrames: [{ timestamp: 0, consistent: true }, { timestamp: 2, consistent: true }],
    }],
    compositionProfiles: [{
      shotId: 'shot_1',
      subjectPositionFrames: [{ timestamp: 0, position: { x: 0.2, y: 0.3, w: 0.3, h: 0.5 }, rule: 'rule_of_thirds' }],
      headroomFrames: [{ timestamp: 0, percent: 15 }],
      lookRoomFrames: [{ timestamp: 0, percent: 35, gazeDirection: 'right' }],
    }],
    metadata: {
      videoDuration: 8, fps: 24, resolution: { width: 1920, height: 1080 },
      evidenceProviders: ['test'], version: '1.0',
    },
    ...overrides,
  }
}

describe('CEE: Individual Evaluators', () => {
  test('ObjectPersistence: 全部持久化时通过', () => {
    const e = new ObjectPersistenceEvaluator()
    const r = e.evaluate({}, sampleEvidence())
    expect(r.score).toBe(100)
    expect(r.severity).toBe('pass')
  })

  test('ObjectPersistence: 无轨迹时 critical', () => {
    const e = new ObjectPersistenceEvaluator()
    const r = e.evaluate({}, sampleEvidence({ objectTracks: [] }))
    expect(r.score).toBe(0)
    expect(r.severity).toBe('critical')
  })

  test('Lighting: 全部一致时通过', () => {
    const e = new LightingEvaluator()
    const r = e.evaluate({}, sampleEvidence())
    expect(r.score).toBe(100)
    expect(r.severity).toBe('pass')
  })

  test('Lighting: 方向不一致时偏差', () => {
    const e = new LightingEvaluator()
    const r = e.evaluate({}, sampleEvidence({
      lightingProfiles: [{
        shotId: 'shot_1',
        keyLightDirectionFrames: [{ timestamp: 0, direction: 'left', confidence: 0.9 }, { timestamp: 2, direction: 'right', confidence: 0.8 }],
        colorTemperatureFrames: [{ timestamp: 0, temperature: 'warm', confidence: 0.9 }, { timestamp: 2, temperature: 'warm', confidence: 0.9 }],
        exposureFrames: [{ timestamp: 0, exposure: 'normal', confidence: 0.9 }, { timestamp: 2, exposure: 'normal', confidence: 0.9 }],
        shadowConsistencyFrames: [],
      }],
    }))
    expect(r.score).toBeLessThan(100)
    expect(r.severity).not.toBe('pass')
  })

  test('Composition: 合理构图时通过', () => {
    const e = new CompositionEvaluator()
    const r = e.evaluate({}, sampleEvidence())
    expect(r.score).toBe(100)
    expect(r.severity).toBe('pass')
  })

  test('Focus: 全部对焦时通过', () => {
    const e = new FocusEvaluator()
    const r = e.evaluate({}, sampleEvidence())
    expect(r.score).toBe(100)
    expect(r.severity).toBe('pass')
  })

  test('CameraMotion: 平滑时通过', () => {
    const e = new CameraMotionEvaluator()
    const r = e.evaluate({}, sampleEvidence())
    expect(r.score).toBe(100)
    expect(r.severity).toBe('pass')
  })

  test('Evaluator 产出 Recommendation', () => {
    const e = new ObjectPersistenceEvaluator()
    const r = e.evaluate({}, sampleEvidence({ objectTracks: [
      { trackId: 'obj_1', label: 'person', characterId: 'char_1', frames: [], persistent: false, identityChanges: 3 },
    ] }))
    expect(r.recommendations.length).toBeGreaterThan(0)
    expect(r.recommendations[0].type).toBe('regen')
    expect(r.recommendations[0].capability).toBe('OBJECT_PERSISTENCE')
  })

  test('Estimator 产出 Deviation', () => {
    const e = new CompositionEvaluator()
    const r = e.evaluate({}, sampleEvidence({
      compositionProfiles: [{
        shotId: 'shot_1',
        subjectPositionFrames: [{ timestamp: 0, position: { x: 0.5, y: 0.5, w: 0.3, h: 0.5 }, rule: 'center' }],
        headroomFrames: [{ timestamp: 0, percent: 5 }],
        lookRoomFrames: [{ timestamp: 0, percent: 10, gazeDirection: 'right' }],
      }],
    }))
    expect(r.score).toBeLessThan(100)
    expect(r.deviations.length).toBeGreaterThan(0)
  })
})

describe('CEE: Engine', () => {
  test('Engine 注册并批量评估', () => {
    const engine = new CapabilityEvaluationEngine()
    engine.registerAll([
      new ObjectPersistenceEvaluator(),
      new LightingEvaluator(),
      new CompositionEvaluator(),
      new FocusEvaluator(),
      new CameraMotionEvaluator(),
    ])

    const result = engine.evaluateAll({}, sampleEvidence())
    expect(result.reports.length).toBeGreaterThanOrEqual(5)
    expect(result.summary.overall).toBeGreaterThan(0)
    expect(result.summary.dimensions.cinematicQuality).toBeGreaterThan(0)
    expect(result.summary.dimensions.worldConsistency).toBeGreaterThan(0)
  })

  test('Evalluate 按名称调用', () => {
    const engine = new CapabilityEvaluationEngine()
    engine.register(new ObjectPersistenceEvaluator())
    const r = engine.evaluate('OBJECT_PERSISTENCE', {}, sampleEvidence())
    expect(r).toBeDefined()
    expect(r!.capability).toBe('OBJECT_PERSISTENCE')
  })

  test('不存在的评估器返回 undefined', () => {
    const engine = new CapabilityEvaluationEngine()
    const r = engine.evaluate('NONEXISTENT', {}, sampleEvidence())
    expect(r).toBeUndefined()
  })

  test('Summary 带 confidence', () => {
    const engine = new CapabilityEvaluationEngine()
    engine.register(new ObjectPersistenceEvaluator())
    engine.register(new LightingEvaluator())
    const result = engine.evaluateAll({}, sampleEvidence())
    const confs = Object.values(result.summary.confidence)
    expect(confs.length).toBeGreaterThan(0)
    confs.forEach(c => expect(c).toBeGreaterThan(0))
  })

  test('缺少证据时跳过评估', () => {
    const engine = new CapabilityEvaluationEngine()
    engine.registerAll([
      new ObjectPersistenceEvaluator(),
      new LightingEvaluator(),
    ])
    // 空证据
    const result = engine.evaluateAll({}, sampleEvidence({ objectTracks: [], lightingProfiles: [] }))
    const lightingSkipped = result.config.capabilitiesSkipped.includes('LIGHT_CONTINUITY')
    const objSkipped = result.config.capabilitiesSkipped.includes('OBJECT_PERSISTENCE')
    expect(lightingSkipped || objSkipped).toBe(true)
  })

  test('四维评分正确', () => {
    const engine = new CapabilityEvaluationEngine()
    engine.registerAll([new ObjectPersistenceEvaluator(), new LightingEvaluator()])
    const result = engine.evaluateAll({}, sampleEvidence())
    expect(result.summary.dimensions.worldConsistency).toBe(100)
    expect(result.summary.dimensions.cinematicQuality).toBe(100)
    expect(result.summary.dimensions.physicsReality).toBe(100)
    expect(result.summary.dimensions.storyAlignment).toBe(100)
  })
})
