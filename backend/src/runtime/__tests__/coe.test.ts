/**
 * COE — 测试
 */

import { describe, test, expect } from 'vitest'
import { RecommendationResolver, PatchPlanner, PatchValidator, CinematicOptimizationEngine } from '../coe-engine.js'
import { ScalePatchStrategy, LightingLockPatchStrategy, RegenPatchStrategy, CompositionPatchStrategy, FocusPatchStrategy, MotionPatchStrategy } from '../coe-strategies.js'
import type { Recommendation, CapabilityReport } from '../cee-types.js'

function sampleRec(type: Recommendation['type'], cap: string, priority: Recommendation['priority'] = 'medium', desc = `Fix ${cap}`, suggested?: string): Recommendation {
  return { type, capability: cap, description: desc, priority, suggestedValue: suggested }
}

describe('COE: Layer 1 — Recommendation Resolver', () => {
  test('resolve 单条 recommendation', () => {
    const resolver = new RecommendationResolver()
    const sections = resolver.resolve([sampleRec('adjust', 'SHOT_SCALE', 'high', 'Increase scale', 'close_up')])
    expect(sections.length).toBeGreaterThan(0)
    expect(sections[0].targetCapability).toBe('SHOT_SCALE')
  })

  test('lighting recommendation 产生 safe patch', () => {
    const resolver = new RecommendationResolver()
    const sections = resolver.resolve([sampleRec('add_constraint', 'LIGHT_CONTINUITY', 'medium', 'Lock lighting')])
    expect(sections.length).toBeGreaterThan(0)
    expect(sections[0].type).toBe('safe')
    expect(sections[0].confidence).toBeGreaterThan(0.9)
  })

  test('regen recommendation 产生 recommended patch', () => {
    const resolver = new RecommendationResolver()
    const sections = resolver.resolve([sampleRec('regen', 'OBJECT_PERSISTENCE', 'high', 'Regen with constraints')])
    expect(sections.length).toBeGreaterThan(0)
    expect(sections[0].type).toBe('recommended')
  })
})

describe('COE: Layer 2 — Patch Planner', () => {
  test('无冲突时 plan 正常', () => {
    const resolver = new RecommendationResolver()
    const sections = resolver.resolve([
      sampleRec('add_constraint', 'LIGHT_CONTINUITY', 'medium', 'Lock lighting'),
      sampleRec('adjust', 'SHOT_SCALE', 'high', 'Increase scale', 'close_up'),
    ])
    const planner = new PatchPlanner()
    const plan = planner.plan(sections)
    expect(plan.conflicts.length).toBe(0)
    expect(plan.patches.length).toBeGreaterThan(0)
    expect(plan.applyOrder.length).toBeGreaterThan(0)
  })

  test('冲突检测', () => {
    const planner = new PatchPlanner()
    const sections = [
      { type: 'safe' as const, confidence: 0.9, targetCapability: 'LIGHT_CONTINUITY', fields: [{ path: 'shots[0].scale', from: undefined, to: 'close_up' }], reason: 'a', expectedGain: '+10%' },
      { type: 'recommended' as const, confidence: 0.8, targetCapability: 'SHOT_SCALE', fields: [{ path: 'shots[0].scale', from: undefined, to: 'wide' }], reason: 'b', expectedGain: '+10%' },
    ]
    const plan = planner.plan(sections)
    expect(plan.conflicts.length).toBe(1)
    expect(plan.conflicts[0].path).toBe('shots[0].scale')
  })

  test('冲突裁决保留 safe', () => {
    const planner = new PatchPlanner()
    const sections = [
      { type: 'safe' as const, confidence: 0.9, targetCapability: 'LIGHT_CONTINUITY', fields: [{ path: 'shots[0].scale', from: undefined, to: 'close_up' }], reason: 'a', expectedGain: '+10%' },
      { type: 'experimental' as const, confidence: 0.5, targetCapability: 'SHOT_SCALE', fields: [{ path: 'shots[0].scale', from: undefined, to: 'wide' }], reason: 'b', expectedGain: '+10%' },
    ]
    const plan = planner.plan(sections)
    const scaleField = plan.patches.find(p => p.fields.some(f => f.path === 'shots[0].scale'))
    expect(scaleField).toBeDefined()
    expect(scaleField!.fields.find(f => f.path === 'shots[0].scale')!.to).toBe('close_up')
  })

  test('优先级排序 safe 在前', () => {
    const planner = new PatchPlanner()
    const sections = [
      { type: 'experimental' as const, confidence: 0.5, targetCapability: 'A', fields: [{ path: 'a', from: undefined, to: 1 }], reason: 'x', expectedGain: '+5%' },
      { type: 'safe' as const, confidence: 0.9, targetCapability: 'B', fields: [{ path: 'b', from: undefined, to: 2 }], reason: 'y', expectedGain: '+10%' },
    ]
    const plan = planner.plan(sections)
    expect(plan.patches[0].type).toBe('safe')
    expect(plan.patches[1].type).toBe('experimental')
  })
})

