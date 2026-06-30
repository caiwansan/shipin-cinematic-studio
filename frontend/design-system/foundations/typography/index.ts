/**
 * Brand OS Design System — Typography Tokens
 * DS-1.3 Typography
 *
 * Font sizes, weights, and line heights for the type scale.
 * Font family: system default sans-serif.
 */

export interface TypographyTokens {
  display: { fontSize: string; lineHeight: string; fontWeight: number }
  'heading-1': { fontSize: string; lineHeight: string; fontWeight: number }
  'heading-2': { fontSize: string; lineHeight: string; fontWeight: number }
  'heading-3': { fontSize: string; lineHeight: string; fontWeight: number }
  body: { fontSize: string; lineHeight: string; fontWeight: number }
  'body-sm': { fontSize: string; lineHeight: string; fontWeight: number }
  caption: { fontSize: string; lineHeight: string; fontWeight: number }
  metric: { fontSize: string; lineHeight: string; fontWeight: number }
  'metric-sm': { fontSize: string; lineHeight: string; fontWeight: number }
}

export const typographyTokens: TypographyTokens = {
  display: { fontSize: '48px', lineHeight: '1.1', fontWeight: 700 },
  'heading-1': { fontSize: '32px', lineHeight: '1.2', fontWeight: 600 },
  'heading-2': { fontSize: '24px', lineHeight: '1.3', fontWeight: 600 },
  'heading-3': { fontSize: '20px', lineHeight: '1.4', fontWeight: 500 },
  body: { fontSize: '16px', lineHeight: '1.5', fontWeight: 400 },
  'body-sm': { fontSize: '14px', lineHeight: '1.5', fontWeight: 400 },
  caption: { fontSize: '12px', lineHeight: '1.4', fontWeight: 400 },
  metric: { fontSize: '96px', lineHeight: '1.0', fontWeight: 700 },
  'metric-sm': { fontSize: '32px', lineHeight: '1.0', fontWeight: 700 },
}

export const cssTypographyVariables = `:root {
  --font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --text-display-size: ${typographyTokens.display.fontSize};
  --text-display-line: ${typographyTokens.display.lineHeight};
  --text-display-weight: ${typographyTokens.display.fontWeight};
  --text-heading-1-size: ${typographyTokens['heading-1'].fontSize};
  --text-heading-1-line: ${typographyTokens['heading-1'].lineHeight};
  --text-heading-1-weight: ${typographyTokens['heading-1'].fontWeight};
  --text-heading-2-size: ${typographyTokens['heading-2'].fontSize};
  --text-heading-2-line: ${typographyTokens['heading-2'].lineHeight};
  --text-heading-2-weight: ${typographyTokens['heading-2'].fontWeight};
  --text-heading-3-size: ${typographyTokens['heading-3'].fontSize};
  --text-heading-3-line: ${typographyTokens['heading-3'].lineHeight};
  --text-heading-3-weight: ${typographyTokens['heading-3'].fontWeight};
  --text-body-size: ${typographyTokens.body.fontSize};
  --text-body-line: ${typographyTokens.body.lineHeight};
  --text-body-weight: ${typographyTokens.body.fontWeight};
  --text-body-sm-size: ${typographyTokens['body-sm'].fontSize};
  --text-body-sm-line: ${typographyTokens['body-sm'].lineHeight};
  --text-body-sm-weight: ${typographyTokens['body-sm'].fontWeight};
  --text-caption-size: ${typographyTokens.caption.fontSize};
  --text-caption-line: ${typographyTokens.caption.lineHeight};
  --text-caption-weight: ${typographyTokens.caption.fontWeight};
  --text-metric-size: ${typographyTokens.metric.fontSize};
  --text-metric-line: ${typographyTokens.metric.lineHeight};
  --text-metric-weight: ${typographyTokens.metric.fontWeight};
  --text-metric-sm-size: ${typographyTokens['metric-sm'].fontSize};
  --text-metric-sm-line: ${typographyTokens['metric-sm'].lineHeight};
  --text-metric-sm-weight: ${typographyTokens['metric-sm'].fontWeight};
}`
