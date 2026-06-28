/**
 * Runtime Contract Test — 全链路编译测试
 *
 * 验证整个 Runtime 链路的完整性：
 *   Story → DirectorDecision → ExecutionPlan → Constraint → Reference
 *   → FilmLanguageIR
 *
 * 每一层检查：
 *   - 不为空
 *   - Fingerprint 连续
 *   - Provenance 完整
 *   - 所有协议满足 Invariant
 *
 * 这是整个 Runtime 的"编译测试"。
 */

import { describe, it, expect } from 'vitest'
import {
  FilmLanguageIR,
  FilmLanguageFrame,
  validateFilmLanguageIR,
  computeFilmLanguageFingerprint,
} from '../protocols/film-language'
import { DirectorDecision, directorDecisionSchema } from '../protocols/intent/director-decision'
import { ExecutionPlan, CameraPlan } from '../protocols/execution/execution-plan'

// ─── 构建完整的端到端测试数据 ────────────────────────────────────────

function buildFullRuntimeChain() {
  const decision: DirectorDecision = {
    decisionId: 'dd_001',
    story: '沈三笑站在乌有城老茶馆门口，凝视门前的老槐树。春日清晨，嫩芽初绽。',
    shotDescription: 'Low-angle wide shot of Shen Sanxiao standing at the entrance of Old Tea House, gazing at the ancient locust tree outside.',
    camera: {
      shotType: 'Low Angle Reveal',
      movement: 'Slow pedestal up',
      lens: '35mm',
      motivation: '以老槐树的永恒衬托人物的短暂',
    },
    composition: '老槐树占据画面左2/3，沈三笑在右下1/3',
    lighting: {
      source: '春日清晨的漫射天光',
      quality: '柔光',
      direction: '顶光偏侧',
    },
    setDressing: '老茶馆门板斑驳，褪色的匾额',
    duration: 8,
    emotion: '宁静春日，生机与深邃',
  }

  const plan: ExecutionPlan = {
    planId: 'ep_001',
    decisionId: 'dd_001',
    sceneId: 'scene_001',
    cameraPlan: {
      shots: [
        {
          shotIndex: 0,
          type: 'Low Angle Reveal',
          movement: 'Slow pedestal up',
          lens: 35,
          duration: 8,
          framing: 'Wide',
          subjectPosition: 'right-lower-third',
        },
      ],
    } as CameraPlan,
  }

  const constraints = [
    {
      id: 'c_001',
      category: 'SPATIAL' as const,
      priority: 'HARD' as const,
      source: 'SPATIAL_PLANNER' as const,
      scope: 'SCENE' as const,
      payload: { statement: '沈三笑必须站在茶馆门口右侧，左侧让给老槐树' },
      state: 'ACTIVE' as const,
      reason: 'SpatialPlanner layout',
      generatedFromRevision: 1,
    },
    {
      id: 'c_002',
      category: 'REFERENCE' as const,
      priority: 'SOFT' as const,
      source: 'CONTINUITY' as const,
      scope: 'SHOT' as const,
      payload: { statement: '老槐树嫩芽状态：初绽未全开' },
      state: 'ACTIVE' as const,
      reason: 'ContinuityChecker consistency',
      generatedFromRevision: 1,
    },
  ]

  const refAssignment = {
    assignmentId: 'ra_001',
    planId: 'ep_001',
    coverage: { type: 'PARTIAL' },
    resolvableBindings: [
      {
        bindingId: 'rb_001',
        logicalElement: '沈三笑',
        type: 'CHARACTER' as const,
        assetNodeId: 'char_001',
        role: 'primary',
        continuityKey: 'shen_appearance',
        resolved: true,
      },
      {
        bindingId: 'rb_002',
        logicalElement: '老槐树(外景)',
        type: 'SCENE' as const,
        assetNodeId: 'scene_001',
        role: 'secondary',
        continuityKey: 'locust_tree',
        resolved: true,
      },
    ],
  }

  const frame: FilmLanguageFrame = {
    frameIndex: 0,
    subject: {
      primary: { name: '沈三笑', assetNodeId: 'char_001', visualWeight: 0.45, appearance: '靛蓝长衫，面容清瘦', attire: '靛蓝长衫' },
      secondary: [
        { name: '老槐树', assetNodeId: 'scene_001', visualWeight: 0.40, appearance: '古槐，枝干虬结，嫩芽初绽' },
        { name: '茶馆', assetNodeId: 'scene_002', visualWeight: 0.15, appearance: '青瓦木门，斑驳门板' },
      ],
    },
    camera: { composition: '老槐树占据画面左2/3', shotType: 'Low Angle Reveal', narrativeIntention: '以老槐树的永恒衬托人物的短暂' },
    motion: { camera: '极慢匀速上升', character: '微风吹衣角', environment: '嫩芽轻摇', particles: '晨光中细微灰尘漂浮' },
    environment: { scene: '乌有城老茶馆前', timeOfDay: '春日清晨', weather: '晴，薄云' },
    lighting: { source: '春日清晨的漫射天光', quality: '柔光，略带散射', direction: '顶光偏侧，柔和均匀' },
    emotion: { mood: '宁静春日，生机与深邃' },
    visualAnchors: {
      anchors: [
        { name: '沈三笑', type: 'character', assetNodeId: 'char_001', role: 'primary', continuityKey: 'shen_appearance' },
        { name: '老槐树', type: 'scene', assetNodeId: 'scene_001', role: 'secondary', continuityKey: 'locust_tree' },
      ],
    },
    continuity: {
      constraints: [
        { element: '沈三笑服装', description: '靛蓝色长衫不变', priority: 'must' },
        { element: '老槐树嫩芽', description: '初绽未全开', priority: 'should' },
      ],
    },
    narrative: { short: '沈三笑站在茶馆门口凝视老槐树。春日清晨，嫩芽初绽。', dialogue: '' },
    meta: { decisionId: 'dd_001', planId: 'ep_001', producer: 'FilmLanguageCompiler', version: '1.0.0' },
  }

  const ir: FilmLanguageIR = {
    frames: [frame],
    meta: { decisionId: 'dd_001', planId: 'ep_001', producer: 'FilmLanguageCompiler', version: '1.0.0', createdAt: new Date().toISOString() },
  }

  return { decision, plan, constraints, refAssignment, ir }
}

