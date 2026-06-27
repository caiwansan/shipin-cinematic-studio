/**
 * Capability Negotiator 测试
 *
 * 验证：
 *   ① 环境完全支持 → 全部保留
 *   ② 环境不支持 → 使用降级策略
 *   ③ Negotiator Never Invents Capability
 *   ④ 协商记录可 Replay
 *   ⑤ 纯函数、确定性
 */

import { describe, test, expect } from 'vitest'
import { negotiate, createNegotiationRecord, CapabilityIds } from '../../runtime/capability-negotiator.js'
import type { ExecutionEnvironmentCapabilities } from '../../runtime/capability-negotiator.js'
import type { CapabilityPlan } from '../../runtime/capability-planner.js'

// ─── 测试数据 ──────────────────────────────────────────

const FULL_ENV: ExecutionEnvironmentCapabilities = {
  environmentId: 'test-full',
  environmentVersion: '1.0',
  supportsParallel: true,
  capabilities: {
    [CapabilityIds.CHARACTER_REFERENCE]: { level: 'full' },
    [CapabilityIds.CAMERA_PATH]: { level: 'full' },
    [CapabilityIds.KEYFRAME]: { level: 'full' },
    [CapabilityIds.PHYSICS_CONSTRAINT]: { level: 'full' },
    [CapabilityIds.LIP_SYNC]: { level: 'full' },
    [CapabilityIds.TEMPORAL_CONSISTENCY]: { level: 'full' },
    [CapabilityIds.LIGHTING_CONTROL]: { level: 'full' },
    [CapabilityIds.STYLE_TRANSFER]: { level: 'full' },
    [CapabilityIds.SPATIAL_LAYOUT]: { level: 'full' },
  },
}

const MINIMAL_ENV: ExecutionEnvironmentCapabilities = {
  environmentId: 'test-minimal',
  environmentVersion: '0.1',
  supportsParallel: false,
  capabilities: {
    [CapabilityIds.CHARACTER_REFERENCE]: { level: 'full' },
    [CapabilityIds.KEYFRAME]: { level: 'partial' },
    // 其他未声明 → unknown
  },
}

const TEST_PLAN: CapabilityPlan = {
  id: 'test_plan_001',
  shots: [
    {
      shotId: 'shot_01',
      needs: {
        character_reference: 'full',
        camera_path: 'full',
        keyframe: 'full',
        physics_constraint: 'full',
        lip_sync: 'full',
        temporal_consistency: 'full',
        lighting_control: 'full',
        style_transfer: 'full',
        spatial_layout: 'full',
      },
      rationale: ['测试'],
    },
  ],
  metadata: { totalShots: 1, maxConcurrency: 1, createdAt: '2026-01-01T00:00:00Z', sourceGraphId: 'test' },
}

describe('Capability Negotiator', () => {
  test('full 环境 → 全部保留', () => {
    const result = negotiate(TEST_PLAN, FULL_ENV)
    expect(result.metadata.overallFeasibility).toBe('feasible')
    expect(result.metadata.feasibleShots).toBe(1)
    for (const shot of result.shots) {
      for (const cap of shot.capabilities) {
        expect(cap.resolved).toBe(cap.requested)
        expect(cap.confidence).toBe(1.0)
      }
    }
  })

  test('minimal 环境 → 降级', () => {
    const result = negotiate(TEST_PLAN, MINIMAL_ENV)
    expect(result.metadata.overallFeasibility).toBe('degraded')
    expect(result.metadata.feasibleShots).toBe(0)
    expect(result.metadata.degradedShots).toBe(1)
    // camera_path 完全不支持，应该有 fallback
    const cameraCap = result.shots[0].capabilities.find(c => c.capabilityId === CapabilityIds.CAMERA_PATH)
    expect(cameraCap).toBeDefined()
    expect(cameraCap!.fallback).not.toBeNull()
    expect(cameraCap!.resolved).toBe('partial') // fallback 补偿
    expect(cameraCap!.confidence).toBeLessThan(1.0)
  })

  test('Negotiator Never Invents Capability', () => {
    // 输出中的 capabilityId 必须都来自输入的能力集
    const result = negotiate(TEST_PLAN, FULL_ENV)
    const capabilityIdsFromOutput = new Set(
      result.shots.flatMap(s => s.capabilities.map(c => c.capabilityId)),
    )
    // 所有输出能力都应该是 KNEW_TO_ID 中存在的
    const knownIds = new Set(Object.values(CapabilityIds))
    for (const id of capabilityIdsFromOutput) {
      expect(knownIds.has(id as any)).toBe(true)
    }
  })

  test('协商记录可 Replay', () => {
    const result = negotiate(TEST_PLAN, FULL_ENV)
    const record = createNegotiationRecord(TEST_PLAN, FULL_ENV, result)
    expect(record.input.id).toBe(TEST_PLAN.id)
    expect(record.environment.environmentId).toBe('test-full')
    expect(record.output.metadata.overallFeasibility).toBe('feasible')
    expect(record.timestamp).toBeTruthy()
    // 验证可以序列化/反序列化（JSON 可序列化）
    const json = JSON.parse(JSON.stringify(record))
    expect(json.input.id).toBe('test_plan_001')
  })

  test('确定性：相同输入产生相同输出', () => {
    const a = negotiate(TEST_PLAN, FULL_ENV)
    const b = negotiate(TEST_PLAN, FULL_ENV)
    expect(a.metadata.overallFeasibility).toBe(b.metadata.overallFeasibility)
    expect(a.shots.length).toBe(b.shots.length)
  })

  test('纯函数：不修改输入', () => {
    const originalPlan = JSON.parse(JSON.stringify(TEST_PLAN))
    negotiate(TEST_PLAN, FULL_ENV)
    expect(TEST_PLAN.id).toBe(originalPlan.id)
    expect(TEST_PLAN.shots.length).toBe(originalPlan.shots.length)
  })

    test('none capabilities are skipped during negotiation', () => {
    const planWithNone: CapabilityPlan = {
      id: 'test_none',
      shots: [{
        shotId: 'shot_none',
        needs: {
          character_reference: 'none',
          camera_path: 'none',
          keyframe: 'none',
          physics_constraint: 'none',
          lip_sync: 'none',
          temporal_consistency: 'none',
          lighting_control: 'none',
          style_transfer: 'none',
          spatial_layout: 'none',
        },
        rationale: ['全部不需要'],
      }],
      metadata: { totalShots: 1, maxConcurrency: 0, createdAt: '', sourceGraphId: '' },
    }
    const result = negotiate(planWithNone, FULL_ENV)
    expect(result.shots[0].capabilities.length).toBe(0)
    expect(result.shots[0].overallFeasibility).toBe('feasible')
  })
})
