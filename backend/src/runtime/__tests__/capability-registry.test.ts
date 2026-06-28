/**
 * Capability Registry 测试
 *
 * P1.3.1: 验证 Registry 作为 SSOT 的完整性和正确性。
 *
 * 路径说明：此文件在 src/runtime/__tests__/，benchmarks/ 在项目根（../../../benchmarks/）
 */

import { describe, test, expect } from 'vitest'
import { CapabilityRegistry, validateRegistry } from '../../../benchmarks/capabilities/index.js'

describe('CapabilityRegistry — 基本查询', () => {
  test('all 返回所有已注册能力', () => {
    const all = CapabilityRegistry.all
    expect(all.length).toBeGreaterThan(20)
    expect(all.every((c: any) => c.id && c.group && c.stage)).toBe(true)
  })

  test('byId 返回特定能力', () => {
    const cap = CapabilityRegistry.byId('CAMERA_PATH')
    expect(cap).toBeDefined()
    expect(cap!.name).toBe('Camera Path')
    expect(cap!.group).toBe('camera')
  })

  test('byId 返回 undefined 对于不存在的 ID', () => {
    expect(CapabilityRegistry.byId('NON_EXISTENT')).toBeUndefined()
  })

  test('byGroup 返回分组能力', () => {
    const cameraCaps = CapabilityRegistry.byGroup('camera')
    expect(cameraCaps.length).toBeGreaterThanOrEqual(3)
    expect(cameraCaps.every((c: any) => c.group === 'camera')).toBe(true)
  })

  test('byStage 返回阶段能力', () => {
    const rendererCaps = CapabilityRegistry.byStage('renderer')
    expect(rendererCaps.length).toBeGreaterThanOrEqual(5)
    expect(rendererCaps.every((c: any) => c.stage === 'renderer')).toBe(true)
  })

  test('byDifficulty 返回难度分级能力', () => {
    const l0Caps = CapabilityRegistry.byDifficulty('L0')
    expect(l0Caps.length).toBeGreaterThanOrEqual(3)
    expect(l0Caps.every((c: any) => c.difficulty === 'L0')).toBe(true)
  })
})

describe('CapabilityRegistry — 高级查询', () => {
  test('query 支持多条件筛选', () => {
    const result = CapabilityRegistry.query({
      stage: 'planner',
      difficulty: 'L2',
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((c: any) => c.stage === 'planner' && c.difficulty === 'L2')).toBe(true)
  })

  test('query 按 ID 列表筛选', () => {
    const result = CapabilityRegistry.query({
      ids: ['CAMERA_PATH', 'CHARACTER_REFERENCE', 'NON_EXISTENT'],
    })
    expect(result.length).toBe(2)
    expect(result.map((c: any) => c.id)).toContain('CAMERA_PATH')
  })

  test('exists 检查', () => {
    expect(CapabilityRegistry.exists('CAMERA_PATH')).toBe(true)
    expect(CapabilityRegistry.exists('FUTURE_CAP')).toBe(false)
  })

  test('listIds 返回所有 ID', () => {
    const ids = CapabilityRegistry.listIds()
    expect(ids.length).toBe(CapabilityRegistry.all.length)
    expect(ids).toContain('CAMERA_PATH')
    expect(ids).toContain('RENDER_SHOT')
  })
})

describe('CapabilityRegistry — 元信息', () => {
  test('listGroups 列出所有分组', () => {
    const groups = CapabilityRegistry.listGroups()
    expect(groups).toContain('camera')
    expect(groups).toContain('spatial')
    expect(groups).toContain('temporal')
  })

  test('countByGroup 按分组统计', () => {
    const counts = CapabilityRegistry.countByGroup()
    expect(counts.camera).toBeGreaterThanOrEqual(3)
    expect(counts.character).toBeGreaterThanOrEqual(3)
    expect(counts.render).toBeGreaterThanOrEqual(3)
  })

  test('countByDifficulty 按难度统计', () => {
    const counts = CapabilityRegistry.countByDifficulty()
    expect(counts.L0).toBeGreaterThanOrEqual(3)
    expect(counts.L2).toBeGreaterThan(counts.L3)
  })

  test('dependencyGraph 返回依赖图', () => {
    const graph = CapabilityRegistry.dependencyGraph()
    expect(graph.size).toBe(CapabilityRegistry.all.length)
    const cameraMotionDeps = graph.get('CAMERA_MOTION')
    expect(cameraMotionDeps).toContain('CAMERA_PATH')
  })
})

describe('CapabilityRegistry — 完整性验证', () => {
  test('整个 Registry 验证通过且无错误', () => {
    const result = validateRegistry(CapabilityRegistry)
    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(0)
    expect(result.warnings).toBeDefined()
  })

  test('6 项基础能力必须存在', () => {
    const required = [
      'CHARACTER_REFERENCE',
      'RENDER_SHOT',
      'RENDER_KEYFRAME',
      'SPATIAL_LAYOUT',
      'TEMPORAL_CONSISTENCY',
      'SHOT_TRANSITION',
    ]
    for (const id of required) {
      expect(CapabilityRegistry.byId(id)).toBeDefined()
    }
  })

  test('Camera 分组依赖链合理', () => {
    const cameraPath = CapabilityRegistry.byId('CAMERA_PATH')!
    expect(cameraPath.dependencies).toContain('SHOT_TRANSITION')
  })
})
