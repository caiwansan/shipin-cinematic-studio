// =================================================================
// Director OS UI — 动效冻结层 (v2.5 Motion Contract)
// 确定性动效协议
// =================================================================

export const MOTION = {
  easing: 'ease-out',
  duration: {
    micro: 120,
    fast: 180,
    normal: 240,
    slow: 400,
  },
  rules: {
    noBounce: true,
    noSpringOverflow: true,
    deterministic: true,
  },
} as const

export type MotionDuration = typeof MOTION.duration
