/**
 * Cinematic Rules — 镜头规则库
 *
 * 将导演意图/情绪/节奏映射为具体的镜头语言参数。
 * 规则引擎优先于 AI 随机生成，确保镜头设计有据可依。
 *
 * 使用方式：
 *   const shot = CinematicRules.getShotForEmotion('紧张', 'escalation')
 *   // → { shotType: 'close_up', cameraMotion: 'handheld', lighting: 'dramatic', lens: '85mm' }
 */

// ============================================================
// 情绪 → 镜头映射规则
// ============================================================

export interface CinematicRule {
  shotType: string
  lens: string
  cameraMotion: string
  composition: string
  lighting: string
  depthOfField: string
  reasoning: string
}

export interface AtmosphereRule {
  colorPalette: string[]
  lightingDescription: string
  timeOfDay: string
  weather: string
}

export interface RhythmRule {
  hookInterval: number  // 钩子间隔秒数
  intensityTarget: number
  preferredShotTypes: string[]
}

// ============================================================
// 情绪 → 镜头规则表
// ============================================================

export const EMOTION_TO_SHOT: Record<string, CinematicRule> = {
  '紧张': {
    shotType: 'close_up',
    lens: '85mm',
    cameraMotion: 'handheld',
    composition: 'dutch',
    lighting: 'dramatic',
    depthOfField: 'shallow',
    reasoning: '近距离特写 + 手持晃动增强紧张感，浅景深聚焦面部微表情',
  },
  '恐惧': {
    shotType: 'extreme_close_up',
    lens: '135mm',
    cameraMotion: 'dolly_in',
    composition: 'dutch',
    lighting: 'low_key',
    depthOfField: 'shallow',
    reasoning: '极近景 + 推进镜头制造压迫感，低光营造恐惧氛围',
  },
  '悲伤': {
    shotType: 'medium_close_up',
    lens: '50mm',
    cameraMotion: 'static',
    composition: 'rule_of_thirds',
    lighting: 'natural',
    depthOfField: 'medium',
    reasoning: '静态镜头给角色呼吸空间，50mm 模拟人眼视角更有共情感',
  },
  '快乐': {
    shotType: 'wide',
    lens: '35mm',
    cameraMotion: 'tracking_right',
    composition: 'centered',
    lighting: 'high_key',
    depthOfField: 'deep',
    reasoning: '广角 + 跟拍展现自由感，高调光增强欢快氛围',
  },
  '愤怒': {
    shotType: 'close_up',
    lens: '50mm',
    cameraMotion: 'handheld',
    composition: 'centered',
    lighting: 'dramatic',
    depthOfField: 'shallow',
    reasoning: '中心构图突出怒气，手持微晃制造不稳定感',
  },
  '惊讶': {
    shotType: 'medium',
    lens: '35mm',
    cameraMotion: 'dolly_in',
    composition: 'centered',
    lighting: 'high_key',
    depthOfField: 'deep',
    reasoning: '中等景别 + 推进突出反应，深景深保持环境上下文',
  },
  '浪漫': {
    shotType: 'close_up',
    lens: '85mm',
    cameraMotion: 'dolly_in',
    composition: 'rule_of_thirds',
    lighting: 'rim_light',
    depthOfField: 'shallow',
    reasoning: '85mm 人像焦段 + 轮廓光营造唯美感，浅景深模糊背景',
  },
  '孤独': {
    shotType: 'wide',
    lens: '24mm',
    cameraMotion: 'static',
    composition: 'deep_space',
    lighting: 'low_key',
    depthOfField: 'deep',
    reasoning: '广角深景深展示空旷空间，小人物大环境突出孤独感',
  },
  '希望': {
    shotType: 'wide',
    lens: '24mm',
    cameraMotion: 'crane_up',
    composition: 'leading_lines',
    lighting: 'natural',
    depthOfField: 'deep',
    reasoning: '广角 + 上升镜头象征希望升起，引导线增强视觉指向',
  },
  '恐惧_期待': {
    shotType: 'medium_close_up',
    lens: '85mm',
    cameraMotion: 'slow_dolly_in',
    composition: 'centered',
    lighting: 'motivated',
    depthOfField: 'shallow',
    reasoning: '缓慢推进制造期待感，85mm 兼具人物关系和氛围',
  },
}

