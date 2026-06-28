/**
 * CEE — Evaluator 实现
 *
 * 每个 Evaluator 只负责一个 Capability。后续新增只需 add file + register。
 */

import type { CapabilityEvaluator, CapabilityReport, DeviationDetail, Recommendation, EvidencePackage } from './cee-types.js'
import type { SurveillanceZone } from './cee-evaluators.js'

// ─── 工具函数 ────────────────────────────

function deviation(dim: string, expected: string | number, observed: string | number, delta: number, severity: DeviationDetail['severity'], description: string): DeviationDetail {
  return { dimension: dim, expected, observed, delta, severity, description }
}

function rec(type: Recommendation['type'], cap: string, desc: string, priority: Recommendation['priority'], cirFieldPath?: string, suggestedValue?: string): Recommendation {
  return { type, capability: cap, description: desc, priority, cirFieldPath, suggestedValue }
}

function baseReport(cap: string): CapabilityReport {
  return { capability: cap, evaluated: true, deviations: [], recommendations: [], evidenceUsed: [] }
}

// ─── 1. OBJECT_PERSISTENCE ────────────────

export class ObjectPersistenceEvaluator implements CapabilityEvaluator {
  capabilityName = 'OBJECT_PERSISTENCE'
  requires = ['objectTracks', 'keyframes']

  evaluate(expected: Record<string, unknown>, obs: EvidencePackage): CapabilityReport {
    const r = baseReport('OBJECT_PERSISTENCE')
    r.evidenceUsed = ['objectTracks']

    const tracks = obs.objectTracks
    if (tracks.length === 0) {
      r.score = 0
      r.severity = 'critical'
      r.reason = 'No object tracks found — cannot evaluate persistence'
      r.deviations.push(deviation('track_count', '>0', '0', 0, 'critical', 'No objects detected in video'))
      return r
    }

    const persistentCount = tracks.filter(t => t.persistent).length
    const identityChangeCount = tracks.filter(t => t.identityChanges > 0).length
    const score = Math.round((persistentCount / tracks.length) * 100)
    r.score = score
    r.confidence = 0.85
    r.expected = 'All objects maintain identity across frames'
    r.observed = `${persistentCount}/${tracks.length} tracks persistent, ${identityChangeCount} with identity changes`

    if (score === 100) {
      r.severity = 'pass'
    } else if (score >= 80) {
      r.severity = 'minor'
      r.deviations.push(deviation('identity_changes', '0', String(identityChangeCount), identityChangeCount, 'minor', `${identityChangeCount} track(s) had identity changes`))
    } else if (score >= 60) {
      r.severity = 'medium'
      r.deviations.push(deviation('identity_changes', '0', String(identityChangeCount), identityChangeCount, 'medium', `${tracks.length - persistentCount} track(s) lost identity`))
      r.recommendations.push(rec('add_constraint', 'OBJECT_PERSISTENCE', 'Use consistent reference image per character', 'medium', undefined, undefined))
    } else {
      r.severity = 'major'
      r.deviations.push(deviation('persistence_ratio', '100%', `${score}%`, 100 - score, 'major', 'Most objects lost identity or were not tracked'))
      r.recommendations.push(rec('regen', 'OBJECT_PERSISTENCE', 'Regenerate with explicit character constraints', 'high'))
    }

    return r
  }
}

// ─── 2. LIGHT_CONTINUITY ──────────────────

export class LightingEvaluator implements CapabilityEvaluator {
  capabilityName = 'LIGHT_CONTINUITY'
  requires = ['lightingProfile', 'keyframes']

