/**
 * cinematic-compiler.ts — CET (Cinematic Execution Translator)
 *
 * 把 ExecutionPlan 的"结构正确"翻译成"模型能生成高质量视频"的语言。
 *
 * 核心翻译规则（5 条）：
 *   1. Motion Synthesis — 动作物理化（惯性、次运动、权重偏移）
 *   2. Camera Emotional Mapping — 镜头翻译为情绪函数
 *   3. Temporal Micro-Consistency — 帧间微观连续性（缓动曲线、重叠提示）
 *   4. Physical Constraint Injection — 物理一致性（重力、布料、接触）
 *   5. Model Adapter Language — 模型特定的提示风格化
 */
import type { ExecutionPlan, ShotPlan } from '../render/backends/execution-plan.js'

// ============================================================
// CET Input / Output Types
// ============================================================

export interface CETInput {
  plan: ExecutionPlan
  intent?: {
    genre?: string
    mood?: string
    pacing?: string
  }
  backendName?: string
  context?: {
    isContinuation?: boolean
    previousShotId?: string
    sceneTransition?: string
  }
}

export interface CETOutput {
  motion: MotionSynthesisDirective[]
  camera: CameraDirective[]
  temporal: TemporalDirective
  physics: PhysicsDirective
  modelPrompt: ModelPrompt
  compiledString: string
}

// ============================================================
// Motion Synthesis
// ============================================================

export interface MotionSynthesisDirective {
  shotId: string
  primaryAction: string
  /** 基础动作分类 */
  actionCategory: 'locomotion' | 'gesture' | 'facial' | 'interaction' | 'idle' | 'transition'
  inertia: {
    enabled: boolean
    /** 惯性延续帧数 */
    continuationFrames: number
    description: string
  }
  secondaryMotion: {
    enabled: boolean
    /** 次运动类型 */
    type: 'cloth' | 'hair' | 'accessory' | 'breathing' | 'micro_expression'
    description: string
  }
  weightShift: {
    priority: 'on_weight' | 'anticipation' | 'recovery'
    description: string
  }
  realismHint: string
}

export class MotionSynthesizer {
  /**
   * 为 shot 生成运动合成指令
   */
  synthesize(shot: ShotPlan, context?: CETInput['context']): MotionSynthesisDirective {
    const action = this.classifyAction(shot)
    return {
      shotId: shot.shotId,
      primaryAction: shot.script,
      actionCategory: action.category,
      inertia: this.buildInertia(action.category),
      secondaryMotion: this.buildSecondaryMotion(action.category),
      weightShift: this.buildWeightShift(action.category),
      realismHint: this.buildRealismHint(action.category, context),
    }
  }

  private classifyAction(shot: ShotPlan): { category: MotionSynthesisDirective['actionCategory']; description: string } {
    const text = shot.script.toLowerCase()
    if (/walk|run|move|approach|step|advance|retreat/i.test(text)) return { category: 'locomotion', description: 'locomotion with weight transfer' }
    if (/wave|point|reach|grab|hold|throw|push|pull/i.test(text)) return { category: 'gesture', description: 'gesture with anticipation-settle arc' }
    if (/smile|frown|laugh|cry|look|glare|stare|wince/i.test(text)) return { category: 'facial', description: 'micro-expression with subtle onset' }
    if (/hug|kiss|fight|handshake|collide/i.test(text)) return { category: 'interaction', description: 'interaction with contact physics' }
    if (/wait|stand|sit|lie|rest|pause|stare|observe/i.test(text)) return { category: 'idle', description: 'idle with breathing micro-motion' }
    return { category: 'transition', description: 'scene transition with motion blur' }
  }

