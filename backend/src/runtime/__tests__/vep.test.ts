/**
 * VEP — 测试
 */

import { describe, test, expect } from 'vitest'
import { computeEvidenceDiff } from '../vep-evidence-diff.js'
import { EvidenceRegistry } from '../vep-registry.js'
import type { EvidencePackage, ExpectedEvidence } from '../vep-types.js'

function sampleEvidencePackage(overrides?: Partial<EvidencePackage>): EvidencePackage {
  return {
    videoId: 'test_video_001',
    sourceStoryId: 'story_001',
    generatedAt: new Date().toISOString(),
    shots: [
      { shotId: 'shot_1', startTime: 0, endTime: 4, duration: 4, estimatedScale: 'close_up', estimatedAngle: 'eye' },
      { shotId: 'shot_2', startTime: 4, endTime: 8, duration: 4, estimatedScale: 'medium', estimatedAngle: 'high' },
    ],
    keyframes: [
      { id: 'kf_1', shotId: 'shot_1', timestamp: 1, imageUrl: '/frames/kf_1.jpg', focusSubject: 'face', estimatedDepthOfField: 'shallow' },
      { id: 'kf_2', shotId: 'shot_2', timestamp: 5, imageUrl: '/frames/kf_2.jpg', focusSubject: 'none', estimatedDepthOfField: 'deep' },
    ],
    objectTracks: [
      { trackId: 'obj_1', label: 'person', characterId: 'char_1', frames: [], persistent: true, identityChanges: 0 },
      { trackId: 'obj_2', label: 'person', characterId: 'char_2', frames: [], persistent: false, identityChanges: 2 },
    ],
    cameraMotions: [],
    lightingProfiles: [
      {
        shotId: 'shot_1',
        keyLightDirectionFrames: [{ timestamp: 0, direction: 'left', confidence: 0.9 }, { timestamp: 2, direction: 'left', confidence: 0.8 }],
        colorTemperatureFrames: [{ timestamp: 0, temperature: 'warm', confidence: 0.9 }, { timestamp: 2, temperature: 'warm', confidence: 0.8 }],
        exposureFrames: [{ timestamp: 0, exposure: 'normal', confidence: 0.95 }, { timestamp: 2, exposure: 'normal', confidence: 0.9 }],
        shadowConsistencyFrames: [{ timestamp: 0, consistent: true }, { timestamp: 2, consistent: true }],
      },
    ],
    compositionProfiles: [
      {
        shotId: 'shot_1',
        subjectPositionFrames: [{ timestamp: 0, position: { x: 0.2, y: 0.3, w: 0.3, h: 0.5 }, rule: 'rule_of_thirds' }],
        headroomFrames: [{ timestamp: 0, percent: 15 }],
        lookRoomFrames: [{ timestamp: 0, percent: 35, gazeDirection: 'right' }],
      },
    ],
    metadata: {
      videoDuration: 8,
      fps: 24,
      resolution: { width: 1920, height: 1080 },
      evidenceProviders: ['test'],
      version: '1.0',
    },
    ...overrides,
  }
}

describe('VEP: Evidence Diff', () => {
  test('全部匹配时使用 matchedCapabilities', () => {
    const exp: ExpectedEvidence = {
      shotScales: {},
      shotAngles: {},
      compositionRules: {},
      lightDirections: {},
      colorTemperatures: {},
      focusTargets: {},
      depthOfFields: {},
      shotCharacters: {},
    }
    const obs = sampleEvidencePackage()
    const diff = computeEvidenceDiff(exp, obs)
    expect(diff.matchedCapabilities).toContain('LIGHT_CONTINUITY')
    expect(diff.matchedCapabilities).toContain('CAMERA_COMPOSITION')
    expect(diff.deviations.length).toBeGreaterThanOrEqual(0)
    expect(diff.generatedAt).toBeDefined()
  })

  test('灯光不一致时产生偏差', () => {
    const exp: ExpectedEvidence = { shotScales: {}, shotAngles: {}, compositionRules: {}, lightDirections: {}, colorTemperatures: {}, focusTargets: {}, depthOfFields: {}, shotCharacters: {} }
    const obs = sampleEvidencePackage({
      lightingProfiles: [{
        shotId: 'shot_1',
        keyLightDirectionFrames: [
          { timestamp: 0, direction: 'left', confidence: 0.9 },
          { timestamp: 2, direction: 'right', confidence: 0.8 },
        ],
        colorTemperatureFrames: [{ timestamp: 0, temperature: 'warm', confidence: 0.9 }, { timestamp: 2, temperature: 'cool', confidence: 0.8 }],
        exposureFrames: [{ timestamp: 0, exposure: 'normal', confidence: 0.9 }, { timestamp: 2, exposure: 'overexposed', confidence: 0.8 }],
        shadowConsistencyFrames: [],
      }],
    })
    const diff = computeEvidenceDiff(exp, obs)
    expect(diff.scores['LIGHT_CONTINUITY']).toBeLessThan(90)
  })

  test('对象身份变化时降低评分', () => {
    const exp: ExpectedEvidence = { shotScales: {}, shotAngles: {}, compositionRules: {}, lightDirections: {}, colorTemperatures: {}, focusTargets: {}, depthOfFields: {}, shotCharacters: {} }
    const obs = sampleEvidencePackage()
    const diff = computeEvidenceDiff(exp, obs)
    expect(diff.scores['OBJECT_PERSISTENCE']).toBe(50)
  })
})

describe('VEP: Evidence Registry', () => {
  test('注册与读取', () => {
    const registry = new EvidenceRegistry()
    const pkg = sampleEvidencePackage()
    const id = registry.register(pkg, 'cir_001', 'test_provider')
    expect(registry.get(id)).toBeDefined()
    expect(registry.get(id)!.videoId).toBe('test_video_001')
  })

  test('按 CIR 查询', () => {
    const registry = new EvidenceRegistry()
    registry.register(sampleEvidencePackage(), 'cir_001')
    registry.register(sampleEvidencePackage({ videoId: 'test_video_002' }), 'cir_001')
    const found = registry.findBySourceCir('cir_001')
    expect(found.length).toBe(2)
  })

  test('最近 N 条', async () => {
    const registry = new EvidenceRegistry()
    await new Promise(r => setTimeout(r, 5))
    registry.register(sampleEvidencePackage({ videoId: 'v1' }), 'cir_1')
    await new Promise(r => setTimeout(r, 5))
    registry.register(sampleEvidencePackage({ videoId: 'v2' }), 'cir_2')
    const recent = registry.recent(1)
    expect(recent.length).toBe(1)
    expect(recent[0].evidenceId).toBe('v2')
  })

  test('clear 清除所有', () => {
    const registry = new EvidenceRegistry()
    registry.register(sampleEvidencePackage(), 'cir_001')
    registry.clear()
    expect(registry.size).toBe(0)
  })
})
