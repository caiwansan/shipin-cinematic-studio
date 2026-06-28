/**
 * CAMERA_COMPOSITION Asset 验证 — Wave 2 核心数据
 */

import { describe, test, expect } from 'vitest'
import { readAsset, validateAsset } from '../../../benchmarks/assets/AssetFactory.js'

describe('L2-CAMERA_COMPOSITION Asset', () => {
  test('Asset 文件可读取', () => {
    const asset = readAsset('L2-CAMERA_COMPOSITION')
    expect(asset).not.toBeNull()
  })

  test('metadata 正确', () => {
    const asset = readAsset('L2-CAMERA_COMPOSITION')!
    expect(asset.metadata.id).toBe('L2-CAMERA_COMPOSITION')
    expect(asset.metadata.primaryCapability).toBe('CAMERA_COMPOSITION')
    expect(asset.metadata.cinematicIntent).toBe('emphasize_character_isolation')
    expect(asset.metadata.compositionRule).toBe('rule_of_thirds')
    expect(asset.metadata.visualIntent).toBe('wide_open_composition')
  })

  test('failureModes 含七种分类', () => {
    const asset = readAsset('L2-CAMERA_COMPOSITION')!
    const cats = asset.failureModes.map(fm => fm.category)
    expect(cats).toContain('subject_off_target')
    expect(cats).toContain('bad_headroom')
    expect(cats).toContain('insufficient_lookroom')
    expect(cats).toContain('composition_unbalanced')
    expect(cats).toContain('important_occlusion')
    expect(cats).toContain('intent_occlusion_break')
    expect(cats).toContain('intent_composition_mismatch')
  })

  test('evaluationCriteria weight 之和为 1', () => {
    const asset = readAsset('L2-CAMERA_COMPOSITION')!
    const sum = asset.evaluationCriteria.reduce((s, c) => s + c.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01)
  })

  test('goldReference 含 compositionSetup', () => {
    const asset = readAsset('L2-CAMERA_COMPOSITION')!
    expect(asset.goldReference!.expectedPlanning.compositionSetup).toBeDefined()
    expect(asset.goldReference!.expectedPlanning.compositionSetup.rule).toBe('rule_of_thirds')
    expect(asset.goldReference!.expectedPlanning.compositionSetup.subjectPosition).toBe('left_third')
  })

  test('goldReference 含 lookRoom 约束', () => {
    const asset = readAsset('L2-CAMERA_COMPOSITION')!
    // shot 1 gaze direction right
    const shot1 = asset.goldReference!.expectedPlanning.shots[0]
    expect(shot1.compositionConstraints.lookRoomDirection).toBe('right')
    expect(shot1.compositionConstraints.lookRoomPercent).toBeGreaterThanOrEqual(30)
  })

  test('goldReference 含 intentAlignment', () => {
    const asset = readAsset('L2-CAMERA_COMPOSITION')!
    expect(asset.goldReference!.expectedPlanning.compositionSetup.intentAlignment).toBeDefined()
    expect(asset.goldReference!.expectedPlanning.compositionSetup.intentAlignment.isolation).toBeDefined()
  })

  test('通过 Quality Gate', () => {
    const asset = readAsset('L2-CAMERA_COMPOSITION')!
    const errors = validateAsset(asset)
    expect(errors).toEqual([])
  })
})