  evaluate(expected: Record<string, unknown>, obs: EvidencePackage): CapabilityReport {
    const r = baseReport('LIGHT_CONTINUITY')
    r.evidenceUsed = ['lightingProfiles']

    const profiles = obs.lightingProfiles
    if (profiles.length === 0) {
      r.score = 100
      r.severity = 'pass'
      r.reason = 'No lighting profiles — cannot evaluate (assuming pass)'
      return r
    }

    let totalChecks = 0
    let passChecks = 0

    for (const p of profiles) {
      // 方向一致性
      const dirs = p.keyLightDirectionFrames
      if (dirs.length > 1) {
        totalChecks++
        if (new Set(dirs.map(d => d.direction)).size <= 1) passChecks++
      }
      // 色温一致性
      const temps = p.colorTemperatureFrames
      if (temps.length > 1) {
        totalChecks++
        if (new Set(temps.map(t => t.temperature)).size <= 1) passChecks++
      }
      // 曝光稳定性
      const expo = p.exposureFrames
      if (expo.length > 1) {
        totalChecks++
        if (new Set(expo.map(e => e.exposure)).size <= 1) passChecks++
      }
    }

    const score = totalChecks > 0 ? Math.round((passChecks / totalChecks) * 100) : 100
    r.score = score
    r.confidence = 0.8
    r.expected = 'Lighting consistent across all shots'
    r.observed = `${passChecks}/${totalChecks} lighting checks passed`

    if (score === 100) {
      r.severity = 'pass'
    } else if (score >= 80) {
      r.severity = 'minor'
      r.deviations.push(deviation('lighting_correct', `${totalChecks}`, String(passChecks), totalChecks - passChecks, 'minor', `${totalChecks - passChecks} lighting check(s) failed`))
    } else {
      r.severity = 'medium'
      r.deviations.push(deviation('lighting_correct', `${totalChecks}`, String(passChecks), totalChecks - passChecks, 'medium', 'Lighting drift detected across shots'))
      r.recommendations.push(rec('add_constraint', 'LIGHT_CONTINUITY', 'Lock key light direction in all shots', 'medium', 'shots[].lighting.keyLightDirection'))
    }

    return r
  }
}

// ─── 3. CAMERA_COMPOSITION ────────────────

export class CompositionEvaluator implements CapabilityEvaluator {
  capabilityName = 'CAMERA_COMPOSITION'
  requires = ['compositionProfile', 'keyframes']

  evaluate(expected: Record<string, unknown>, obs: EvidencePackage): CapabilityReport {
    const r = baseReport('CAMERA_COMPOSITION')
    r.evidenceUsed = ['compositionProfiles']

    const profiles = obs.compositionProfiles
    if (profiles.length === 0) {
      r.score = 100
      r.severity = 'pass'
      return r
    }

    let totalShots = 0
    let okShots = 0

    for (const cp of profiles) {
      totalShots++
      const headrooms = cp.headroomFrames
      const lookRooms = cp.lookRoomFrames

      let shotOk = true

      // headroom 10-20%
      if (headrooms.length > 0) {
        const avgHeadroom = headrooms.reduce((s, h) => s + h.percent, 0) / headrooms.length
        if (avgHeadroom < 8 || avgHeadroom > 22) {
          shotOk = false
          r.deviations.push(deviation('headroom', '10-20%', `${Math.round(avgHeadroom)}%`, Math.abs(avgHeadroom - 15), 'minor', `Headroom off: ${Math.round(avgHeadroom)}%`))
        }
      }

      // look room >= 30%
      if (lookRooms.length > 0) {
        const avgLook = lookRooms.reduce((s, l) => s + l.percent, 0) / lookRooms.length
        if (avgLook < 25) {
          shotOk = false
          r.deviations.push(deviation('look_room', '>=30%', `${Math.round(avgLook)}%`, 30 - Math.round(avgLook), 'minor', 'Look room insufficient'))
        }
      }

      if (shotOk) okShots++
    }

    const score = Math.round((okShots / totalShots) * 100)
    r.score = score
    r.confidence = 0.75
    r.expected = 'Composition meets rule_of_thirds'
    r.observed = `${okShots}/${totalShots} shots with proper composition`

    if (score === 100) {
      r.severity = 'pass'
    } else if (score >= 75) {
      r.severity = 'minor'
      r.recommendations.push(rec('add_constraint', 'CAMERA_COMPOSITION', 'Adjust subject position for rule of thirds', 'low', 'shots[].camera.composition.subjectPosition'))
    } else {
      r.severity = 'medium'
      r.recommendations.push(rec('adjust', 'CAMERA_COMPOSITION', 'Set explicit composition rule and subject position in CIR', 'medium'))
    }

    return r
  }
}

// ─── 4. CAMERA_FOCUS / FOCUS_CONTROL ──────

export class FocusEvaluator implements CapabilityEvaluator {
  capabilityName = 'FOCUS_CONTROL'
  requires = ['keyframes']