  private buildInertia(category: MotionSynthesisDirective['actionCategory']): MotionSynthesisDirective['inertia'] {
    const frameMap: Record<string, number> = {
      locomotion: 8, gesture: 6, facial: 4, interaction: 10, idle: 12, transition: 6,
    }
    const descMap: Record<string, string> = {
      locomotion: 'body continues momentum after stop, weight settles over 8 frames',
      gesture: 'hand settles with micro-oscillation, 6-frame follow-through',
      facial: 'expression lingers before dissolving, 4-frame soft release',
      interaction: 'recoil/response with 10-frame physical propagation',
      idle: 'subtle breathing continuity, 12-frame micro-cycle',
      transition: 'motion blur crossfade, 6-frame overlap',
    }
    return { enabled: true, continuationFrames: frameMap[category] || 6, description: descMap[category] || '' }
  }

  private buildSecondaryMotion(category: MotionSynthesisDirective['actionCategory']): MotionSynthesisDirective['secondaryMotion'] {
    if (category === 'locomotion' || category === 'gesture') {
      return { enabled: true, type: 'cloth', description: 'cloth/hair drag follows primary motion with 3-5 frame delay' }
    }
    if (category === 'idle') {
      return { enabled: true, type: 'breathing', description: 'subtle chest rise, head micro-sway' }
    }
    if (category === 'facial') {
      return { enabled: true, type: 'micro_expression', description: 'eye movement precedes head turn, blink sync' }
    }
    return { enabled: false, type: 'cloth', description: 'no significant secondary motion' }
  }

  private buildWeightShift(category: MotionSynthesisDirective['actionCategory']): MotionSynthesisDirective['weightShift'] {
    const map: Record<string, MotionSynthesisDirective['weightShift']> = {
      locomotion: { priority: 'on_weight', description: 'weight transfers through stance leg before next step' },
      gesture: { priority: 'anticipation', description: 'slight body lean in direction of gesture before arm moves' },
      interaction: { priority: 'anticipation', description: 'pre-contact windup, post-contact follow-through' },
      facial: { priority: 'recovery', description: 'muscle relaxation after expression peak' },
      idle: { priority: 'recovery', description: 'weight shift between standing legs every 2-3 seconds' },
      transition: { priority: 'on_weight', description: 'momentum carries through transition boundary' },
    }
    return map[category] || { priority: 'recovery', description: 'natural weight distribution' }
  }

  private buildRealismHint(category: MotionSynthesisDirective['actionCategory'], context?: CETInput['context']): string {
    const base = `[MOTION_REALISM] ${this.buildInertia(category).description}; ${this.buildSecondaryMotion(category).description}`
    if (context?.isContinuation) {
      return `${base}; [CONTINUITY] motion carries from previous shot, no reset`
    }
    return base
  }
}

// ============================================================
// Camera Emotional Mapping
// ============================================================

export interface CameraDirective {
  shotId: string
  cameraType: string
  emotionalMeaning: string
  movementDescription: string
  cinematicWeight: number
  recommendedDuration: number
  emotionMapping: {
    tensionDelta: number
    intimacyLevel: number
    powerDynamics: 'dominant' | 'submissive' | 'equal'
  }
}

export class CameraGrammarTranslator {
  translate(shot: ShotPlan, mood?: string): CameraDirective {
    const cameraType = shot.cameraMotion || 'medium'
    const mapping = this.mapEmotion(cameraType, mood)
    return {
      shotId: shot.shotId,
      cameraType,
      emotionalMeaning: mapping.emotionalMeaning,
      movementDescription: this.describeMovement(cameraType),
      cinematicWeight: mapping.weight,
      recommendedDuration: mapping.duration,
      emotionMapping: {
        tensionDelta: mapping.tensionDelta,
        intimacyLevel: mapping.intimacyLevel,
        powerDynamics: mapping.powerDynamics,
      },
    }
  }

