/**
 * 昆仑镜 Design Token — Glass Morphism
 *
 * Kunlun Glass Design System
 * 玻璃态视觉协议
 */

export interface GlassConfig {
  blur: number
  background: string
  border: string
  borderHover: string
  shadow: string
  borderRadius: string
}

export const glass: Record<string, GlassConfig> = {
  // ── 标准玻璃卡片 ──
  card: {
    blur: 30,
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderHover: '1px solid rgba(255, 255, 255, 0.14)',
    shadow: '0 20px 80px rgba(0, 0, 0, 0.35)',
    borderRadius: '16px',
  },

  // ── 导航栏 ──
  nav: {
    blur: 24,
    background: 'rgba(8, 19, 31, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderHover: '1px solid rgba(255, 255, 255, 0.08)',
    shadow: '0 4px 30px rgba(0, 0, 0, 0.2)',
    borderRadius: '0px',
  },

  // ── 模态框 ──
  modal: {
    blur: 40,
    background: 'rgba(14, 29, 49, 0.9)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderHover: '1px solid rgba(255, 255, 255, 0.10)',
    shadow: '0 40px 120px rgba(0, 0, 0, 0.5)',
    borderRadius: '20px',
  },

  // ── 按钮 ──
  button: {
    blur: 12,
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    borderHover: '1px solid rgba(255, 255, 255, 0.20)',
    shadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
    borderRadius: '12px',
  },

  // ── Hero 镜面 ──
  mirror: {
    blur: 20,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderHover: '1px solid rgba(255, 255, 255, 0.12)',
    shadow: '0 30px 100px rgba(0, 0, 0, 0.4), 0 0 60px rgba(201, 168, 108, 0.08)',
    borderRadius: '50%',
  },
}

/**
 * 生成 Glass CSS 变量字符串
 */
export const getGlassCSS = glassCSSVars

export function glassCSSVars(key: keyof typeof glass): Record<string, string> {
  const g = glass[key]
  return {
    '--glass-blur': `${g.blur}px`,
    '--glass-bg': g.background,
    '--glass-border': g.border,
    '--glass-border-hover': g.borderHover,
    '--glass-shadow': g.shadow,
    '--glass-radius': g.borderRadius,
  }
}

/**
 * 生成内联样式对象
 */
export function glassStyle(key: keyof typeof glass): Record<string, string> {
  const g = glass[key]
  return {
    backdropFilter: `blur(${g.blur}px)`,
    WebkitBackdropFilter: `blur(${g.blur}px)`,
    background: g.background,
    border: g.border,
    boxShadow: g.shadow,
    borderRadius: g.borderRadius,
  }
}
