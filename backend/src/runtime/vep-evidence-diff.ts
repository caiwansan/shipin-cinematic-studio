/**
 * VEP — Evidence Diff Engine
 *
 * Expected Evidence（来自 CIR）vs Observed Evidence（来自视频）→ EvidenceDiff
 *
 * 这是生产质量闭环的核心——不回答"质量多好"，
 * 而回答"生成结果与导演意图的偏差在哪里"。
 */

import type { EvidencePackage, EvidenceKeyframe, EvidenceObjectTrack, EvidenceCameraMotion, EvidenceLightingProfile, EvidenceCompositionProfile } from './vep-types.js'
import type { EvidenceDiff, EvidenceDeviation } from './vep-types.js'

// ─── 转译 CIR 字段为 Expected Evidence ───

export interface ExpectedEvidence {
  /** 各镜头期望景别 */
  shotScales: Record<string, string>
  /** 各镜头期望角度 */
  shotAngles: Record<string, string>
  /** 各镜头期望构图规则 */
  compositionRules: Record<string, string>
  /** 各镜头期望灯光方向 */
  lightDirections: Record<string, string>
  /** 各镜头期望色温 */
  colorTemperatures: Record<string, string>
  /** 各镜头期望焦点目标 */
  focusTargets: Record<string, string>
  /** 各镜头期望景深 */
  depthOfFields: Record<string, string>
  /** 各镜头角色 ID 列表 */
  shotCharacters: Record<string, string[]>
}

/**
 * 构建 Expected Evidence（从 CIR 转译）
 * TODO: 接入真实 CIR → 自动生成
 */
export function buildExpectedEvidence(): ExpectedEvidence {
  // Placeholder — 后续从 CIR 自动转译
  return {
    shotScales: {},
    shotAngles: {},
    compositionRules: {},
    lightDirections: {},
    colorTemperatures: {},
    focusTargets: {},
    depthOfFields: {},
    shotCharacters: {},
  }
}

// ─── Observed Evidence 抽取 ──────────────

function extractShotEvidence(obs: EvidencePackage): Record<string, {
  scale?: string
  angle?: string
}> {
  const result: Record<string, any> = {}
  for (const shot of obs.shots) {
    result[shot.shotId] = {
      scale: shot.estimatedScale,
      angle: shot.estimatedAngle,
    }
  }
  return result
}

function extractLightingEvidence(obs: EvidencePackage): Record<string, {
  directionConsistent: boolean
  temperatureConsistent: boolean
  exposureStable: boolean
}> {
  const result: Record<string, any> = {}
  for (const lp of obs.lightingProfiles) {
    const dirs = lp.keyLightDirectionFrames.map(f => f.direction)
    const temps = lp.colorTemperatureFrames.map(f => f.temperature)
    const expos = lp.exposureFrames.map(f => f.exposure)
    result[lp.shotId] = {
      directionConsistent: dirs.length > 0 && new Set(dirs).size <= 1,
      temperatureConsistent: temps.length > 0 && new Set(temps).size <= 1,
      exposureStable: expos.length > 0 && new Set(expos).size <= 1,
    }
  }
  return result
}

function extractCompositionEvidence(obs: EvidencePackage): Record<string, {
  rule?: string
  headroomOk: boolean
  lookRoomOk: boolean
}> {
  const result: Record<string, any> = {}
  for (const cp of obs.compositionProfiles) {
    result[cp.shotId] = {
      rule: cp.subjectPositionFrames.length > 0 ? cp.subjectPositionFrames[0].rule : undefined,
      headroomOk: cp.headroomFrames.every(h => h.percent >= 10 && h.percent <= 20),
      lookRoomOk: cp.lookRoomFrames.every(l => l.percent >= 30),
    }
  }
  return result
}

function extractFocusEvidence(obs: EvidencePackage): Record<string, {
  focusOnSubject: boolean
}> {
  const result: Record<string, any> = {}
  for (const kf of obs.keyframes) {
    const shotId = kf.shotId
    if (!result[shotId]) result[shotId] = { focusOnSubject: true }
    if (kf.focusSubject === 'none' || kf.estimatedDepthOfField === 'deep') {
      result[shotId].focusOnSubject = false
    }
  }
  return result
}

function extractObjectPersistenceEvidence(obs: EvidencePackage): {
  persistentTracks: number
  identityChangedTracks: number
} {
  const tracks = obs.objectTracks
  return {
    persistentTracks: tracks.filter(t => t.persistent).length,
    identityChangedTracks: tracks.filter(t => t.identityChanges > 0).length,
  }
}

// ─── Score 计算 ──────────────────────────

function computeScore(isExpected: number, isObserved: number): number {
  if (isExpected === 0 && isObserved === 0) return 100
  if (isExpected === 0) return 0
  const ratio = Math.min(isObserved / isExpected, 1)
  return Math.round(ratio * 100)
}

// ─── 主 Diff 引擎 ────────────────────────

/**
 * 计算 Expected vs Observed Evidence Diff
 * 
 * @param expected Expected Evidence（来自 CIR）
 * @param observed Observed Evidence（来自 VEP 视频分析）
 * @returns EvidenceDiff（偏差 + 评分）
 */
