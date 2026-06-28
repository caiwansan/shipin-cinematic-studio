/**
 * 昆仑镜 Design Token — Shadows
 *
 * 镜面阴影系统
 * layer-based shadow 层级
 */

export interface ShadowConfig {
  sm: string
  md: string
  lg: string
  xl: string
  glow: {
    gold: string
    cyan: string
  }
  prism: string
}

export const shadows: ShadowConfig = {
  // ── 层级阴影 ──
  sm: '0 2px 8px rgba(0, 0, 0, 0.15)',
  md: '0 8px 32px rgba(0, 0, 0, 0.2)',
  lg: '0 20px 80px rgba(0, 0, 0, 0.35)',
  xl: '0 40px 120px rgba(0, 0, 0, 0.5)',

  // ── 发光 ──
  glow: {
    gold: '0 0 30px rgba(201, 168, 108, 0.2), 0 0 60px rgba(201, 168, 108, 0.08)',
    cyan: '0 0 30px rgba(0, 212, 255, 0.2), 0 0 60px rgba(0, 212, 255, 0.08)',
  },

  // ── 棱镜折射（彩虹边缘光） ──
  prism: '0 0 40px rgba(255, 68, 102, 0.10), 0 0 40px rgba(0, 212, 255, 0.10), 0 0 40px rgba(167, 139, 250, 0.10)',
}

/**
 * 获取多层阴影合并（用于调用处扩展）
 */
export function mergeShadows(...s: string[]): string {
  return s.join(', ')
}
