/**
 * SHOT_ANGLE Asset 验证 — 机位角度与权力动力学
 */

import { describe, test, expect } from 'vitest'
import { readAsset, validateAsset } from '../../../benchmarks/assets/AssetFactory.js'

describe('L2-SHOT_ANGLE Asset', () => {
  test('Asset 文件可读取', () => {
    const asset = readAsset('L2-SHOT_ANGLE')
    expect(asset).not.toBeNull()
  })

  test('metadata 正确', () => {
    const asset = readAsset('L2-SHOT_ANGLE')!
    expect(asset.metadata.id).toBe('L2-SHOT_ANGLE')
    expect(asset.metadata.storyIntent).toBe('power_shifts_from_dominance_to_equality')
    expect(asset.metadata.cinematicIntent).toBe('power_dynamics')
  })

  test('failureModes 含六种分类', () => {
    const asset = readAsset('L2-SHOT_ANGLE')!
    const cats = asset.failureModes.map(fm => fm.category)
    expect(cats).toContain('incorrect_angle')
    expect(cats).toContain('weak_perspective')
    expect(cats).toContain('power_mismatch')
    expect(cats).toContain('unnecessary_dutch')
    expect(cats).toContain('inconsistent_angle')
    expect(cats).toContain('angle_intent_mismatch')
  })

  test('evaluationCriteria weight 之和为 1', () => {
    const asset = readAsset('L2-SHOT_ANGLE')!
    const sum = asset.evaluationCriteria.reduce((s, c) => s + c.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01)
  })

  test('goldReference 含 angleSequence', () => {
    const asset = readAsset('L2-SHOT_ANGLE')!
    const seq = asset.goldReference!.expectedPlanning.angleSequence
    expect(seq.length).toBe(3)
    expect(seq[0].angle).toBe('high')
    expect(seq[1].angle).toBe('low')
    expect(seq[2].angle).toBe('eye')
  })

  test('goldReference 含 powerArc', () => {
    const asset = readAsset('L2-SHOT_ANGLE')!
    expect(asset.goldReference!.expectedPlanning.powerArc).toBeDefined()
    expect(asset.goldReference!.expectedPlanning.powerArc.start).toContain('dominant')
    expect(asset.goldReference!.expectedPlanning.powerArc.end).toContain('equal')
  })

  test('shots 含 angleConstraints (含 powerExpression)', () => {
    const asset = readAsset('L2-SHOT_ANGLE')!
    for (const shot of asset.goldReference!.expectedPlanning.shots) {
      expect(shot.angleConstraints).toBeDefined()
      expect(shot.angleConstraints.powerExpression).toBeDefined()
    }
  })

  test('通过 Quality Gate', () => {
    const asset = readAsset('L2-SHOT_ANGLE')!
    const errors = validateAsset(asset)
    expect(errors).toEqual([])
  })
})
