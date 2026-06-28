/**
 * SPATIAL_RELATION Asset 验证 — 拓扑关系保持
 */

import { describe, test, expect } from 'vitest'
import { readAsset, validateAsset } from '../../../benchmarks/assets/AssetFactory.js'

describe('L2-SPATIAL_RELATION Asset', () => {
  test('Asset 文件可读取', () => {
    const asset = readAsset('L2-SPATIAL_RELATION')
    expect(asset).not.toBeNull()
  })

  test('metadata 正确', () => {
    const asset = readAsset('L2-SPATIAL_RELATION')!
    expect(asset.metadata.id).toBe('L2-SPATIAL_RELATION')
    expect(asset.metadata.primaryCapability).toBe('SPATIAL_RELATIONSHIP')
    expect(asset.metadata.secondaryCapabilities).toContain('OBJECT_PERSISTENCE')
    expect(asset.metadata.secondaryCapabilities).toContain('TEMPORAL_CONSISTENCY')
  })

  test('failureModes 含五种分类', () => {
    const asset = readAsset('L2-SPATIAL_RELATION')!
    const cats = asset.failureModes.map(fm => fm.category)
    expect(cats).toContain('relation_swapped')
    expect(cats).toContain('impossible_position')
    expect(cats).toContain('containment_lost')
    expect(cats).toContain('ordering_changed')
    expect(cats).toContain('distance_drift')
  })

  test('evaluationCriteria weight 之和为 1', () => {
    const asset = readAsset('L2-SPATIAL_RELATION')!
    const sum = asset.evaluationCriteria.reduce((s, c) => s + c.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01)
  })

  test('goldReference 含四种 Case', () => {
    const asset = readAsset('L2-SPATIAL_RELATION')!
    expect(asset.goldReference!.expectedPlanning.cases.length).toBe(4)
    expect(asset.goldReference!.expectedPlanning.cases.map(c => c.id))
      .toEqual(['case1-relative-position', 'case2-containment', 'case3-distance', 'case4-ordering'])
  })

  test('每个 Case 有拓扑约束', () => {
    const asset = readAsset('L2-SPATIAL_RELATION')!
    for (const c of asset.goldReference!.expectedPlanning.cases) {
      expect(c.topologicalConstraints).toBeTruthy()
    }
  })

  test('通过 Quality Gate', () => {
    const asset = readAsset('L2-SPATIAL_RELATION')!
    const errors = validateAsset(asset)
    expect(errors).toEqual([])
  })
})
