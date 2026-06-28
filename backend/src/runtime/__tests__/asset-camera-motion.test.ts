/**
 * CAMERA_MOTION Asset 验证
 */

import { describe, test, expect } from 'vitest'
import { readAsset, validateAsset } from '../../../benchmarks/assets/AssetFactory.js'

describe('L2-CAMERA_MOTION Asset', () => {
  test('Asset 文件可读取', () => {
    const asset = readAsset('L2-CAMERA_MOTION')
    expect(asset).not.toBeNull()
  })

  test('metadata 正确', () => {
    const asset = readAsset('L2-CAMERA_MOTION')!
    expect(asset.metadata.id).toBe('L2-CAMERA_MOTION')
    expect(asset.metadata.primaryCapability).toBe('CAMERA_MOTION')
    expect(asset.metadata.secondaryCapabilities).toEqual(['CAMERA_PATH', 'TEMPORAL_CONSISTENCY'])
    expect(asset.metadata.difficulty).toBe('L2')
  })

  test('failureModes 完整', () => {
    const asset = readAsset('L2-CAMERA_MOTION')!
    expect(asset.failureModes.length).toBeGreaterThanOrEqual(3)
    for (const fm of asset.failureModes) {
      expect(fm.description).toBeTruthy()
      expect(fm.expectedBehavior).toBeTruthy()
    }
  })

  test('evaluationCriteria weight 之和为 1', () => {
    const asset = readAsset('L2-CAMERA_MOTION')!
    const sum = asset.evaluationCriteria.reduce((s, c) => s + c.weight, 0)
    expect(Math.abs(sum - 1)).toBeLessThanOrEqual(0.01)
  })

  test('goldReference 含 4 种运动模式', () => {
    const asset = readAsset('L2-CAMERA_MOTION')!
    expect(asset.goldReference).toBeDefined()
    expect(asset.goldReference!.expectedPlanning.motionSegments.length).toBe(4)
    expect(asset.goldReference!.expectedPlanning.motionSegments.map(s => s.mode))
      .toEqual(['push-in', 'pull-out', 'pan', 'orbit'])
  })

  test('通过 Quality Gate', () => {
    const asset = readAsset('L2-CAMERA_MOTION')!
    const errors = validateAsset(asset)
    expect(errors).toEqual([])
  })

  test('input 文件存在', () => {
    const fs = require('fs')
    const base = require('path').resolve(process.cwd(), 'benchmarks/assets/datasets/L2-CAMERA_MOTION/input')
    expect(fs.existsSync(base + '/narrative.json')).toBe(true)
    expect(fs.existsSync(base + '/v3.json')).toBe(true)
  })

  test('与 CAMERA_PATH 能力互斥', () => {
    const assetCp = readAsset('L2-CAMERA_PATH')!
    const assetCm = readAsset('L2-CAMERA_MOTION')!
    // CAMERA_MOTION is asset for CAMERA_PATH, not the reverse
    expect(assetCm.metadata.primaryCapability).toBe('CAMERA_MOTION')
    expect(assetCp.metadata.primaryCapability).toBe('CAMERA_PATH')
    // CAMERA_PATH is a secondary in CAMERA_MOTION, mot the primary
    expect(assetCm.metadata.secondaryCapabilities).toContain('CAMERA_PATH')
    expect(assetCp.metadata.secondaryCapabilities).not.toContain('CAMERA_MOTION')
  })
})
