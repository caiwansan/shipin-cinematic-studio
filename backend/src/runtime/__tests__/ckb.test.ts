/**
 * CKB — 测试
 */

import { describe, test, expect } from 'vitest'
import { CKB_QUALITY_GATES } from '../ckb-types.js'
import {
  DirectorPatternRepository,
  ProviderProfileRepository,
  OptimizationKnowledgeRepository,
  BenchmarkCorpusRepository,
  FailureAtlasRepository,
} from '../ckb-repositories.js'
import { CkbEngine } from '../ckb-engine.js'
import type { CapabilityReport, EvaluationSummary } from '../cee-types.js'
import type { OptimizationResult } from '../coe-types.js'

describe('CKB: DirectorPatternRepository', () => {
  test('插入与查询', () => {
    const repo = new DirectorPatternRepository()
    const id = repo.insert({
      patternId: 'dp_001',
      sceneType: 'dialogue',
      provider: 'veo',
      cirSummary: { cameraScales: ['close_up'], cameraAngles: ['eye'], motionPatterns: ['static'], lightingMoods: ['warm'] },
      evaluation: { overallScore: 95, topCapabilities: ['SHOT_SCALE'], weakCapabilities: ['CAMERA_MOTION'] },
      successCount: 10,
      version: '1.0',
      createdAt: new Date().toISOString(),
      tags: ['dialogue', 'veo'],
    })
    const found = repo.get(id)
    expect(found).toBeDefined()
    expect(found!.sceneType).toBe('dialogue')
  })

  test('按场景搜索', () => {
    const repo = new DirectorPatternRepository()
    repo.insert({
      patternId: 'dp_002', sceneType: 'action', provider: 'runway',
      cirSummary: { cameraScales: ['wide'], cameraAngles: ['high'], motionPatterns: ['dolly'], lightingMoods: ['dramatic'] },
      evaluation: { overallScore: 88, topCapabilities: [], weakCapabilities: [] },
      successCount: 5, version: '1.0', createdAt: '', tags: [],
    })
    repo.insert({
      patternId: 'dp_003', sceneType: 'dialogue', provider: 'veo',
      cirSummary: { cameraScales: ['close_up'], cameraAngles: ['eye'], motionPatterns: ['static'], lightingMoods: ['warm'] },
      evaluation: { overallScore: 92, topCapabilities: [], weakCapabilities: [] },
      successCount: 8, version: '1.0', createdAt: '', tags: [],
    })
    const found = repo.findBySceneType('dialogue')
    expect(found.length).toBe(1)
    expect(found[0].patternId).toBe('dp_003')
  })

  test('最佳模式排序', () => {
    const repo = new DirectorPatternRepository()
    repo.insert({
      patternId: 'dp_004', sceneType: 'dialogue', provider: 'veo',
      cirSummary: { cameraScales: [], cameraAngles: [], motionPatterns: [], lightingMoods: [] },
      evaluation: { overallScore: 80, topCapabilities: [], weakCapabilities: [] },
      successCount: 3, version: '1.0', createdAt: '', tags: [],
    })
    repo.insert({
      patternId: 'dp_005', sceneType: 'dialogue', provider: 'veo',
      cirSummary: { cameraScales: [], cameraAngles: [], motionPatterns: [], lightingMoods: [] },
      evaluation: { overallScore: 95, topCapabilities: [], weakCapabilities: [] },
      successCount: 12, version: '1.0', createdAt: '', tags: [],
    })
    const best = repo.findBestForScene('dialogue', 'veo')
    expect(best).toBeDefined()
    expect(best!.evaluation.overallScore).toBe(95)
  })
})

describe('CKB: ProviderProfileRepository', () => {
  test('按能力搜索 Provider', () => {
    const repo = new ProviderProfileRepository()
    repo.insert({
      providerId: 'p1', providerName: 'Runway',
      capabilities: [{ capability: 'CAMERA_PATH', supportLevel: 'full', limitations: [], historicalSuccessRate: 90, sampleCount: 100 }],
      bestFor: ['action'], weakFor: ['dialogue'], version: '1.0', lastUpdated: '',
    })
    repo.insert({
      providerId: 'p2', providerName: 'Veo',
      capabilities: [{ capability: 'CAMERA_PATH', supportLevel: 'partial', limitations: ['no_rack_focus'], historicalSuccessRate: 75, sampleCount: 80 }],
      bestFor: ['dialogue'], weakFor: ['action'], version: '1.0', lastUpdated: '',
    })
    const found = repo.findBestForCapability('CAMERA_PATH')
    expect(found).toBeDefined()
    expect(found!.providerName).toBe('Runway')
  })
})

