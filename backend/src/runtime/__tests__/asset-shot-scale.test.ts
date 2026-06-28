/**
 * SHOT_SCALE Asset 验证 — 景别叙事尺度
 */

import { describe, test, expect } from 'vitest'
import { readAsset, validateAsset } from '../../../benchmarks/assets/AssetFactory.js'

describe('L2-SHOT_SCALE Asset', () => {
  test('Asset 文件可读取', () => {
    const asset = readAsset('L2-SHOT_SCALE')
    expect(asset).not.toBeNull()
  })

  test('metadata 正确', () => {
    const asset = readAsset('L2-SHOT_SCALE')!
    expect(asset.metadata.id).toBe('L2-SHOT_SCALE')
    expect(asset.metadata.cinematicIntent).toBe('build_intimacy')
    expect(asset.metadata.narrativePurpose).toBe('reveal_emotion_progression')
    expect(asset.metadata.visualIntent).toBe('gradual_emotional_intimacy')
  })

  test('failureModes 含六种分类', () => {
    const asset = readAsset('L2-SHOT_SCALE')!
    const cats = asset.failureModes.map(fm => fm.category)
    expect(cats).toContain('incorrect_scale')
    expect(cats).toContain('excessive_crop')
    expect(cats).toContain('subject_too_small')
    expect(cats).toContain('missing_context')
    expect(cats).toContain('emotion_scale_mismatch')
    expect(cats).toContain('abrupt_scale_jump')
  })

  test('evaluationCriteria weight 之和为 1', () => {
    const asset = readAsset('L2-SHOT_SCALE')!
    const sum = asset.evaluationCriteria.reduce((s, c) => s + c.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01)
  })

  test('goldReference 含 scaleSequence', () => {
    const asset = readAsset('L2-SHOT_SCALE')!
    const seq = asset.goldReference!.expectedPlanning.scaleSequence
    expect(seq.length).toBe(3)
    expect(seq[0].scale).toBe('establishing')
    expect(seq[1].scale).toBe('medium')
    expect(seq[2].scale).toBe('close_up')
  })

  test('goldReference 含 transitionIntent', () => {
    const asset = readAsset('L2-SHOT_SCALE')!
    expect(asset.goldReference!.expectedPlanning.transitionIntent).toBeDefined()
    expect(asset.goldReference!.expectedPlanning.transitionIntent.establishing_to_medium).toBeDefined()
  })

  test('shots 含 scaleConstraints', () => {
    const asset = readAsset('L2-SHOT_SCALE')!
    for (const shot of asset.goldReference!.expectedPlanning.shots) {
      expect(shot.scaleConstraints).toBeDefined()
      expect(shot.scaleConstraints.expectedScale).toBeDefined()
    }
  })

  test('通过 Quality Gate', () => {
    const asset = readAsset('L2-SHOT_SCALE')!
    const errors = validateAsset(asset)
    expect(errors).toEqual([])
  })
})
