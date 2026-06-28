/**
 * shot-to-spec.ts — ShotNode → VideoPromptSpec 转换器
 *
 * 这是导演层和编译层之间的链路。
 * 每个 ShotNode（单一镜头）翻译为一个 VideoPromptSpec。
 */

import type { ShotNode, ShotGraph } from './shot-graph-schema.js'
import type { VideoPromptSpec, VFXSpec } from '../../production-loop/prompt-compiler.js'

// ============================================================
// Shot Intent → Camera Style Mapping
// ============================================================

const INTENT_CAMERA_MAP: Record<string, { shot_type: string; movement: string; keywords: string[] }> = {
  establishing: {
    shot_type: 'wide establishing shot',
    movement: 'slow push-in',
    keywords: ['vast landscape', 'atmospheric depth', 'natural lighting'],
  },
  reveal: {
    shot_type: 'medium shot',
    movement: 'slow pull-out',
    keywords: ['reveal lighting', 'focused depth of field', 'dramatic entrance'],
  },
  confrontation: {
    shot_type: 'medium wide shot',
    movement: 'static',
    keywords: ['tense stillness', 'deep shadows', 'symmetrical composition'],
  },
  action: {
    shot_type: 'dynamic tracking shot',
    movement: 'smooth tracking',
    keywords: ['dynamic motion', 'motion blur', 'rapid camera movement'],
  },
  impact: {
    shot_type: 'close-up',
    movement: 'handheld shake',
    keywords: ['impact detail', 'debris scattering', 'shockwave visible'],
  },
  climax: {
    shot_type: 'low-angle wide shot',
    movement: 'orbit',
    keywords: ['epic scale', 'volumetric particles', 'dramatic light rays'],
  },
  ending: {
    shot_type: 'wide shot',
    movement: 'slow pull-out',
    keywords: ['fading light', 'meditative tone', 'silence visual'],
  },
}

// ============================================================
// ShotNode → VideoPromptSpec
// ============================================================

export function shotToSpec(shot: ShotNode): VideoPromptSpec {
  const cameraDefaults = INTENT_CAMERA_MAP[shot.intent] || INTENT_CAMERA_MAP.reveal

  // 镜头类型——shot.camera 优先，否则按意图默认
  const shotType = shot.camera.type || cameraDefaults.shot_type
  const movement = shot.camera.movement || cameraDefaults.movement

  // 主体
  // ⚠️ 防御：shot.subject 元素可能为对象（如 { name: 'Alice' }）
  const subject0 = shot.subject[0]
  const mainSubjectRaw = typeof subject0 === 'object' && subject0 !== null
    ? String((subject0 as Record<string, unknown>).name || '')
    : String(subject0 || '')
  const mainSubject = mainSubjectRaw || 'character'
  const secondarySubjects = shot.subject.slice(1)

  // 环境
  const environment = {
    location: shot.spatialFrame || 'a cinematic setting',
    atmosphere: buildAtmosphere(shot.intent, shot.vfx),
  }

  // VFX
  const vfx = buildVFX(shot)

  // 风格关键词
  const styleKeywords = [
    ...cameraDefaults.keywords,
    'cinematic color grading',
    'ultra detailed',
    'professional lighting',
  ]

  return {
    camera: {
      shot_type: shotType,
      movement,
    },
    subject: {
      main: mainSubject + ' ' + shot.action,
      secondary: secondarySubjects.length > 0 ? secondarySubjects : undefined,
    },
    action: shot.action,
    environment,
    vfx,
    style: {
      cinematic: true,
      keywords: styleKeywords,
    },
  }
}

// ============================================================
// ShotGraph → Multi-shot Specs
// ============================================================

export interface ShotSpecResult {
  shotId: string
  intent: string
  spec: VideoPromptSpec
  action: string
}

export function shotGraphToSpecs(graph: ShotGraph): ShotSpecResult[] {
  return graph.shots.map(shot => ({
    shotId: shot.id,
    intent: shot.intent,
    spec: shotToSpec(shot),
    action: shot.action,
  }))
}

// ============================================================
// Helpers
// ============================================================

function buildAtmosphere(intent: string, vfx: string[]): string {
  const intentAtmos: Record<string, string> = {
    establishing: 'wide atmospheric vista with dramatic lighting',
    reveal: 'focused lighting on subject, surrounding environment in soft shadow',
    confrontation: 'tense stillness, sharp contrast between light and shadow',
    action: 'dynamic environment reacting to motion, dust particles suspended',
    impact: 'debris-filled air, shockwaves visible as distortion rings',
    climax: 'apocalyptic light rays piercing through dust and energy particles',
    ending: 'fading ambient light, silhouettes against dim background',
  }

  const base = intentAtmos[intent] || 'cinematic atmosphere'

  // 如果 vfx 里有能量特效，增强氛围描述
  const hasEnergy = vfx.some(v => /能量|光|aura|energy|glow|发光/i.test(v))
  const hasParticles = vfx.some(v => /粒子|烟雾|碎片|particle|smoke|debris/i.test(v))

  let atmos = base
  if (hasEnergy) atmos += ', energy glow illuminating nearby surfaces'
  if (hasParticles) atmos += ', volumetric floating particles catching light'

  return atmos
}

function buildVFX(shot: ShotNode): VFXSpec {
  const result: VFXSpec = {}
  if (!shot.vfx || shot.vfx.length === 0) return result

  for (const v of shot.vfx) {
    if (/energy|光|aura|glow|发光|辉光|光晕|光柱|剑气/.test(v)) {
      if (!result.energy) result.energy = []
      result.energy.push(v)
    } else if (/particle|粒子|火花|火星|烟雾|dust|float/.test(v)) {
      if (!result.particles) result.particles = []
      result.particles.push(v)
    } else {
      if (!result.physics) result.physics = []
      result.physics.push(v)
    }
  }

  return result
}
