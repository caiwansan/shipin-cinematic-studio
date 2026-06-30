/**
 * Brand OS Design System — Spacing Tokens
 * DS-1.1 8pt Grid
 *
 * space-1 (4px) to space-8 (64px) based on 8px grid system.
 */

export interface SpacingTokens {
  'space-1': string
  'space-2': string
  'space-3': string
  'space-4': string
  'space-5': string
  'space-6': string
  'space-7': string
  'space-8': string
}

export const spacingTokens: SpacingTokens = {
  'space-1': '4px',
  'space-2': '8px',
  'space-3': '12px',
  'space-4': '16px',
  'space-5': '24px',
  'space-6': '32px',
  'space-7': '48px',
  'space-8': '64px',
}

export const cssSpacingVariables = `:root {
  --space-1: ${spacingTokens['space-1']};
  --space-2: ${spacingTokens['space-2']};
  --space-3: ${spacingTokens['space-3']};
  --space-4: ${spacingTokens['space-4']};
  --space-5: ${spacingTokens['space-5']};
  --space-6: ${spacingTokens['space-6']};
  --space-7: ${spacingTokens['space-7']};
  --space-8: ${spacingTokens['space-8']};
}`