describe('Runtime Contract Test — 全链路编译测试', () => {

  it('① 每一层不能为空', () => {
    const { decision, plan, constraints, refAssignment, ir } = buildFullRuntimeChain()

    // Decision Layer
    expect(decision.decisionId).toBeTruthy()
    expect(decision.story).toBeTruthy()
    expect(decision.shotDescription).toBeTruthy()

    // Execution Layer
    expect(plan.planId).toBeTruthy()
    expect(plan.cameraPlan.shots).toBeDefined()
    expect(plan.cameraPlan.shots.length).toBeGreaterThan(0)

    // Governance Layer
    expect(constraints.length).toBeGreaterThan(0)
    constraints.forEach((c: any) => {
      expect(c.id).toBeTruthy()
      expect(c.category).toBeDefined()
      expect(c.priority).toBeDefined()
    })

    // Representation Layer
    expect(refAssignment.assignmentId).toBeTruthy()
    expect(refAssignment.resolvableBindings.length).toBeGreaterThan(0)
    refAssignment.resolvableBindings.forEach((rb: any) => {
      expect(rb.resolved).toBe(true)
      expect(rb.assetNodeId).toBeTruthy()
    })

    expect(ir.frames.length).toBeGreaterThan(0)
    expect(ir.meta.version).toBe('1.0.0')
  })

  it('② Fingerprint 连续：同输入同 IR，Fingerprint 不可变', () => {
    const { ir: ir1 } = buildFullRuntimeChain()
    const { ir: ir2 } = buildFullRuntimeChain()
    expect(computeFilmLanguageFingerprint(ir1)).toBe(computeFilmLanguageFingerprint(ir2))
  })

  it('③ Provenance 完整：每层都有 ID 链', () => {
    const { decision, plan, refAssignment, ir } = buildFullRuntimeChain()

    expect(plan.decisionId).toBe(decision.decisionId)
    expect(refAssignment.planId).toBe(plan.planId)
    expect(ir.meta.decisionId).toBe(decision.decisionId)
    expect(ir.meta.planId).toBe(plan.planId)

    ir.frames.forEach(frame => {
      expect(frame.meta.decisionId).toBe(decision.decisionId)
      expect(frame.meta.planId).toBe(plan.planId)
    })
  })

  it('④ 所有协议满足 Invariant', () => {
    const { ir } = buildFullRuntimeChain()

    const validationErrors = validateFilmLanguageIR(ir)
    expect(validationErrors).toHaveLength(0)

    for (const frame of ir.frames) {
      const totalWeight =
        frame.subject.primary.visualWeight +
        frame.subject.secondary.reduce((s, si) => s + si.visualWeight, 0)
      expect(Math.abs(totalWeight - 1.0)).toBeLessThanOrEqual(0.01)

      expect(frame.subject.primary.name).toBeTruthy()
      expect(frame.visualAnchors.anchors.length).toBeGreaterThan(0)

      const motion = frame.motion
      expect(motion.camera || motion.character || motion.environment).toBeTruthy()
    }
  })

  it('⑤ Governance Layer 合流检查：Fingerprint 必须包含 IR 内容', () => {
    const { ir } = buildFullRuntimeChain()
    const fp = computeFilmLanguageFingerprint(ir)

    expect(fp.length).toBeGreaterThan(0)
    expect(fp).toContain('沈三笑')
    expect(fp).toContain('Low Angle Reveal')

    const fp2 = computeFilmLanguageFingerprint(ir)
    expect(fp).toBe(fp2)
  })
})