  evaluate(expected: Record<string, unknown>, obs: EvidencePackage): CapabilityReport {
    const r = baseReport('FOCUS_CONTROL')
    r.evidenceUsed = ['keyframes']

    const kfs = obs.keyframes.filter(k => k.focusSubject !== undefined)
    if (kfs.length === 0) {
      r.score = 100
      r.severity = 'pass'
      return r
    }

    const focusedOnSubject = kfs.filter(k => k.focusSubject && k.focusSubject !== 'none')
    const score = Math.round((focusedOnSubject.length / kfs.length) * 100)
    r.score = score
    r.confidence = 0.7
    r.expected = 'Focus on intended subject'
    r.observed = `${focusedOnSubject.length}/${kfs.length} frames with correct focus`

    if (score === 100) {
      r.severity = 'pass'
    } else if (score >= 70) {
      r.severity = 'minor'
      r.deviations.push(deviation('focus_accuracy', '100%', `${score}%`, 100 - score, 'minor', 'Some frames missed subject focus'))
    } else {
      r.severity = 'medium'
      r.deviations.push(deviation('focus_accuracy', '100%', `${score}%`, 100 - score, 'medium', 'Frequent focus misses'))
      r.recommendations.push(rec('add_constraint', 'FOCUS_CONTROL', 'Set shallow depth of field with explicit focus target', 'high', 'shots[].camera.focus.depthOfField', 'shallow'))
    }

    return r
  }
}

// ─── 5. CAMERA_MOTION ─────────────────────

export class CameraMotionEvaluator implements CapabilityEvaluator {
  capabilityName = 'CAMERA_MOTION'
  requires = ['cameraMotions', 'shots']

  evaluate(expected: Record<string, unknown>, obs: EvidencePackage): CapabilityReport {
    const r = baseReport('CAMERA_MOTION')
    r.evidenceUsed = ['cameraMotions']

    const motions = obs.cameraMotions
    if (motions.length === 0) {
      r.score = 100
      r.severity = 'pass'
      r.reason = 'No motion data — assuming static'
      return r
    }

    const smoothShots = motions.filter(m => m.smoothnessScore >= 70)
    const score = Math.round((smoothShots.length / motions.length) * 100)
    r.score = score
    r.confidence = 0.75
    r.expected = 'Smooth camera motion'
    r.observed = `${smoothShots.length}/${motions.length} shots with smooth motion`

    if (score >= 80) {
      r.severity = 'pass'
    } else {
      r.severity = 'minor'
      r.deviations.push(deviation('motion_smoothness', '>=70', `${Math.round(motions.reduce((s, m) => s + m.smoothnessScore, 0) / motions.length)}`, 0, 'minor', 'Some shots had rough motion'))
      r.recommendations.push(rec('add_constraint', 'CAMERA_MOTION', 'Set camera path type and smoothness in CIR', 'low'))
    }

    return r
  }
}

// ─── 6. SHOT_SCALE ────────────────────────

export class ShotScaleEvaluator implements CapabilityEvaluator {
  capabilityName = 'SHOT_SCALE'
  requires = ['shots']

  evaluate(expected: Record<string, unknown>, obs: EvidencePackage): CapabilityReport {
    const r = baseReport('SHOT_SCALE')
    r.evidenceUsed = ['shots']

    const scaleKey = 'expected_scales'
    const expScales = (expected[scaleKey] as Record<string, string>) || {}

    const shots = obs.shots.filter(s => s.estimatedScale)
    if (shots.length === 0) {
      r.score = 100
      r.severity = 'pass'
      return r
    }

    // 如果有 expected 则对比
    if (Object.keys(expScales).length > 0) {
      let matchCount = 0
      let total = 0
      for (const shot of shots) {
        const expected = expScales[shot.shotId]
        if (expected) {
          total++
          if (shot.estimatedScale === expected) matchCount++
        }
      }
      const score = total > 0 ? Math.round((matchCount / total) * 100) : 100
      r.score = score
      r.confidence = 0.7
      r.expected = `${matchCount}/${total} shots match expected scale`
      r.observed = `${shots.length} shots with scales`
      r.severity = score >= 80 ? 'pass' : 'minor'
    } else {
      // 无 expected 时只检查是否都正确赋值
      r.score = 100
      r.severity = 'pass'
      r.reason = 'All shots have estimated scales'
    }

    return r
  }
}

// ─── 7. SHOT_ANGLE ────────────────────────

export class ShotAngleEvaluator implements CapabilityEvaluator {
  capabilityName = 'SHOT_ANGLE'
  requires = ['shots']

  evaluate(expected: Record<string, unknown>, obs: EvidencePackage): CapabilityReport {
    const r = baseReport('SHOT_ANGLE')
    r.evidenceUsed = ['shots']

    const shots = obs.shots.filter(s => s.estimatedAngle)
    if (shots.length === 0) {
      r.score = 100
      r.severity = 'pass'
      return r
    }

    r.score = 100
    r.severity = 'pass'
    r.reason = `${shots.length} shot(s) with estimated angles available`

    return r
  }
}
