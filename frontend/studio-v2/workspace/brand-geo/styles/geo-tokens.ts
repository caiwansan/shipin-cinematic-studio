/**
 * GEO Design Tokens — Centralized design tokens for GEO workspace UI.
 *
 * All visual styling values come from this file. Import rather than
 * hardcoding color/spacing values in components.
 *
 * Merged from workspace/geo/tokens — single source of truth.
 *
 * @package workspace/brand-geo/styles
 */

export const GEOTokens = {
  colors: {
    brand: '#2563eb',       // Primary blue
    surface: '#ffffff',
    background: '#f8fafc',
    sidebar: '#1e293b',
    sidebarText: '#cbd5e1',
    hover: '#334155',
    active: '#2563eb',
    border: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#64748b',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    accent: '#8b5cf6',
    brandLight: 'rgba(37, 99, 235, 0.1)',
    surfaceDark: '#11151c',
    sidebarBg: '#0f172a',
    headerBg: '#ffffff',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", "Fira Code", monospace',
    h1: '24px/32px 600',
    h2: '20px/28px 600',
    h3: '16px/24px 600',
    body: '14px/20px 400',
    small: '12px/16px 400',
  },
  panel: {
    headerHeight: '48px',
    sidebarWidth: '260px',
    inspectorWidth: '320px',
    breadcrumbHeight: '40px',
    copilotHeight: '280px',
  },
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px -1px rgba(0,0,0,0.1)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.1)',
  },
} as const;

export type GEOTokenColor = keyof typeof GEOTokens.colors;
export type GEOTokenSpacing = keyof typeof GEOTokens.spacing;
export type GEOTokenRadius = keyof typeof GEOTokens.radius;