  private mapEmotion(type: string, mood?: string): {
    emotionalMeaning: string
    weight: number
    duration: number
    tensionDelta: number
    intimacyLevel: number
    powerDynamics: CameraDirective['emotionMapping']['powerDynamics']
  } {
    const lower = type.toLowerCase()
    if (lower.includes('push') || lower.includes('zoom_in')) {
      return {
        emotionalMeaning: 'intimacy increase, tension escalation, reveals inner state',
        weight: 1.4, duration: 2.5, tensionDelta: 0.3, intimacyLevel: 0.8, powerDynamics: 'dominant',
      }
    }
    if (lower.includes('pull') || lower.includes('zoom_out')) {
      return {
        emotionalMeaning: 'emotional distancing, isolation, contextual revelation',
        weight: 1.3, duration: 3.0, tensionDelta: -0.2, intimacyLevel: 0.2, powerDynamics: 'equal',
      }
    }
    if (lower.includes('dolly') || lower.includes('track') || lower.includes('follow')) {
      return {
        emotionalMeaning: mood === 'thriller' ? 'pursuit tension, voyeuristic observation' : 'narrative progression, character journey',
        weight: 1.2, duration: 4.0, tensionDelta: 0.1, intimacyLevel: 0.5, powerDynamics: 'equal',
      }
    }
    if (lower.includes('handheld') || lower.includes('shaky') || lower.includes('whip')) {
      return {
        emotionalMeaning: 'chaos, urgency, subjective panic, documentary realism',
        weight: 0.9, duration: 1.5, tensionDelta: 0.4, intimacyLevel: 0.7, powerDynamics: 'submissive',
      }
    }
    if (lower.includes('aerial') || lower.includes('crane') || lower.includes('bird')) {
      return {
        emotionalMeaning: 'omniscient perspective, scale revelation, narrative detachment',
        weight: 0.8, duration: 5.0, tensionDelta: -0.1, intimacyLevel: 0.1, powerDynamics: 'dominant',
      }
    }
    if (lower.includes('stable') || lower.includes('tripod') || lower.includes('locked')) {
      return {
        emotionalMeaning: 'objective observation, neutral documentation, truth-telling',
        weight: 1.0, duration: 3.0, tensionDelta: 0, intimacyLevel: 0.4, powerDynamics: 'equal',
      }
    }
    // default
    return {
      emotionalMeaning: 'neutral observation, balanced viewpoint',
      weight: 1.0, duration: 2.5, tensionDelta: 0, intimacyLevel: 0.4, powerDynamics: 'equal',
    }
  }

  private describeMovement(type: string): string {
    const lower = type.toLowerCase()
    if (lower.includes('push')) return 'smooth linear advance, decelerating at peak'
    if (lower.includes('pull')) return 'smooth linear retreat, slight arc to maintain composition'
    if (lower.includes('dolly')) return 'lateral tracking, parallax depth separation'
    if (lower.includes('handheld')) return 'organic micro-bounce, 2-5Hz frequency, amplitude 0.5-2px'
    if (lower.includes('aerial')) return 'slow reveal arc, horizon-level rotation lock'
    if (lower.includes('stable')) return 'zero micro-jitter, precise composition lock'
    return 'smooth continuous motion, no sudden stops'
  }
}

// ============================================================
// Temporal Micro-Consistency
// ============================================================

export interface TemporalDirective {
  /** 缓动曲线类型 */
  easingCurve: string
  /** 帧重叠提示 */
  frameOverlapHints: string[]
  /** continuity anchors */
  continuityAnchors: string[]
  /** micro-expression carryover */
  microExpressionCarryover: string[]
  /** 跨帧约束 */
  crossFrameConstraints: string[]
}

export class TemporalMicroInjector {
  inject(shots: ShotPlan[], context?: CETInput['context']): TemporalDirective {
    const anchors = this.buildContinuityAnchors(shots)
    return {
      easingCurve: 'ease-in-out-cubic, 12-frame blend zone at shot boundaries',
      frameOverlapHints: this.buildOverlapHints(shots),
      continuityAnchors: anchors,
      microExpressionCarryover: this.buildMicroExpressionCarryover(shots),
      crossFrameConstraints: this.buildCrossFrameConstraints(shots, context),
    }
  }

