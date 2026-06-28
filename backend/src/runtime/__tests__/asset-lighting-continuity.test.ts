/**
 * LIGHTING_CONTINUITY Asset 验证 — Wave 2 首项
 */

import { describe, test, expect } from 'vitest'
import { readAsset, validateAsset } from '../../../benchmarks/assets/AssetFactory.js'

describe('L2-LIGHTING_CONTINUITY Asset', () => {
  test('Asset 文件可读取', () => {
    const asset = readAsset('L2-LIGHTING_CONTINUITY')
    expect(asset).not.toBeNull()
  })

  test('metadata 正确', () => {
    const asset = readAsset('L2-LIGHTING_CONTINUITY')!
    expect(asset.metadata.id).toBe('L2-LIGHTING_CONTINUITY')
    expect(asset.metadata.primaryCapability).toBe('LIGHT_CONTINUITY')
    expect(asset.metadata.cinematicIntent).toBe('establish_intimate_evening_mood')
    expect(asset.metadata.lightingIntent).toBe('soft_warm_side_light')
    expect(asset.metadata.visualIntent).toBe('cozy_natural_realism')
  })

  test('failureModes 含六种分类', () => {
    const asset = readAsset('L2-LIGHTING_CONTINUITY')!
    const cats = asset.failureModes.map(fm => fm.category)
    expect(cats).toContain('lighting_direction_changed')
    expect(cats).toContain('exposure_jump')
    expect(cats).toContain('color_temperature_shift')
    expect(cats).toContain('shadow_inconsistent')
    expect(cats).toContain('illumination_break')
    expect(cats).toContain('intent_mismatch')
  })

  test('evaluationCriteria 含 intentType', () => {
    const asset = readAsset('L2-LIGHTING_CONTINUITY')!
    const intentTypes = asset.evaluationCriteria.map(ec => ec.intentType)
    expect(intentTypes).toContain('cinematic')
    expect(intentTypes).toContain('lighting')
    expect(intentTypes).toContain('visual')
    expect(intentTypes).toContain('technical')
  })

  test('evaluationCriteria weight 之和为 1', () => {
    const asset = readAsset('L2-LIGHTING_CONTINUITY')!
    const sum = asset.evaluationCriteria.reduce((s, c) => s + c.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01)
  })

  test('goldReference 含 intent 和 lightingSetup', () => {
    const asset = readAsset('L2-LIGHTING_CONTINUITY')!
    expect(asset.goldReference!.cinematicIntent).toBe('establish_intimate_evening_mood')
    expect(asset.goldReference!.expectedPlanning.lightingSetup).toBeDefined()
    expect(asset.goldReference!.expectedPlanning.lightingSetup.keyLight.direction).toBe('left')
  })

  test('goldReference 含 intentAlignment', () => {
    const asset = readAsset('L2-LIGHTING_CONTINUITY')!
    expect(asset.goldReference!.expectedPlanning.intentAlignment).toBeDefined()
    expect(asset.goldReference!.expectedPlanning.intentAlignment.intimate_mood).toBeDefined()
  })

  test('通过 Quality Gate', () => {
    const asset = readAsset('L2-LIGHTING_CONTINUITY')!
    const errors = validateAsset(asset)
    expect(errors).toEqual([])
  })
})
