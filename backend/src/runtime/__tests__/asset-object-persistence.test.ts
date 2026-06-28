/**
 * OBJECT_PERSISTENCE Asset 验证 — 身份保持
 */

import { describe, test, expect } from 'vitest'
import { readAsset, validateAsset } from '../../../benchmarks/assets/AssetFactory.js'

describe('L2-OBJECT_PERSISTENCE Asset', () => {
  test('Asset 文件可读取', () => {
    const asset = readAsset('L2-OBJECT_PERSISTENCE')
    expect(asset).not.toBeNull()
  })

  test('metadata 正确', () => {
    const asset = readAsset('L2-OBJECT_PERSISTENCE')!
    expect(asset.metadata.id).toBe('L2-OBJECT_PERSISTENCE')
    expect(asset.metadata.primaryCapability).toBe('OBJECT_PERSISTENCE')
    expect(asset.metadata.secondaryCapabilities).toContain('SPATIAL_LAYOUT')
    expect(asset.metadata.secondaryCapabilities).toContain('RENDER_MULTI_SHOT')
  })

  test('failureModes 含六种分类', () => {
    const asset = readAsset('L2-OBJECT_PERSISTENCE')!
    const categories = asset.failureModes.map(fm => fm.category)
    expect(categories).toContain('object_removed')
    expect(categories).toContain('object_inserted')
    expect(categories).toContain('identity_changed')
    expect(categories).toContain('geometry_changed')
    expect(categories).toContain('appearance_changed')
    expect(categories).toContain('count_changed')
  })

  test('evaluationCriteria weight 之和为 1', () => {
    const asset = readAsset('L2-OBJECT_PERSISTENCE')!
    const sum = asset.evaluationCriteria.reduce((s, c) => s + c.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01)
  })

  test('goldReference 含四种 Case', () => {
    const asset = readAsset('L2-OBJECT_PERSISTENCE')!
    expect(asset.goldReference!.expectedPlanning.cases.length).toBe(4)
    expect(asset.goldReference!.expectedPlanning.cases.map(c => c.id))
      .toEqual(['case1-deletion', 'case2-insertion', 'case3-identity', 'case4-geometry'])
  })

  test('每个 Case 有 persistentObjects', () => {
    const asset = readAsset('L2-OBJECT_PERSISTENCE')!
    for (const c of asset.goldReference!.expectedPlanning.cases) {
      expect(c.persistentObjects.length).toBeGreaterThanOrEqual(1)
    }
  })

  test('通过 Quality Gate', () => {
    const asset = readAsset('L2-OBJECT_PERSISTENCE')!
    const errors = validateAsset(asset)
    expect(errors).toEqual([])
  })

  test('四个 input 文件存在', () => {
    const fs = require('fs')
    const base = require('path').resolve(process.cwd(), 'benchmarks/assets/datasets/L2-OBJECT_PERSISTENCE/input')
    for (const caseName of ['case1-deletion', 'case2-insertion', 'case3-identity', 'case4-geometry']) {
      expect(fs.existsSync(`${base}/${caseName}/narrative.json`)).toBe(true)
    }
  })
})