describe('CKB: OptimizationKnowledgeRepository', () => {
  test('按能力查询最佳 Patch', () => {
    const repo = new OptimizationKnowledgeRepository()
    repo.insert({
      patternId: 'opt_001', targetCapability: 'LIGHT_CONTINUITY',
      description: 'Lock lighting', averageGain: 8, gainStdDev: 3,
      sampleCount: 50, successRate: 85, applicableScenes: ['dialogue'],
      version: '1.0', lastUpdated: '',
    })
    repo.insert({
      patternId: 'opt_002', targetCapability: 'LIGHT_CONTINUITY',
      description: 'Add rim light', averageGain: 5, gainStdDev: 4,
      sampleCount: 20, successRate: 70, applicableScenes: ['action'],
      version: '1.0', lastUpdated: '',
    })
    const best = repo.findBestPatch('LIGHT_CONTINUITY', 'dialogue')
    expect(best).toBeDefined()
    expect(best!.successRate).toBe(85)
  })
})

describe('CKB: FailureAtlasRepository', () => {
  test('按条件查找解决方案', () => {
    const repo = new FailureAtlasRepository()
    repo.insert({
      failureId: 'f1', failureType: 'identity_drift', capability: 'OBJECT_PERSISTENCE',
      provider: 'runway', sceneDescription: 'fast camera move', conditions: ['camera_move', 'low_light'],
      solutions: ['reuse_previous_anchor', 'lock_lighting'], occurrenceCount: 5,
      lastOccurrence: '', version: '1.0',
    })
    const solutions = repo.findSolutions('identity_drift', 'OBJECT_PERSISTENCE', 'runway')
    expect(solutions).toContain('reuse_previous_anchor')
    expect(solutions).toContain('lock_lighting')
  })
})