describe('COE: Layer 4 — Patch Validator', () => {
  test('无错误时 valid = true', () => {
    const planner = new PatchPlanner()
    const resolver = new RecommendationResolver()
    const sections = resolver.resolve([sampleRec('add_constraint', 'LIGHT_CONTINUITY')])
    const plan = planner.plan(sections)
    const validator = new PatchValidator()
    const v = validator.validate(plan)
    expect(v.valid).toBe(true)
  })

  test('冲突时 valid = false', () => {
    const planner = new PatchPlanner()
    const sections = [
      { type: 'safe' as const, confidence: 0.9, targetCapability: 'A', fields: [{ path: 'x', from: undefined, to: 'a' }], reason: '1', expectedGain: '+10%' },
      { type: 'recommended' as const, confidence: 0.8, targetCapability: 'B', fields: [{ path: 'x', from: undefined, to: 'b' }], reason: '2', expectedGain: '+10%' },
    ]
    const plan = planner.plan(sections)
    const validator = new PatchValidator()
    const v = validator.validate(plan)
    expect(v.valid).toBe(false)
    expect(v.errors.length).toBeGreaterThan(0)
  })

  test('受影响的 Capability 报告', () => {
    const planner = new PatchPlanner()
    const resolver = new RecommendationResolver()
    const sections = resolver.resolve([sampleRec('add_constraint', 'LIGHT_CONTINUITY'), sampleRec('adjust', 'SHOT_SCALE', 'high', 'inc', 'close_up')])
    const plan = planner.plan(sections)
    const validator = new PatchValidator()
    const v = validator.validate(plan)
    expect(v.affectedCapabilities.length).toBeGreaterThan(0)
    v.affectedCapabilities.forEach(a => {
      expect(['up', 'down']).toContain(a.direction)
      expect(a.expectedChange).toBeGreaterThan(0)
    })
  })
})

describe('COE: Full Engine', () => {
  test('接受空报告', () => {
    const engine = new CinematicOptimizationEngine()
    const result = engine.optimize([])
    expect(result.summary.totalPatches).toBe(0)
    expect(result.validation.valid).toBe(true)
  })

  test('从 CapabilityReport 生成补丁', () => {
    const reports: CapabilityReport[] = [
      {
        capability: 'LIGHT_CONTINUITY',
        evaluated: true,
        score: 60,
        confidence: 0.85,
        severity: 'medium',
        expected: 'consistent',
        observed: 'drifted',
        deviations: [],
        evidenceUsed: ['lightingProfile'],
        recommendations: [sampleRec('add_constraint', 'LIGHT_CONTINUITY', 'medium', 'Lock lighting')],
      },
      {
        capability: 'SHOT_SCALE',
        evaluated: true,
        score: 50,
        confidence: 0.75,
        severity: 'medium',
        expected: 'close_up',
        observed: 'medium',
        deviations: [],
        evidenceUsed: ['shots'],
        recommendations: [sampleRec('adjust', 'SHOT_SCALE', 'high', 'Increase scale', 'close_up')],
      },
    ]

    const engine = new CinematicOptimizationEngine()
    const result = engine.optimize(reports)

    expect(result.summary.totalPatches).toBeGreaterThanOrEqual(2)
    expect(result.summary.safePatches).toBeGreaterThanOrEqual(1)
    expect(result.patches.some(p => p.targetCapability === 'LIGHT_CONTINUITY')).toBe(true)
    expect(result.patches.some(p => p.targetCapability === 'SHOT_SCALE')).toBe(true)
    expect(result.generatedAt).toBeDefined()
  })

  test('minConfidence 过滤', () => {
    const reports: CapabilityReport[] = [
      {
        capability: 'OBJECT_PERSISTENCE',
        evaluated: true,
        score: 30,
        confidence: 0.5,
        severity: 'major',
        deviations: [],
        evidenceUsed: [],
        recommendations: [sampleRec('regen', 'OBJECT_PERSISTENCE', 'high')],
      },
    ]
    const engine = new CinematicOptimizationEngine()
    const resultLow = engine.optimize(reports, { minConfidence: 0.1 })
    const resultHigh = engine.optimize(reports, { minConfidence: 0.9 })
    expect(resultLow.summary.totalPatches).toBeGreaterThan(0)
  })
})