export function computeEvidenceDiff(
  expected: ExpectedEvidence,
  observed: EvidencePackage,
): EvidenceDiff {
  const deviations: EvidenceDeviation[] = []
  const scores: Record<string, number> = {}
  const matched: string[] = []

  // ── 1. SHOT_SCALE ──
  const obsShots = extractShotEvidence(observed)
  for (const [shotId, expScale] of Object.entries(expected.shotScales)) {
    const obs = obsShots[shotId]
    if (obs && obs.scale && obs.scale !== expScale) {
      deviations.push({
        capability: 'SHOT_SCALE',
        expected: expScale,
        observed: obs.scale,
        deviation: 50,
        score: 50,
        reason: `Shot ${shotId}: expected ${expScale}, observed ${obs.scale}`,
      })
    }
  }

  // ── 2. SHOT_ANGLE ──
  for (const [shotId, expAngle] of Object.entries(expected.shotAngles)) {
    const obs = obsShots[shotId]
    if (obs && obs.angle && obs.angle !== expAngle) {
      deviations.push({
        capability: 'SHOT_ANGLE',
        expected: expAngle,
        observed: obs.angle,
        deviation: 50,
        score: 50,
        reason: `Shot ${shotId}: expected ${expAngle} angle, observed ${obs.angle}`,
      })
    }
  }

  // ── 3. LIGHT_CONTINUITY ──
  const lightingEv = extractLightingEvidence(observed)
  const lightingShots = Object.keys(lightingEv)
  const consistentShots = lightingShots.filter(s => lightingEv[s].directionConsistent).length
  const totalLightShots = lightingShots.length || 1
  const lightingScore = Math.round((consistentShots / totalLightShots) * 100)
  scores['LIGHT_CONTINUITY'] = lightingScore
  if (lightingScore < 90) {
    deviations.push({
      capability: 'LIGHT_CONTINUITY',
      expected: 'consistent across shots',
      observed: `${consistentShots}/${totalLightShots} shots direction-consistent`,
      deviation: 100 - lightingScore,
      score: lightingScore,
      reason: `Lighting direction inconsistent in ${totalLightShots - consistentShots} shot(s)`,
    })
  } else {
    matched.push('LIGHT_CONTINUITY')
  }

  // ── 4. CAMERA_COMPOSITION ──
  const compEv = extractCompositionEvidence(observed)
  const compShots = Object.keys(compEv)
  const compOkShots = compShots.filter(s => compEv[s].headroomOk && compEv[s].lookRoomOk).length
  const totalCompShots = compShots.length || 1
  const compScore = Math.round((compOkShots / totalCompShots) * 100)
  scores['CAMERA_COMPOSITION'] = compScore
  if (compScore < 85) {
    deviations.push({
      capability: 'CAMERA_COMPOSITION',
      expected: 'proper headroom (10-20%) and look room (≥30%)',
      observed: `${compOkShots}/${totalCompShots} shots meeting composition criteria`,
      deviation: 100 - compScore,
      score: compScore,
      reason: `${totalCompShots - compOkShots} shot(s) violate composition rules`,
    })
  } else {
    matched.push('CAMERA_COMPOSITION')
  }

  // ── 5. CAMERA_FOCUS ──
  const focusEv = extractFocusEvidence(observed)
  const focusOkShots = Object.values(focusEv).filter(f => f.focusOnSubject).length
  const focusTotal = Object.keys(focusEv).length || 1
  const focusScore = Math.round((focusOkShots / focusTotal) * 100)
  scores['CAMERA_FOCUS'] = focusScore
  if (focusScore < 90) {
    deviations.push({
      capability: 'CAMERA_FOCUS',
      expected: 'focus on intended subject',
      observed: `${focusOkShots}/${focusTotal} shots with correct focus`,
      deviation: 100 - focusScore,
      score: focusScore,
      reason: `${focusTotal - focusOkShots} shot(s) missing subject focus`,
    })
  } else {
    matched.push('CAMERA_FOCUS')
  }

  // ── 6. OBJECT_PERSISTENCE ──
  const objEv = extractObjectPersistenceEvidence(observed)
  const totalTracks = objEv.persistentTracks + objEv.identityChangedTracks
  const objScore = totalTracks > 0
    ? Math.round((objEv.persistentTracks / totalTracks) * 100)
    : 100
  scores['OBJECT_PERSISTENCE'] = objScore
  if (objScore < 85) {
    deviations.push({
      capability: 'OBJECT_PERSISTENCE',
      expected: 'all objects maintain identity',
      observed: `${objEv.persistentTracks}/${totalTracks} tracks persistent`,
      deviation: 100 - objScore,
      score: objScore,
      reason: `${objEv.identityChangedTracks} track(s) had identity changes`,
    })
  } else {
    matched.push('OBJECT_PERSISTENCE')
  }

  return {
    deviations,
    scores,
    matchedCapabilities: matched,
    generatedAt: new Date().toISOString(),
    expectedCirId: expected.shotScales['$meta'] || 'unknown',
    evidenceId: observed.videoId,
  }
}
