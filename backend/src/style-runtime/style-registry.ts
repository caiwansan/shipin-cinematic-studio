/**
 * style-runtime/style-registry.ts
 *
 * ⚔️ Phase 4 — Style System（隔离层）
 *
 * Style = render modifier ONLY
 *
 * 宪法规则：
 *   ❌ 不修改叙事结构
 *   ❌ 不修改 sceneSegmentation
 *   ❌ 不修改 causalGraph
 *   ❌ 不修改 shotGraph
 *   ✔ 只影响渲染属性
 *
 * StyleProfile 包含的字段：
 *   - lightingBias: 灯光偏好
 *   - colorPalette: 调色板
 *   - lensPreference: 镜头偏好
 *   - pacingModifier: 节奏修饰（浮点数偏移，不改变结构）
 */

// ── Style Profile ──

export interface StyleProfile {
  name: string
  displayName: string
  description: string

  /** 灯光偏好（叙事级描述，不是 camera 参数） */
  lightingBias: {
    dominant: 'high_key' | 'low_key' | 'natural' | 'mixed'
    contrast: 'low' | 'medium' | 'high'
    description: string
  }

  /** 调色板 */
  colorPalette: {
    primaryHue: string
    saturation: 'desaturated' | 'neutral' | 'vibrant'
    temperature: 'cool' | 'neutral' | 'warm'
    description: string
  }

  /** 镜头偏好（渲染级指示，非具体 camera 参数） */
  lensPreference: {
    dominant: 'wide' | 'standard' | 'tele'
    movement: 'static' | 'smooth' | 'dynamic'
    depth: 'shallow' | 'medium' | 'deep'
    description: string
  }

  /** 节奏修饰（不影响结构，只影响渲染节奏） */
  pacingModifier: {
    /** -0.3 ~ 0.3 偏移值，叠加到基础 pacing */
    offset: number
    description: string
  }
}

// ── 预定义风格 ──

export const BUILT_IN_STYLES: Record<string, StyleProfile> = {
  'noir': {
    name: 'noir',
    displayName: '黑色电影',
    description: '高对比度、低光、阴影强烈，典型的黑色电影风格',
    lightingBias: {
      dominant: 'low_key',
      contrast: 'high',
      description: '强阴影，窄光源，营造压抑氛围',
    },
    colorPalette: {
      primaryHue: '冷色偏蓝黑',
      saturation: 'desaturated',
      temperature: 'cool',
      description: '接近黑白，只保留少数高饱和度的强调色',
    },
    lensPreference: {
      dominant: 'standard',
      movement: 'static',
      depth: 'shallow',
      description: '固定机位为主，浅景深聚焦角色面部',
    },
    pacingModifier: {
      offset: -0.1,
      description: '略微放缓节奏，给沉默和阴影留空间',
    },
  },

  'cinematic': {
    name: 'cinematic',
    displayName: '电影感',
    description: '宽银幕、柔和光线、电影级色彩，标准电影质感',
    lightingBias: {
      dominant: 'natural',
      contrast: 'medium',
      description: '自然光为主，柔光补光，明暗过渡自然',
    },
    colorPalette: {
      primaryHue: '暖色偏琥珀',
      saturation: 'neutral',
      temperature: 'warm',
      description: '温暖细腻的胶片色彩，肤色自然',
    },
    lensPreference: {
      dominant: 'wide',
      movement: 'smooth',
      depth: 'medium',
      description: '宽画幅，流畅运镜，适中的画面深度',
    },
    pacingModifier: {
      offset: 0,
      description: '标准电影节奏',
    },
  },

  'anime': {
    name: 'anime',
    displayName: '二次元',
    description: '高亮度、鲜艳色彩、线条感，日式动画风格',
    lightingBias: {
      dominant: 'high_key',
      contrast: 'low',
      description: '高亮度，柔和阴影，画面明亮通透',
    },
    colorPalette: {
      primaryHue: '多色混合',
      saturation: 'vibrant',
      temperature: 'neutral',
      description: '高饱和度，鲜明的色彩区块',
    },
    lensPreference: {
      dominant: 'standard',
      movement: 'dynamic',
      depth: 'deep',
      description: '广角透视夸张，动态镜头丰富',
    },
    pacingModifier: {
      offset: 0.05,
      description: '略微加速，保持活力感',
    },
  },

  'minimalist': {
    name: 'minimalist',
    displayName: '极简白',
    description: '大面积留白、中性色调、简洁构图，现代极简风格',
    lightingBias: {
      dominant: 'high_key',
      contrast: 'low',
      description: '均匀高亮，几乎无阴影',
    },
    colorPalette: {
      primaryHue: '中性色',
      saturation: 'desaturated',
      temperature: 'neutral',
      description: '灰白米色为主，少量中性色点缀',
    },
    lensPreference: {
      dominant: 'standard',
      movement: 'static',
      depth: 'deep',
      description: '固定机位，深景深，画面干净',
    },
    pacingModifier: {
      offset: -0.15,
      description: '刻意放缓节奏，突出留白力量',
    },
  },

  'vintage': {
    name: 'vintage',
    displayName: '复古',
    description: '暖黄调、颗粒感、柔和光晕，怀旧胶片风格',
    lightingBias: {
      dominant: 'natural',
      contrast: 'medium',
      description: '暖黄柔光，光晕发散',
    },
    colorPalette: {
      primaryHue: '暖色偏黄',
      saturation: 'neutral',
      temperature: 'warm',
      description: '老胶片色调，略带褪色感',
    },
    lensPreference: {
      dominant: 'standard',
      movement: 'smooth',
      depth: 'medium',
      description: '柔和运镜，轻微镜头畸变',
    },
    pacingModifier: {
      offset: -0.05,
      description: '略微放缓，模仿老电影的节奏',
    },
  },

  'tech': {
    name: 'tech',
    displayName: '科技感',
    description: '冷蓝调、高对比、发光边缘，赛博/科技风格',
    lightingBias: {
      dominant: 'mixed',
      contrast: 'high',
      description: '冷色光源为主，边缘发光效果',
    },
    colorPalette: {
      primaryHue: '冷色偏蓝紫',
      saturation: 'vibrant',
      temperature: 'cool',
      description: '蓝紫色为主色调，发光亮色点缀',
    },
    lensPreference: {
      dominant: 'wide',
      movement: 'dynamic',
      depth: 'deep',
      description: '广角透视强调空间感，运镜快速',
    },
    pacingModifier: {
      offset: 0.1,
      description: '略微加快节奏，营造科技紧迫感',
    },
  },
}

// ── Style 查询 ──

export function getStyle(name: string): StyleProfile | undefined {
  return BUILT_IN_STYLES[name]
}

export function listStyles(): Array<{ name: string; displayName: string; description: string }> {
  return Object.values(BUILT_IN_STYLES).map(s => ({
    name: s.name,
    displayName: s.displayName,
    description: s.description,
  }))
}