// ============================================================
// 场景氛围 → 镜头参数映射
// ============================================================

export const ATMOSPHERE_TO_VISUAL: Record<string, AtmosphereRule> = {
  '悬疑': {
    colorPalette: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'],
    lightingDescription: 'low_key with practical lights, deep shadows',
    timeOfDay: 'night',
    weather: 'foggy',
  },
  '温馨': {
    colorPalette: ['#f5e6cc', '#d4a373', '#faedcd', '#fefae0'],
    lightingDescription: 'warm golden hour, soft diffused',
    timeOfDay: 'dusk',
    weather: 'clear',
  },
  '末世': {
    colorPalette: ['#2d2d2d', '#4a4a4a', '#8b7355', '#c4a882'],
    lightingDescription: 'overcast with haze, desaturated',
    timeOfDay: 'afternoon',
    weather: 'cloudy',
  },
  '科幻': {
    colorPalette: ['#0a0a2e', '#1a1a4e', '#00d4ff', '#7b2ff7'],
    lightingDescription: 'neon-lit, volumetric fog, cool blue tones',
    timeOfDay: 'night',
    weather: 'clear',
  },
  '古装': {
    colorPalette: ['#8b4513', '#d2b48c', '#f5deb3', '#2f4f4f'],
    lightingDescription: 'natural daylight, soft Chinese paper lantern glow',
    timeOfDay: 'morning',
    weather: 'clear',
  },
  '悬疑_暗黑': {
    colorPalette: ['#0d0d0d', '#1a1a1a', '#2d2d2d', '#8b0000'],
    lightingDescription: 'chiaroscuro with single key light',
    timeOfDay: 'night',
    weather: 'rainy',
  },
}

// ============================================================
// 节奏阶段 → 镜头偏好
// ============================================================

export const PHASE_TO_RHYTHM: Record<string, RhythmRule> = {
  'setup': {
    hookInterval: 20,
    intensityTarget: 4,
    preferredShotTypes: ['wide', 'medium', 'over_shoulder'],
  },
  'tension': {
    hookInterval: 15,
    intensityTarget: 6,
    preferredShotTypes: ['medium_close_up', 'close_up', 'over_shoulder'],
  },
  'escalation': {
    hookInterval: 12,
    intensityTarget: 8,
    preferredShotTypes: ['close_up', 'handheld', 'dutch'],
  },
  'climax': {
    hookInterval: 10,
    intensityTarget: 10,
    preferredShotTypes: ['extreme_close_up', 'close_up', 'wide_chaotic'],
  },
  'release': {
    hookInterval: 25,
    intensityTarget: 3,
    preferredShotTypes: ['wide', 'medium', 'full'],
  },
}

// ============================================================
// 规则查询 API
// ============================================================

class CinematicRulesEngine {
  /**
   * 根据情绪获取镜头配置
   */
  getShotForEmotion(emotion: string): CinematicRule {
    return EMOTION_TO_SHOT[emotion] || EMOTION_TO_SHOT['中性'] || {
      shotType: 'medium',
      lens: '50mm',
      cameraMotion: 'static',
      composition: 'rule_of_thirds',
      lighting: 'natural',
      depthOfField: 'medium',
      reasoning: '默认镜头配置',
    }
  }

  /**
   * 根据氛围获取视觉参数
   */
  getVisualForAtmosphere(atmosphere: string): AtmosphereRule {
    return ATMOSPHERE_TO_VISUAL[atmosphere] || {
      colorPalette: ['#FFFFFF', '#CCCCCC', '#666666', '#333333'],
      lightingDescription: 'natural balanced lighting',
      timeOfDay: 'noon',
      weather: 'clear',
    }
  }

  /**
   * 根据节奏阶段获取参数
   */
  getRhythmForPhase(phase: string): RhythmRule {
    return PHASE_TO_RHYTHM[phase] || PHASE_TO_RHYTHM['setup']
  }

  /**
   * 混合：根据情绪+节奏阶段推荐镜头
   */
  suggestShot(emotion: string, phase: string): {
    shotRule: CinematicRule
    rhythmRule: RhythmRule
  } {
    const shotRule = this.getShotForEmotion(emotion)
    const rhythmRule = this.getRhythmForPhase(phase)
    return { shotRule, rhythmRule }
  }
}

export const cinematicRules = new CinematicRulesEngine()