  private buildOverlapHints(shots: ShotPlan[]): string[] {
    const hints: string[] = []
    for (let i = 1; i < shots.length; i++) {
      hints.push(`shot ${shots[i - 1].shotId}→${shots[i].shotId}: 6-frame overlap blend zone, identity lock active, camera path eased across boundary`)
    }
    return hints
  }

  private buildContinuityAnchors(shots: ShotPlan[]): string[] {
    const anchors: string[] = []
    for (const shot of shots) {
      // 提取 identity character 作为 continuity anchors
      const id = (shot as any).identityCharacters
      if (Array.isArray(id) && id.length > 0) {
        anchors.push(`character "${id[0]}": screen position continuity, proportional framing lock, eye-line consistency`)
      }
      anchors.push(`lighting continuity: ${shot.lightingState || 'consistent'} across shot boundary`)
      anchors.push(`camera: ${shot.cameraMotion || 'stable'} — path continuity with eased acceleration/deceleration`)
    }
    return anchors
  }

  private buildMicroExpressionCarryover(shots: ShotPlan[]): string[] {
    const carryovers: string[] = []
    for (let i = 1; i < shots.length; i++) {
      carryovers.push(`shot ${shots[i - 1].shotId}→${shots[i].shotId}: expression state carryover, no face reset, micro-emotion persists`)
    }
    return carryovers
  }

  private buildCrossFrameConstraints(shots: ShotPlan[], context?: CETInput['context']): string[] {
    const constraints: string[] = []
    constraints.push('[HARD] scene geometry anchor: object positions persist across frames, no warping')
    constraints.push('[HARD] character identity: face structure invariant, no style shift between frames')
    constraints.push('[SOFT] motion path: object trajectory uses spline interpolation, not linear')
    constraints.push('[SOFT] background consistency: static elements remain static, no background drift')
    if (context?.sceneTransition) {
      constraints.push(`[HARD] transition: ${context.sceneTransition}, use dissolve/motion blur, no hard cut without anchor`)
    }
    return constraints
  }
}

// ============================================================
// Physical Constraint Injection
// ============================================================

export interface PhysicsDirective {
  constraints: string[]
  realismMarkers: string[]
  contactRealism: boolean
  gravityConsistency: boolean
  clothInertia: boolean
  headBodyLag: boolean
}

export class PhysicsConstraintInjector {
  inject(): PhysicsDirective {
    return {
      constraints: [
        '[HARD] gravity direction consistent across all frames, -9.8m/s² implied',
        '[HARD] contact points: feet on ground plane, no floating/passing through objects',
        '[SOFT] cloth follows body motion with 3-5 frame phase delay',
        '[SOFT] head rotation precedes torso rotation (neck-lead principle)',
        '[SOFT] object weight: heavy items accelerate slower, light items have more air resistance',
        '[SOFT] water/dust/particle physics follow momentum from primary action',
      ],
      realismMarkers: [
        'REALISM_FLAG: no simple linear interpolation between keyframes',
        'REALISM_FLAG: secondary motion delay (cloth/hair/accessories)',
        'REALISM_FLAG: weight-shift anticipation before locomotion',
        'REALISM_FLAG: breathing idle micro-motion when character stationary',
      ],
      contactRealism: true,
      gravityConsistency: true,
      clothInertia: true,
      headBodyLag: true,
    }
  }
}

// ============================================================
// Model Adapter Language Layer
// ============================================================

export interface ModelPrompt {
  modelName: string
  styleTokens: string[]
  motionTokens: string[]
  qualityTokens: string[]
  structuralHints: string[]
  compiledPrompt: string
}