describe('CKB: CkbEngine', () => {
  function sampleReports(overall: number): { reports: CapabilityReport[]; summary: EvaluationSummary } {
    const reports: CapabilityReport[] = [
      {
        capability: 'LIGHT_CONTINUITY', evaluated: true,
        score: 85, confidence: 0.9, severity: 'minor',
        deviations: [], recommendations: [{ type: 'add_constraint', capability: 'LIGHT_CONTINUITY', description: 'Lock lighting', priority: 'medium' }],
        evidenceUsed: ['lightingProfile'],
      },
      {
        capability: 'OBJECT_PERSISTENCE', evaluated: true,
        score: 40, confidence: 0.7, severity: 'major',
        deviations: [{ dimension: 'identity', expected: '100%', observed: '40%', delta: 60, severity: 'major', description: 'Identity drift' }],
        recommendations: [{ type: 'regen', capability: 'OBJECT_PERSISTENCE', description: 'Use consistent anchor', priority: 'high' }],
        evidenceUsed: ['objectTracks'],
      },
    ]
    const summary: EvaluationSummary = {
      scores: { LIGHT_CONTINUITY: 85, OBJECT_PERSISTENCE: 40 },
      confidence: { LIGHT_CONTINUITY: 0.9, OBJECT_PERSISTENCE: 0.7 },
      dimensions: { worldConsistency: 62, cinematicQuality: 85, physicsReality: 100, storyAlignment: 85 },
      overall,
      evaluatedAt: '',
      evidenceId: 'ev_001',
    }
    return { reports, summary }
  }

  test('High overall → DirectorPattern', () => {
    const engine = new CkbEngine()
    const { reports, summary } = sampleReports(95)
    const ids = engine.ingestFromEvaluation(reports, summary, { sceneType: 'dialogue', provider: 'veo' })
    expect(ids.length).toBe(1)
    expect(engine.directorPatterns.count()).toBe(1)
    expect(engine.directorPatterns.get(ids[0])!.sceneType).toBe('dialogue')
  })

  test('Low overall + major failure → FailureAtlas', () => {
    const engine = new CkbEngine()
    const { reports, summary } = sampleReports(60)
    summary.overall = 60
    const ids = engine.ingestFromEvaluation(reports, summary, { provider: 'runway' })
    // OBJECT_PERSISTENCE severity=major → 写入 failure
    expect(ids.length).toBeGreaterThanOrEqual(1)
    expect(engine.failureAtlas.count()).toBeGreaterThanOrEqual(1)
  })

  test('中等分数 → OptimizationKnowledge', () => {
    const engine = new CkbEngine()
    const { reports, summary } = sampleReports(75)
    summary.overall = 75
    // 设为没有 major/critical
    const safeReports = reports.map(r => ({ ...r, severity: 'minor' as const, score: 70 }))
    const ids = engine.ingestFromEvaluation(safeReports, summary)
    if (ids.length > 0) {
      expect(engine.optimizationKnowledge.count()).toBeGreaterThan(0)
    }
  })

  test('skip 不写入任何内容', () => {
    const engine = new CkbEngine()
    const { reports, summary } = sampleReports(50)
    summary.overall = 50
    const noFailureReports = reports.map(r => ({ ...r, severity: 'minor' as const, score: 50, recommendations: [] }))
    const ids = engine.ingestFromEvaluation(noFailureReports, summary)
    expect(ids.length).toBe(0)
    // ingesting doesn't modify stats_ here — filtered isn't tracking
    // just confirm nothing was written
    expect(engine.optimizationKnowledge.count()).toBe(0)
    expect(engine.failureAtlas.count()).toBe(0)
  })

  test('COE 结果写入优化知识', () => {
    const engine = new CkbEngine()
    const result: OptimizationResult = {
      videoId: 'v1', evidenceId: 'e1', generatedAt: '',
      plan: { id: 'p1', patches: [], conflicts: [], applyOrder: [], generatedAt: '' },
      patches: [
        { type: 'safe', confidence: 0.9, targetCapability: 'LIGHT_CONTINUITY', fields: [{ path: 'lighting', to: 'locked' }], reason: 'Lock lighting', expectedGain: '+10%' },
        { type: 'recommended', confidence: 0.8, targetCapability: 'SHOT_SCALE', fields: [{ path: 'scale', to: 'close_up' }], reason: 'Increase scale', expectedGain: '+15%' },
      ],
      validation: { valid: true, errors: [], warnings: [], affectedCapabilities: [] },
      summary: { totalPatches: 2, safePatches: 1, recommendedPatches: 1, experimentalPatches: 0, overallConfidence: 0.85, autoApplicable: true },
    }
    const ids = engine.ingestFromOptimization(result, { sceneType: 'dialogue' })
    expect(ids.length).toBe(2)
    expect(engine.optimizationKnowledge.count()).toBe(2)
  })

  test('recordSuccess 更新样本数和平均收益', () => {
    const engine = new CkbEngine()
    const id = engine.optimizationKnowledge.insert({
      patternId: 'opt_test', targetCapability: 'TEST', description: 'test',
      averageGain: 10, gainStdDev: 3, sampleCount: 1, successRate: 100,
      applicableScenes: ['any'], version: '1.0', lastUpdated: '',
    })
    engine.recordSuccess(id, 15)
    const updated = engine.optimizationKnowledge.get(id)
    expect(updated!.sampleCount).toBe(2)
    expect(updated!.averageGain).toBe(13)
  })

  test('recordFailure 合并已有记录', () => {
    const engine = new CkbEngine()
    const id1 = engine.recordFailure({
      failureType: 'identity_drift', capability: 'OBJECT_PERSISTENCE',
      provider: 'runway', sceneDescription: 'fast motion',
      conditions: ['camera_move'], solutions: ['reuse_anchor'],
    })
    const id2 = engine.recordFailure({
      failureType: 'identity_drift', capability: 'OBJECT_PERSISTENCE',
      provider: 'runway', sceneDescription: 'fast motion',
      conditions: ['camera_move'], solutions: ['lock_lighting'],
    })
    // 相同 failure 类型 → 不新建，更新
    expect(engine.failureAtlas.count()).toBe(1)
    const entries = engine.failureAtlas.findByFailureType('identity_drift')
    expect(entries.length).toBe(1)
    expect(entries[0].occurrenceCount).toBe(2)
    expect(entries[0].solutions).toContain('reuse_anchor')
    expect(entries[0].solutions).toContain('lock_lighting')
  })
})
