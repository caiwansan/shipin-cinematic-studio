/**
 * Director Prompt Compiler
 * 
 * 编译管线：导演意图 → 镜头语义 → 模型 Prompt
 * 
 * 禁止：
 * - 直接拼接 prompt
 * - 模板字符串 prompt
 * 
 * 必须：
 * - 导演语义分析 → 镜头语言设计 → 模型适配编译
 */

import type {
  CinematicShotDescriptor,
  CompiledPrompt,
  ShotType,
  CameraMotion,
  CompositionStyle,
  LightingStyle,
} from './share.types.js'

// ============================================================
// Model Adapter Registry
// ============================================================

type ModelId = 'kling' | 'veo' | 'runway' | 'sora' | 'seedance' | 'midjourney'

interface ModelAdapter {
  id: ModelId
  name: string
  supports: string[]
  maxPromptLength: number
  preferredAspectRatio: string[]
  tokenize: (shot: CinematicShotDescriptor, visualStyle: any) => string
}

// ============================================================
// Prompt Compiler
// ============================================================

class DirectorPromptCompiler {
  private adapters = new Map<ModelId, ModelAdapter>()

  constructor() {
    this.registerAdapters()
  }

  private registerAdapters() {
    this.adapters.set('kling', {
      id: 'kling',
      name: 'Kling',
      supports: ['video', 'image'],
      maxPromptLength: 2000,
      preferredAspectRatio: ['16:9', '9:16'],
      tokenize: (shot, style) => this._klingPrompt(shot, style),
    })

    this.adapters.set('veo', {
      id: 'veo',
      name: 'Veo',
      supports: ['video'],
      maxPromptLength: 500,
      preferredAspectRatio: ['16:9', '2.35:1'],
      tokenize: (shot, style) => this._veoPrompt(shot, style),
    })

    this.adapters.set('runway', {
      id: 'runway',
      name: 'Runway Gen-3',
      supports: ['video', 'image'],
      maxPromptLength: 1000,
      preferredAspectRatio: ['16:9', '9:16'],
      tokenize: (shot, style) => this._runwayPrompt(shot, style),
    })

    this.adapters.set('midjourney', {
      id: 'midjourney',
      name: 'Midjourney',
      supports: ['image'],
      maxPromptLength: 3000,
      preferredAspectRatio: ['16:9', '2.35:1', '1:1'],
      tokenize: (shot, style) => this._midjourneyPrompt(shot, style),
    })
  }

  /**
   * 编译流程：CinematicShotDescriptor → 模型专用 Prompt
   */
  compile(
    shot: CinematicShotDescriptor,
    visualStyle: any,
    modelId: ModelId = 'kling',
  ): CompiledPrompt {
    const adapter = this.adapters.get(modelId)
    if (!adapter) {
      return this._fallbackPrompt(shot)
    }

    const prompt = adapter.tokenize(shot, visualStyle)

    const [width, height] = this._getDimensions(
      shot.aspectRatio,
      adapter.preferredAspectRatio,
    )

    return {
      modelId,
      prompt: prompt.slice(0, adapter.maxPromptLength),
      parameters: {
        width,
        height,
        duration: shot.duration * 2, // 帧率换算
        fps: 24,
        stylePreset: visualStyle?.referenceStyle || 'cinematic',
      },
      shotInfo: {
        shotType: shot.shotType,
        cameraMotion: shot.cameraMotion,
        composition: shot.composition,
        lighting: shot.lighting,
        lensInfo: shot.lens,
      },
    }
  }

  // ============================================================
  // Model-Specific Prompt 生成
  // ============================================================

  private _klingPrompt(shot: CinematicShotDescriptor, style: any): string {
    const parts = [
      `Cinematic shot: ${shot.description}`,
      `Camera: ${shot.lens} lens, ${shot.cameraMotion} motion`,
      `Composition: ${shot.composition}, ${shot.shotType} framing`,
      `Lighting: ${shot.lighting}, depth of field: ${shot.depthOfField}`,
      `Aspect ratio: ${shot.aspectRatio}`,
    ]
    if (style?.colorPalette) parts.push(`Color palette: ${style.colorPalette}`)
    if (style?.lighting) parts.push(`Overall lighting style: ${style.lighting}`)
    parts.push('Cinematic, professional lighting, high detail, realistic textures')

    return parts.join(', ')
  }

  private _veoPrompt(shot: CinematicShotDescriptor, style: any): string {
    return `${shot.description}. Shot on ${shot.lens} lens, ${shot.shotType}, ${shot.cameraMotion}. ${shot.composition} composition, ${shot.lighting} lighting.`
  }

  private _runwayPrompt(shot: CinematicShotDescriptor, style: any): string {
    const shotMap: Record<ShotType, string> = {
      extreme_wide: 'extreme wide shot',
      wide: 'wide shot',
      full: 'full shot',
      medium: 'medium shot',
      medium_close_up: 'medium close-up',
      close_up: 'close-up',
      extreme_close_up: 'extreme close-up',
      over_shoulder: 'over-the-shoulder shot',
      two_shot: 'two-shot',
      insert: 'insert shot',
    }
    return `[${shotMap[shot.shotType] || 'medium shot'}] ${shot.description}. ${shot.cameraMotion}. Detailed cinematic scene.`
  }

  private _midjourneyPrompt(shot: CinematicShotDescriptor, style: any): string {
    const parts = [
      `Shot on ${shot.lens} lens, ${shot.shotType}`,
      shot.description,
      `Cinematic lighting: ${shot.lighting}`,
      `Composition: ${shot.composition}`,
      `Camera movement: ${shot.cameraMotion}`,
    ]
    if (style?.colorPalette) parts.push(`Color grading: ${style.colorPalette}`)
    parts.push('--ar ' + shot.aspectRatio.replace(':', ':'))
    parts.push('--style raw')
    parts.push('--s 250')

    return parts.join(' :: ')
  }

  /**
   * Fallback — 任何适配器不存在时的降级 Prompt
   */
  private _fallbackPrompt(shot: CinematicShotDescriptor): CompiledPrompt {
    return {
      modelId: 'kling',
      prompt: shot.description || 'A cinematic scene',
      parameters: { width: 1920, height: 1080, duration: 6, fps: 24 },
      shotInfo: {
        shotType: shot.shotType,
        cameraMotion: shot.cameraMotion,
        composition: shot.composition,
        lighting: shot.lighting,
        lensInfo: shot.lens,
      },
    }
  }

  private _getDimensions(aspectRatio: string, preferred: string[]): [number, number] {
    const map: Record<string, [number, number]> = {
      '16:9': [1920, 1080],
      '2.35:1': [1920, 817],
      '4:3': [1440, 1080],
      '1:1': [1080, 1080],
      '9:16': [1080, 1920],
    }

    // 使用模型偏好的宽高比
    for (const pref of preferred) {
      if (map[pref]) return map[pref]
    }

    return map[aspectRatio] || [1920, 1080]
  }
}

export const directorPromptCompiler = new DirectorPromptCompiler()
