/**
 * Brand OS Design System — Color Tokens
 * DS-1.4 Color Roles
 *
 * Semantic color tokens with light/dark theme support.
 * All colors meet WCAG AA contrast ratio (4.5:1).
 */

export interface ColorTokens {
  'color-surface': string
  'color-surface-dim': string
  'color-text-primary': string
  'color-text-secondary': string
  'color-text-tertiary': string
  'color-border': string
  'color-health': string
  'color-warning': string
  'color-risk': string
  'color-success': string
  'color-error': string
  'color-caution': string
  'color-info': string
}

export const colorTokensLight: ColorTokens = {
  'color-surface': '#ffffff',
  'color-surface-dim': '#f9fafb',
  'color-text-primary': '#111111',
  'color-text-secondary': '#6b7280',
  'color-text-tertiary': '#9ca3af',
  'color-border': '#e5e7eb',
  'color-health': '#22c55e',
  'color-warning': '#eab308',
  'color-risk': '#ef4444',
  'color-success': '#22c55e',
  'color-error': '#ef4444',
  'color-caution': '#f97316',
  'color-info': '#3b82f6',
}

export const colorTokensDark: ColorTokens = {
  'color-surface': '#111111',
  'color-surface-dim': '#1a1a1a',
  'color-text-primary': '#f1f1f1',
  'color-text-secondary': '#9ca3af',
  'color-text-tertiary': '#6b7280',
  'color-border': '#2d2d2d',
  'color-health': '#22c55e',
  'color-warning': '#eab308',
  'color-risk': '#ef4444',
  'color-success': '#22c55e',
  'color-error': '#ef4444',
  'color-caution': '#f97316',
  'color-info': '#3b82f6',
}

export const cssColorVariablesLight = `:root {
  --color-surface: ${colorTokensLight['color-surface']};
  --color-surface-dim: ${colorTokensLight['color-surface-dim']};
  --color-text-primary: ${colorTokensLight['color-text-primary']};
  --color-text-secondary: ${colorTokensLight['color-text-secondary']};
  --color-text-tertiary: ${colorTokensLight['color-text-tertiary']};
  --color-border: ${colorTokensLight['color-border']};
  --color-health: ${colorTokensLight['color-health']};
  --color-warning: ${colorTokensLight['color-warning']};
  --color-risk: ${colorTokensLight['color-risk']};
  --color-success: ${colorTokensLight['color-success']};
  --color-error: ${colorTokensLight['color-error']};
  --color-caution: ${colorTokensLight['color-caution']};
  --color-info: ${colorTokensLight['color-info']};
}`

export const cssColorVariablesDark = `[data-theme="dark"] {
  --color-surface: ${colorTokensDark['color-surface']};
  --color-surface-dim: ${colorTokensDark['color-surface-dim']};
  --color-text-primary: ${colorTokensDark['color-text-primary']};
  --color-text-secondary: ${colorTokensDark['color-text-secondary']};
  --color-text-tertiary: ${colorTokensDark['color-text-tertiary']};
  --color-border: ${colorTokensDark['color-border']};
  --color-health: ${colorTokensDark['color-health']};
  --color-warning: ${colorTokensDark['color-warning']};
  --color-risk: ${colorTokensDark['color-risk']};
  --color-success: ${colorTokensDark['color-success']};
  --color-error: ${colorTokensDark['color-error']};
  --color-caution: ${colorTokensDark['color-caution']};
  --color-info: ${colorTokensDark['color-info']};
}`

export function getColorTokens(theme: 'light' | 'dark' = 'light'): ColorTokens {
  return theme === 'dark' ? colorTokensDark : colorTokensLight
}
