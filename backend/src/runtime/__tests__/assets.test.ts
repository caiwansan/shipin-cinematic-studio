/**
 * Capability Assets — 测试
 *
 * P1.4: Asset 工厂 + Backlog 生成器 + 质量门禁
 */

import { describe, test, expect } from 'vitest'
import { generateBacklog, formatBacklog, formatBacklogCSV } from '../../../benchmarks/assets/index.js'
import { createAsset, writeAsset, readAsset, validateAsset } from '../../../benchmarks/assets/AssetFactory.js'
import type { CapabilityAsset } from '../../../benchmarks/assets/AssetTypes.js'

describe('Backlog 生成', () => {
  test('generateBacklog 返回待办列表', () => {
    const backlog = generateBacklog()
    expect(backlog.length).toBeGreaterThan(0)
  })

  test('P0 排在 P1/P2 之前', () => {
    const backlog = generateBacklog()
    const priorities = backlog.map(b => b.priority)
    const firstP1 = priorities.indexOf('P1')
    const lastP0 = priorities.lastIndexOf('P0')
    // P0 all before P1
    if (firstP1 !== -1 && lastP0 !== -1) {
      expect(lastP0).toBeLessThan(firstP1)
    }
  })

  test('每条 Backlog 有 suggestedId', () => {
    const backlog = generateBacklog()
    for (const b of backlog) {
      expect(b.suggestedId).toBeTruthy()
      expect(b.capability).toBeTruthy()
      expect(b.group).toBeTruthy()
    }
  })

  test('formatBacklog 输出 Markdown', () => {
    const backlog = generateBacklog()
    const md = formatBacklog(backlog)
    expect(md).toContain('Capability Backlog')
    expect(md).toContain('P0')
    expect(md).toContain('Suggested ID')
  })

  test('formatBacklogCSV 输出 CSV', () => {
    const backlog = generateBacklog()
    const csv = formatBacklogCSV(backlog)
    expect(csv).toContain('Priority,Capability')
    const lines = csv.split('\n')
    expect(lines.length).toBe(backlog.length + 1) // header + data
  })
})

describe('Asset 工厂', () => {
  const validMetadata = {
    id: 'L2-TEST',
    primaryCapability: 'CAMERA_PATH',
    secondaryCapabilities: ['CAMERA_COMPOSITION', 'TEMPORAL_CONSISTENCY'],
    difficulty: 'L2',
    stage: 'planner',
    name: 'Test Camera Path',
    description: 'A camera path test dataset',
    scenario: 'A camera follows a moving character through a forest.',
  }

  const validFailureModes = [
    { id: 'FM-001', description: 'Camera path jitters', expectedBehavior: 'Camera motion should be smooth', severity: 'high' as const },
    { id: 'FM-002', description: 'Camera clips through geometry', expectedBehavior: 'Camera should avoid collisions', severity: 'medium' as const },
  ]

  const validCriteria = [
    { id: 'EC-001', name: 'Smoothness', description: 'Camera trajectory smoothness', weight: 0.6, passThreshold: 80 },
    { id: 'EC-002', name: 'Collision Avoidance', description: 'No geometry clipping', weight: 0.4, passThreshold: 90 },
  ]

  test('createAsset 成功创建有效 Asset', () => {
    const asset = createAsset(validMetadata, validFailureModes, validCriteria)
    expect(asset.metadata.id).toBe('L2-TEST')
    expect(asset.failureModes.length).toBe(2)
    expect(asset.evaluationCriteria.length).toBe(2)
  })

  test('createAsset 拒绝未知 primaryCapability', () => {
    expect(() => createAsset(
      { ...validMetadata, primaryCapability: 'NON_EXISTENT' },
      validFailureModes,
      validCriteria,
    )).toThrow('Unknown primaryCapability')
  })

  test('createAsset 拒绝未知 secondaryCapability', () => {
    expect(() => createAsset(
      { ...validMetadata, secondaryCapabilities: ['NON_EXISTENT'] },
      validFailureModes,
      validCriteria,
    )).toThrow('Unknown secondaryCapability')
  })

  test('createAsset 拒绝空的 failureModes', () => {
    expect(() => createAsset(validMetadata, [], validCriteria)).toThrow('failureModes must not be empty')
  })

  test('createAsset 拒绝空的 evaluationCriteria', () => {
    expect(() => createAsset(validMetadata, validFailureModes, [])).toThrow('evaluationCriteria must not be empty')
  })

  test('validateAsset 通过有效资产', () => {
    const asset = createAsset(validMetadata, validFailureModes, validCriteria)
    const errors = validateAsset(asset)
    expect(errors.length).toBe(0)
  })

  test('validateAsset 检测缺失 primaryCapability', () => {
    const asset = createAsset(validMetadata, validFailureModes, validCriteria)
    const badAsset: CapabilityAsset = {
      ...asset,
      metadata: { ...asset.metadata, primaryCapability: '' as any },
    }
    const errors = validateAsset(badAsset)
    expect(errors.some(e => e.includes('Missing primaryCapability'))).toBe(true)
  })

  test('validateAsset 检测 weight 之和不为 1', () => {
    const asset = createAsset(
      validMetadata,
      validFailureModes,
      [{ id: 'EC-001', name: 'Only One', description: 'Single criterion', weight: 0.5, passThreshold: 80 }],
    )
    const errors = validateAsset(asset)
    expect(errors.some(e => e.includes('weights sum'))).toBe(true)
  })

  test('writeAsset 写出文件，readAsset 读取', () => {
    const asset = createAsset(
      { ...validMetadata, id: 'L2-WRITETEST' },
      validFailureModes,
      validCriteria,
      { input: 'some prompt', expectedPlanning: {}, expectedNegotiation: {}, expectedRuntime: {}, expectedEvaluation: {} },
    )
    const dir = writeAsset(asset)
    const loaded = readAsset('L2-WRITETEST')
    expect(loaded).not.toBeNull()
    expect(loaded!.metadata.id).toBe('L2-WRITETEST')
    expect(loaded!.failureModes.length).toBe(2)
    expect(loaded!.goldReference).toBeDefined()
  })
})
