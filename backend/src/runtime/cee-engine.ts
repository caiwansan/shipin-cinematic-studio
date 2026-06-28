/**
 * CEE — Engine 主入口
 *
 * Layer 4 in one: Resolve → Evaluate → Analyze → Recommend
 * 冻结接口，后续新增 Capability 只加 Evaluator，不改 Engine。
 */

import type {
  CeeEngine, CapabilityEvaluator, CapabilityEvaluationResult,
  CapabilityReport, EvaluationSummary, EvidencePackage, EvidenceRequirement,
} from './cee-types.js'

// ─── Built-in Evidence Resolver ───────────

const DEFAULT_RESOLVER: EvidenceRequirement[] = [
  { capability: 'OBJECT_PERSISTENCE', requires: ['objectTracks', 'keyframes'] },
  { capability: 'LIGHT_CONTINUITY', requires: ['lightingProfile', 'keyframes'] },
  { capability: 'CAMERA_COMPOSITION', requires: ['compositionProfile', 'keyframes'] },
  { capability: 'FOCUS_CONTROL', requires: ['keyframes'] },
  { capability: 'CAMERA_MOTION', requires: ['cameraMotions', 'shots'] },
  { capability: 'SHOT_SCALE', requires: ['shots'] },
  { capability: 'SHOT_ANGLE', requires: ['shots'] },
  { capability: 'SPATIAL_RELATIONSHIP', requires: ['objectTracks'] },
  { capability: 'TEMPORAL_CONSISTENCY', requires: ['shots', 'sceneTimeline'] },
]

// ─── 维度评分计算 ─────────────────────────

function computeDimensionScores(reports: CapabilityReport[]): EvaluationSummary['dimensions'] {
  // 四维映射
  const dims: Record<string, string[]> = {
    worldConsistency: ['OBJECT_PERSISTENCE', 'SPATIAL_RELATIONSHIP', 'TEMPORAL_CONSISTENCY'],
    cinematicQuality: ['CAMERA_COMPOSITION', 'FOCUS_CONTROL', 'SHOT_SCALE', 'SHOT_ANGLE', 'LIGHT_CONTINUITY', 'CAMERA_MOTION'],
    physicsReality: [], // Wave 3+
    storyAlignment: ['LIGHT_CONTINUITY'], // placeholder
  }

  const scores: Record<string, number> = {}

  for (const [dim, caps] of Object.entries(dims)) {
    if (caps.length === 0) {
      scores[dim] = 100 // 尚无数据时默认 full
      continue
    }
    const capReports = caps
      .map(c => reports.find(r => r.capability === c))
      .filter((r): r is CapabilityReport => r !== undefined && r.score !== undefined)
    if (capReports.length === 0) {
      scores[dim] = 100
      continue
    }
    scores[dim] = Math.round(capReports.reduce((s, r) => s + (r.score || 0), 0) / capReports.length)
  }

  return {
    worldConsistency: scores['worldConsistency'] || 100,
    cinematicQuality: scores['cinematicQuality'] || 100,
    physicsReality: scores['physicsReality'] || 100,
    storyAlignment: scores['storyAlignment'] || 100,
  }
}

function computeOverall(scores: Record<string, number>, dimensions: EvaluationSummary['dimensions']): number {
  const all = [...Object.values(scores), ...Object.values(dimensions)]
  if (all.length === 0) return 100
  return Math.round(all.reduce((s, v) => s + v, 0) / all.length)
}

// ─── CapabilityEvaluationEngine ───────────

export class CapabilityEvaluationEngine implements CeeEngine {
  private evaluators = new Map<string, CapabilityEvaluator>()
  public evidenceResolver = DEFAULT_RESOLVER

  register(evaluator: CapabilityEvaluator): void {
    this.evaluators.set(evaluator.capabilityName, evaluator)
  }

  /** 批量注册 */
  registerAll(evaluators: CapabilityEvaluator[]): void {
    for (const e of evaluators) {
      this.register(e)
    }
  }

  evaluate(capabilityName: string, expected: Record<string, unknown>, observed: EvidencePackage): CapabilityReport | undefined {
    const evaluator = this.evaluators.get(capabilityName)
    if (!evaluator) return undefined
    return evaluator.evaluate(expected, observed)
  }

  evaluateAll(expected: Record<string, unknown>, observed: EvidencePackage): CapabilityEvaluationResult {
    const reports: CapabilityReport[] = []
    const evaluatedCaps: string[] = []
    const skippedCaps: string[] = []

    // Layer 1: Resolve
    // 只评估有 evaluator 且 evidence 满足的能力
    for (const [name, evaluator] of this.evaluators.entries()) {
      // Layer 1: Check evidence availability
      const req = this.evidenceResolver.find(r => r.capability === name)
      if (req) {
        const missing = req.requires.filter(field => {
          if (field === 'objectTracks' && observed.objectTracks.length === 0) return true
          if (field === 'lightingProfile' && observed.lightingProfiles.length === 0) return true
          if (field === 'compositionProfile' && observed.compositionProfiles.length === 0) return true
          if (field === 'cameraMotions' && observed.cameraMotions.length === 0) return true
          if (field === 'keyframes' && observed.keyframes.length === 0) return true
          if (field === 'shots' && observed.shots.length === 0) return true
          return false
        })
        if (missing.length > 0) {
          skippedCaps.push(name)
          continue // 没有证据就跳评
        }
      }

      // Layer 2: Evaluate
      // Layers 3 & 4: Analysis + Recommendation inside evaluator
      const report = evaluator.evaluate(expected, observed)
      reports.push(report)
      evaluatedCaps.push(name)
    }

    // Layer 4 (global): Build summary
    const scores: Record<string, number> = {}
    const confidence: Record<string, number> = {}
    for (const r of reports) {
      if (r.score !== undefined) scores[r.capability] = r.score
      if (r.confidence !== undefined) confidence[r.capability] = r.confidence
    }

    const dimensions = computeDimensionScores(reports)
    const overall = computeOverall(scores, dimensions)

    const summary: EvaluationSummary = {
      scores,
      confidence,
      dimensions,
      overall,
      evaluatedAt: new Date().toISOString(),
      evidenceId: observed.videoId,
    }

    return {
      reports,
      summary,
      config: {
        capabilitiesEvaluated: evaluatedCaps,
        capabilitiesSkipped: skippedCaps,
        version: '1.0',
      },
    }
  }
}
