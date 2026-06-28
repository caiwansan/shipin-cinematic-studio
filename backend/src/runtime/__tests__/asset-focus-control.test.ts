/**
 * FOCUS_CONTROL Asset 验证 — Wave 2 压轴
 */

import { describe, test, expect } from 'vitest'
import { readAsset, validateAsset } from '../../../benchmarks/assets/AssetFactory.js'

describe('L2-FOCUS_CONTROL Asset', () => {
  test('Asset 文件可读取', () => {
    const asset = readAsset('L2-FOCUS_CONTROL')
    expect(asset).not.toBeNull()
  })

  test('metadata 正确', () => {
    const asset = readAsset('L2-FOCUS_CONTROL')!
    expect(asset.metadata.id).toBe('L2-FOCUS_CONTROL')
    expect(asset.metadata.primaryCapability).toBe('CAMERA_FOCUS')
    expect(asset.metadata.storyIntent).toBe('reveal_clue_through_focus_shift')
    expect(asset.metadata.cinematicIntent).toBe('direct_attention')
    expect(asset.metadata.focusStrategy).toBe('subject_face_to_background_detail')
  })

  test('failureModes 含六种分类', () => {
    const asset = readAsset('L2-FOCUS_CONTROL')!
    const cats = asset.failureModes.map(fm => fm.category)
    expect(cats).toContain('incorrect_focus_target')
    expect(cats).toContain('rack_focus_failed')
    expect(cats).toContain('depth_of_field_mismatch')
    expect(cats).toContain('attention_not_guided')
    expect(cats).toContain('focus_jump')
    expect(cats).toContain('focus_intent_mismatch')
  })

  test('evaluationCriteria weight 之和为 1', () => {
    const asset = readAsset('L2-FOCUS_CONTROL')!
    const sum = asset.evaluationCriteria.reduce((s, c) => s + c.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01)
  })

  test('goldReference 含 focusSetup', () => {
    const asset = readAsset('L2-FOCUS_CONTROL')!
    expect(asset.goldReference!.expectedPlanning.focusSetup).toBeDefined()
    expect(asset.goldReference!.expectedPlanning.focusSetup.initialFocus).toBe('subject_face')
    expect(asset.goldReference!.expectedPlanning.focusSetup.targetFocus).toBe('photograph_in_background')
  })

  test('goldReference 含 rackTiming', () => {
    const asset = readAsset('L2-FOCUS_CONTROL')!
    expect(asset.goldReference!.expectedPlanning.rackTiming).toBeDefined()
    expect(asset.goldReference!.expectedPlanning.rackTiming.cue).toBe('dialogue_reference_to_clue')
  })

  test('shots 含 focusConstraints', () => {
    const asset = readAsset('L2-FOCUS_CONTROL')!
    for (const shot of asset.goldReference!.expectedPlanning.shots) {
      expect(shot.focusConstraints).toBeDefined()
      expect(shot.focusConstraints.expectedFocusSubject).toBeDefined()
    }
  })

  test('通过 Quality Gate', () => {
    const asset = readAsset('L2-FOCUS_CONTROL')!
    const errors = validateAsset(asset)
    expect(errors).toEqual([])
  })
})