export class ModelLanguageAdapter {
  adapt(structurePrompt: string, modelName: string = 'runway'): ModelPrompt {
    const config = this.getModelConfig(modelName)

    const fullPrompt = [
      ...config.stylePrefix,
      structurePrompt,
      ...config.motionSuffix,
      ...config.qualitySuffix,
    ].join('\n')

    return {
      modelName,
      styleTokens: config.stylePrefix,
      motionTokens: config.motionSuffix,
      qualityTokens: config.qualitySuffix,
      structuralHints: config.structuralHints,
      compiledPrompt: fullPrompt,
    }
  }

  private getModelConfig(model: string): {
    stylePrefix: string[]
    motionSuffix: string[]
    qualitySuffix: string[]
    structuralHints: string[]
  } {
    const name = model.toLowerCase()

    // Runway Gen-3/4 — 注重运动动词 + 电影语法
    if (name === 'runway' || name === 'gen3' || name === 'gen4') {
      return {
        stylePrefix: [
          '[STYLE] cinematic, filmic, photorealistic, 4K',
          '[STYLE] shallow depth of field, anamorphic lens',
          '[STYLE] professional lighting, volumetric atmosphere',
        ],
        motionSuffix: [
          '[MOTION] smooth continuous movement, no teleporting',
          '[MOTION] secondary motion: cloth/hair follows with natural delay',
          '[MOTION] inertia: momentum carries through movement end',
          '[MOTION] weight shift anticipation before direction change',
        ],
        qualitySuffix: [
          '[QUALITY] 24fps film cadence, 180-degree shutter rule',
          '[QUALITY] consistent character rendering, no morphing',
          '[QUALITY] realistic texture detail, skin subsurface scattering',
          '[QUALITY] grain: subtle film grain, not digital noise',
        ],
        structuralHints: [
          'use cinematic verbs (glides, sweeps, follows) not technical camera terms',
          'chain motion through continuous path, not keyframe jumps',
          'scene geometry: enforce depth layers for parallax',
        ],
      }
    }

    // Pika — 注重场景边界 + 物体清晰度
    if (name === 'pika') {
      return {
        stylePrefix: [
          '[STYLE] high quality, detailed, visually stunning',
          '[STYLE] clear subject definition, sharp focus on protagonist',
          '[STYLE] cohesive color palette, atmospheric',
        ],
        motionSuffix: [
          '[MOTION] smooth motion, no sudden movement',
          '[MOTION] scene transitions: use match cuts or dissolves',
          '[MOTION] character motion: fluid, natural, not mechanical',
        ],
        qualitySuffix: [
          '[QUALITY] consistent scene structure',
          '[QUALITY] minimal visual drift across frames',
          '[QUALITY] stable character features, identity preserved',
        ],
        structuralHints: [
          'use scene boundaries as natural pauses',
          'object clarity priority: foreground > background',
          'avoid fast camera movement to prevent blur',
        ],
      }
    }

    // Sora — 注重全局连贯性 + 长程一致性
    if (name === 'sora') {
      return {
        stylePrefix: [
          '[STYLE] photorealistic, cinematic, feature-film quality',
          '[STYLE] consistent world geometry, physics-accurate environment',
          '[STYLE] professional cinematography, dynamic lighting',
        ],
        motionSuffix: [
          '[MOTION] complex character motion with physical accuracy',
          '[MOTION] multiple interacting elements with consistent behavior',
          '[MOTION] camera moves with narrative intent, not arbitrary',
        ],
        qualitySuffix: [
          '[QUALITY] long-horizon consistency across entire scene',
          '[QUALITY] no object morphing or appearance drift',
          '[QUALITY] coherent lighting scene-wide, no local flicker',
          '[QUALITY] persistent character identity across cuts',
        ],
        structuralHints: [
          'use shot-level time dilation for complex motion',
          'global scene graph: maintain spatial relationships',
          'character consistency across all frames',
        ],
      }
    }

    // 通用 fallback
    return {
      stylePrefix: [
        '[STYLE] cinematic, high quality, detailed',
        '[STYLE] consistent visual identity throughout',
      ],
      motionSuffix: [
        '[MOTION] smooth natural motion, physical realism',
        '[MOTION] avoid sudden appearance changes',
      ],
      qualitySuffix: [
        '[QUALITY] consistent rendering, no quality drops',
        '[QUALITY] character and environment stability',
      ],
      structuralHints: [
        'maintain consistency across generated frames',
      ],
    }
  }
}

