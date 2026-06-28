/**
 * TEMPORAL_CONTINUITY Asset 验证 — 时间连续性
 */

import { describe, test, expect } from 'vitest'
import { readAsset, validateAsset } from '../../../benchmarks/assets/AssetFactory.js'

describe('L2-TEMPORAL_CONTINUITY Asset', () => {
  test('Asset 文件可读取', () => {
    const asset = readAsset('L2-TEMPORAL_CONTINUITY')
    expect(asset).not.toBeNull()
  })

  test('metadata 正确', () => {
    const asset = readAsset('L2-TEMPORAL_CONTINUITY')!
    expect(asset.metadata.id).toBe('L2-TEMPORAL_CONTINUITY')
    expect(asset.metadata.primaryCapability).toBe('TEMPORAL_CONSISTENCY')
    expect(asset.metadata.secondaryCapabilities).toContain('OBJECT_PERSISTENCE')
    expect(asset.metadata.secondaryCapabilities).toContain('SPATIAL_RELATIONSHIP')
    expect(asset.metadata.secondaryCapabilities).toContain('CAMERA_MOTION')
    // CAMERA_PATH deliberately excluded to avoid overlap
    expect(asset.metadata.secondaryCapabilities).not.toContain('CAMERA_PATH')
  })

  test('failureModes 含五种分类', () => {
    const asset = readAsset('L2-TEMPORAL_CONTINUITY')!
    const cats = asset.failureModes.map(fm => fm.category)
    expect(cats).toContain('state_regression')
    expect(cats).toContain('action_jump')
    expect(cats).toContain('event_reorder')
    expect(cats).toContain('attribute_reset')
    expect(cats).toContain('unexplained_time_skip')
  })

  test('evaluationCriteria weight 之和为 1', () => {
    const asset = readAsset('L2-TEMPORAL_CONTINUITY')!
    const sum = asset.evaluationCriteria.reduce((s, c) => s + c.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01)
  })

  test('goldReference 含五种 Case', () => {
    const asset = readAsset('L2-TEMPORAL_CONTINUITY')!
    expect(asset.goldReference!.expectedPlanning.cases.length).toBe(5)
    expect(asset.goldReference!.expectedPlanning.cases.map(c => c.id))
      .toEqual([
        'case1-state-progression',
        'case2-action-continuity',
        'case3-event-ordering',
        'case4-attribute-evolution',
        'case5-temporal-gap',
      ])
  })

  test('每种 Case 有对应的时间约束', () => {
    const asset = readAsset('L2-TEMPORAL_CONTINUITY')!
    const cases = asset.goldReference!.expectedPlanning.cases
    expect(cases[0].stateProgression).toBeDefined()
    expect(cases[1].actionProgression).toBeDefined()
    expect(cases[2].eventOrdering).toBeDefined()
    expect(cases[3].attributeEvolution).toBeDefined()
    expect(cases[4].temporalTransition).toBeDefined()
  })

  test('通过 Quality Gate', () => {
    const asset = readAsset('L2-TEMPORAL_CONTINUITY')!
    const errors = validateAsset(asset)
    expect(errors).toEqual([])
  })
})
