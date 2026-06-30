/**
 * Brand OS Design System — Elevation Tokens
 * DS-1.5 Box Shadows
 *
 * Shadow tokens for Card (default), Card hover / Modal, and Dialog / Sheet.
 */

export interface ElevationTokens {
  'elevation-sm': string
  'elevation-md': string
  'elevation-lg': string
}

export const elevationTokens: ElevationTokens = {
  'elevation-sm': '0 1px 2px rgba(0,0,0,0.05)',
  'elevation-md': '0 4px 6px rgba(0,0,0,0.07)',
  'elevation-lg': '0 10px 15px rgba(0,0,0,0.1)',
}

export const cssElevationVariables = `:root {
  --elevation-sm: ${elevationTokens['elevation-sm']};
  --elevation-md: ${elevationTokens['elevation-md']};
  --elevation-lg: ${elevationTokens['elevation-lg']};
}`
