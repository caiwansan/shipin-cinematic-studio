/**
 * Brand OS Design System — Radius Tokens
 * DS-1.2 Border Radius
 *
 * Consistent border radius values matching DS-1.2 spec.
 */

export interface RadiusTokens {
  'radius-sm': string
  'radius-md': string
  'radius-lg': string
  'radius-full': string
}

export const radiusTokens: RadiusTokens = {
  'radius-sm': '4px',
  'radius-md': '8px',
  'radius-lg': '12px',
  'radius-full': '9999px',
}

export const cssRadiusVariables = `:root {
  --radius-sm: ${radiusTokens['radius-sm']};
  --radius-md: ${radiusTokens['radius-md']};
  --radius-lg: ${radiusTokens['radius-lg']};
  --radius-full: ${radiusTokens['radius-full']};
}`
