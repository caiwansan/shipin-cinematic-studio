/**
 * 昆仑镜 Design Token — Colors
 *
 * Kunlun Mirror Color System
 * 东方神话 × 镜面宇宙
 * 基于 Dark Cosmos 基底
 */

export const colors = {
  // ── 基底 ──
  bg: {
    primary: '#08131F',
    secondary: '#0E1D31',
    tertiary: '#152238',
    overlay: 'rgba(8, 19, 31, 0.85)',
  },

  // ── 金 — 神圣/核心 ──
  gold: {
    light: '#E2C88A',
    main: '#C9A86C',
    dark: '#A8894D',
    glow: 'rgba(201, 168, 108, 0.3)',
  },

  // ── 青 — 科技/未来 ──
  cyan: {
    light: '#00F0FF',
    main: '#00D4FF',
    dark: '#009ECC',
    glow: 'rgba(0, 212, 255, 0.3)',
  },

  // ── 白 — 文字/界面 ──
  paper: {
    white: '#F8F6F1',
    subtle: 'rgba(248, 246, 241, 0.65)',
    muted: 'rgba(248, 246, 241, 0.35)',
    dim: 'rgba(248, 246, 241, 0.15)',
  },

  // ── 玻璃态 ──
  glass: {
    base: 'rgba(255, 255, 255, 0.04)',
    hover: 'rgba(255, 255, 255, 0.07)',
    active: 'rgba(255, 255, 255, 0.10)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.14)',
  },

  // ── 五境主题色 ──
  realm: {
    novel: { primary: '#C9A86C', glow: 'rgba(201, 168, 108, 0.25)' },     // 文界 · 金
    drama: { primary: '#00D4FF', glow: 'rgba(0, 212, 255, 0.25)' },       // 影界 · 青
    ppt:   { primary: '#A78BFA', glow: 'rgba(167, 139, 250, 0.25)' },     // 演界 · 紫
    music: { primary: '#F472B6', glow: 'rgba(244, 114, 182, 0.25)' },     // 乐界 · 粉
    ad:    { primary: '#34D399', glow: 'rgba(52, 211, 153, 0.25)' },      // 商界 · 翠
  },

  // ── 棱镜折射光谱 ──
  prism: {
    red:    '#FF4466',
    orange: '#FF8833',
    yellow: '#FFD700',
    green:  '#00FF88',
    blue:   '#4488FF',
    indigo: '#6644FF',
    violet: '#BB44FF',
  },

  // ── 极光 ──
  aurora: {
    top:    'rgba(0, 212, 255, 0.06)',
    middle: 'rgba(201, 168, 108, 0.04)',
    bottom: 'rgba(167, 139, 250, 0.06)',
  },

  // ── 状态 ──
  state: {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
} as const

export type KunlunColor = keyof typeof colors