// ============================================================
// CET Orchestrator
// ============================================================

export class CinematicExecutionTranslator {
  private motionSynthesizer = new MotionSynthesizer()
  private cameraTranslator = new CameraGrammarTranslator()
  private temporalInjector = new TemporalMicroInjector()
  private physicsInjector = new PhysicsConstraintInjector()
  private modelAdapter = new ModelLanguageAdapter()

  /**
   * 完整翻译管线
   */
  translate(input: CETInput): CETOutput {
    const shots = input.plan.shots
    const backend = input.backendName || 'runway'

    // 1. Motion Synthesis — 逐镜头
    const motion = shots.map((shot, i) => {
      const context = i > 0 ? {
        isContinuation: shot.dependencies.length > 0,
        previousShotId: shots[i - 1].shotId,
        sceneTransition: this.detectTransition(shots[i - 1], shot),
      } : undefined
      return this.motionSynthesizer.synthesize(shot, context)
    })

    // 2. Camera Emotional Mapping — 逐镜头
    const camera = shots.map(shot => this.cameraTranslator.translate(shot, input.intent?.mood))

    // 3. Temporal Micro-Consistency
    const temporal = this.temporalInjector.inject(shots, input.context)

    // 4. Physical Constraints
    const physics = this.physicsInjector.inject()

    // 5. 组合为结构化 prompt
    const rawStructure = this.buildStructurePrompt(motion, camera, temporal, physics, shots)
    const modelPrompt = this.modelAdapter.adapt(rawStructure, backend)

    // 6. 最终 compiled string
    const compiledString = modelPrompt.compiledPrompt

    return { motion, camera, temporal, physics, modelPrompt, compiledString }
  }

  private buildStructurePrompt(
    motion: MotionSynthesisDirective[],
    camera: CameraDirective[],
    temporal: TemporalDirective,
    physics: PhysicsDirective,
    shots: ShotPlan[],
  ): string {
    const parts: string[] = []

    parts.push('=== SHOT SEQUENCE OVERVIEW ===')
    for (let i = 0; i < shots.length; i++) {
      parts.push(`Shot ${shots[i].shotId}: ${shots[i].script}`)
      parts.push(`  Camera: ${camera[i].cameraType} — ${camera[i].emotionalMeaning}`)
      parts.push(`  Motion: ${motion[i].primaryAction} (${motion[i].actionCategory}) — ${motion[i].realismHint}`)
      if (motion[i].secondaryMotion.enabled) {
        parts.push(`  Secondary: ${motion[i].secondaryMotion.description}`)
      }
    }

    parts.push('')
    parts.push('=== TEMPORAL CONSISTENCY ===')
    parts.push(`Easing: ${temporal.easingCurve}`)
    parts.push(...temporal.frameOverlapHints.map(h => `Overlap: ${h}`))
    parts.push(...temporal.crossFrameConstraints)

    parts.push('')
    parts.push('=== PHYSICAL CONSTRAINTS ===')
    parts.push(...physics.constraints)
    parts.push(...physics.realismMarkers.map(m => `!${m}`))

    return parts.join('\n')
  }

  private detectTransition(prev: ShotPlan, curr: ShotPlan): string | undefined {
    if (prev.sceneLocation !== curr.sceneLocation) return `location change: ${prev.sceneLocation} → ${curr.sceneLocation}`
    if (prev.lightingState !== curr.lightingState) return `lighting shift: ${prev.lightingState} → ${curr.lightingState}`
    return undefined
  }
}

/** CET singleton */
export const cet = new CinematicExecutionTranslator()
