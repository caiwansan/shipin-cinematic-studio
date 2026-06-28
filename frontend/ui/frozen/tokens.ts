// =================================================================
// Director OS UI — 视觉冻结层 (v2.5 Visual Contract)
// 不可变视觉协议，不可修改（除非版本冻结升级）
// =================================================================

export const UI_TOKENS = {
  color: {
    bgPrimary: '#07070d',
    bgSecondary: '#0c0c14',
    bgOverlay: 'rgba(10,10,18,0.72)',
    border: '#1a1a28',
    borderStrong: '#2a2a3f',
    create: '#6ee7ff',
    transform: '#a78bfa',
    branch: '#f472b6',
    textPrimary: '#e5e7eb',
    textSecondary: '#9ca3af',
    textMuted: '#4b5563',
  },
  glow: {
    create: '0 0 24px rgba(110,231,255,0.35)',
    transform: '0 0 24px rgba(167,139,250,0.35)',
    branch: '0 0 24px rgba(244,114,182,0.35)',
    subtle: '0 0 12px rgba(110,231,255,0.12)',
  },
  font: {
    primary: 'Inter var, system-ui, sans-serif',
    mono: 'JetBrains Mono, ui-monospace, monospace',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
  },
} as const

export type UITokenColor = typeof UI_TOKENS.color
export type UITokenGlow = typeof UI_TOKENS.glow
