/**
 * CCP — CIR → Semantic IR 编译器
 *
 * 职责：将 CIR（结构化）编译为 Semantic IR（语义化但仍是 Provider 无关的描述）
 * 规则：保持 Provider 无关，不产生任何 Prompt 文本
 */

import type { CirV1 } from './cir-v1.js'
import type { SemanticIR, SemanticIrShot } from './ccp-types.js'

/**
 * CIR → Semantic IR 编译
 * 这一层仍然与 Provider 无关。
 * 输出是所有下游编译器的输入。
 */
export function compileToSemanticIr(cir: CirV1): SemanticIR {
  const shots: SemanticIrShot[] = cir.shots.map((shot) => {
    // 编译镜头运动描述（Provider 无关）
    const parts: string[] = []

    // scale
    if (shot.camera.scale) {
      parts.push(`${shot.camera.scale} shot`)
    }

    // angle
    if (shot.camera.angle) {
      parts.push(`${shot.camera.angle} camera angle`)
    }

    // composition
    if (shot.camera.composition) {
      const comp = shot.camera.composition
      const compParts: string[] = []
      if (comp.rule) compParts.push(`composition: ${comp.rule}`)
      if (comp.subjectPosition) compParts.push(`subject at ${comp.subjectPosition}`)
      if (comp.lookRoomDirection) compParts.push(`look room on ${comp.lookRoomDirection}`)
      parts.push(compParts.join(', '))
    }

    // focal
    if (shot.camera.focus) {
      const f = shot.camera.focus
      const focusParts: string[] = [`focus on ${f.target}`]
      if (f.depthOfField) focusParts.push(`${f.depthOfField} depth of field`)
      if (f.rackFocus) {
        focusParts.push(`rack focus from ${f.rackFocus.fromTarget} to ${f.rackFocus.toTarget} (on cue: ${f.rackFocus.cue})`)
      }
      parts.push(focusParts.join(', '))
    }

    // motion
    if (shot.camera.motion) {
      parts.push(`camera motion: ${shot.camera.motion.pattern}`)
    }
    if (shot.camera.path) {
      parts.push(`camera path: ${shot.camera.path.type}`)
    }

    const motionDescription = parts.join('; ') || 'standard shot'

    // lighting
    let lightingDescription = ''
    if (shot.lighting) {
      const l = shot.lighting
      const lightParts: string[] = []
      if (l.keyLightDirection) lightParts.push(`key light from ${l.keyLightDirection}`)
      if (l.colorTemperature) lightParts.push(`${l.colorTemperature} color temperature`)
      if (l.mood) lightParts.push(`${l.mood} mood`)
      if (l.continuity) lightParts.push('lighting continuous across cuts')
      lightingDescription = lightParts.join(', ')
    }

    // composition description (pure semantic)
    let compositionDesc = ''
    if (shot.camera.composition) {
      const c = shot.camera.composition
      const cParts: string[] = [c.rule]
      if (c.subjectPosition) cParts.push(`subject at ${c.subjectPosition}`)
      if (c.lookRoomDirection) cParts.push(`look room direction ${c.lookRoomDirection}`)
      compositionDesc = cParts.join(', ')
    }

    // focus description
    let focusDesc = ''
    if (shot.camera.focus) {
      const f = shot.camera.focus
      focusDesc = `focus on ${f.target}`
    }

    return {
      id: shot.id,
      description: shot.description,
      durationSeconds: shot.durationSeconds,
      characterIds: shot.characterIds,
      actions: shot.actions,
      dialogue: shot.dialogue,
      camera: {
        motionDescription,
        scale: shot.camera.scale || 'medium',
        angle: shot.camera.angle || 'eye',
        compositionDescription: compositionDesc,
        focusDescription: focusDesc,
      },
      lightingDescription,
      narrativePurpose: shot.narrativePurpose,
    }
  })

  // 编译场景摘要
  const env = cir.scene.environment
  const environmentSummary = `${env.location} at ${env.timeOfDay}, ${env.weather}, ${env.atmosphere}`

  return {
    version: cir.version,
    scene: {
      title: cir.scene.title,
      environmentSummary,
    },
    characters: cir.characters.map(c => ({
      id: c.id,
      name: c.name,
      appearance: c.appearance,
      emotion: c.emotion,
    })),
    shots,
    storyIntent: cir.storyIntent.story,
    cinematicIntent: cir.storyIntent.cinematic,
    constraints: {
      fps: cir.constraints?.fps || 24,
      resolution: cir.constraints?.resolution || '1920x1080',
      maxDuration: cir.constraints?.maxDuration || 30,
    },
  }
}
