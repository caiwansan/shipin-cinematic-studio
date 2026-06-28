/**
 * 昆仑镜 Design Token — Motion
 *
 * 动画时间 / 缓动函数 / 滚动触发阈值
 */

export const motion = {
  // ── 时长（ms） ──
  duration: {
    instant: 150,
    fast: 300,
    normal: 500,
    slow: 800,
    narrative: 1200,
    cinematic: 2000,
  },

  // ── 缓动函数 ──
  ease: {
    // 标准
    default: 'power2.out',
    smooth: 'power3.out',
    smoothIn: 'power3.in',
    smoothInOut: 'power3.inOut',

    // 镜面/折射感
    glassIn: 'back.out(1.2)',
    glassOut: 'back.in(1.2)',
    prism: 'elastic.out(1, 0.4)',

    // 叙事型
    narrative: 'expo.out',
    reveal: 'circ.out',
    float: 'sine.inOut',

    // CSS 兼容
    css: {
      default: 'cubic-bezier(0.16, 1, 0.3, 1)',
      smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      glass: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      narrative: 'cubic-bezier(0.16, 1, 0.3, 1)',
    },
  },

  // ── 滚动触发阈值 ──
  scroll: {
    enter: 0.2,
    leave: 0.8,
    full: 0.5,
  },

  // ── 视差速度 ──
  parallax: {
    slow: 0.3,
    normal: 0.5,
    fast: 0.7,
  },

  // ── 粒子系统 ──
  particles: {
    count: 120,
    speed: 0.3,
    size: { min: 1, max: 3 },
    opacity: { min: 0.2, max: 0.8 },
    connection: {
      distance: 150,
      opacity: 0.12,
    },
  },

  // ── 镜面旋转 ──
  mirror: {
    rotationSpeed: 0.003,
    floatAmplitude: 8,
    floatDuration: 4,
  },
} as const

export type MotionDuration = keyof typeof motion.duration
export type MotionEase = keyof typeof motion.ease

/**
 * GSAP Timeline 默认配置
 */
export const defaultTimeline = {
  defaults: {
    duration: motion.duration.normal / 1000,
    ease: motion.ease.smooth,
  },
}
