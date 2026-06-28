/**
 * 昆仑镜 Design Token — Spacing & Sizing
 *
 * 基于 4px 基准网格
 */

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  18: '72px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  48: '192px',
  56: '224px',
  64: '256px',
} as const

export type SpacingKey = keyof typeof spacing

export const screens = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export const maxWidths = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1200px',
  '2xl': '1400px',
} as const

export const zIndex = {
  base: 0,
  nav: 100,
  overlay: 200,
  modal: 300,
  tooltip: 400,
  max: 9999,
} as const

export const borderRadius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
  full: '50%',
} as const
