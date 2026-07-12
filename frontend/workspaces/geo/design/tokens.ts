/**
 * GEO Workspace Design Tokens — Single Source of Truth
 *
 * This is the ONLY file that is manually edited.
 * CSS, JSON, and manifest are auto-generated from this file.
 * Do not edit generated/ files directly.
 *
 * # Usage
 *   pnpm tokens:generate  — regenerate CSS + JSON + manifest
 *   pnpm tokens:check     — verify generated files match source
 *
 * # Adding a token
 *   1. Add the value to the appropriate section below
 *   2. Run pnpm tokens:generate
 *   3. Commit both tokens.ts and the generated files
 */

import type { GeoTokensShape } from './types'

export const GeoTokens = {
  // ── Spacing (4px base unit) ──
  space: {
    '1': '4px',
    '2': '8px',
    '3': '12px',
    '4': '16px',
    '5': '24px',
    '6': '32px',
    '7': '48px',
    '8': '64px',
  } as const,

  // ── Border Radius ──
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  } as const,

  // ── Typography ──
  text: {
    xs: { size: '12px', lineHeight: '16px', weight: '400' },
    sm: { size: '14px', lineHeight: '20px', weight: '400' },
    base: { size: '16px', lineHeight: '24px', weight: '400' },
    lg: { size: '18px', lineHeight: '28px', weight: '500' },
    xl: { size: '20px', lineHeight: '28px', weight: '500' },
    '2xl': { size: '24px', lineHeight: '32px', weight: '600' },
    '3xl': { size: '30px', lineHeight: '36px', weight: '700' },
  } as const,

  // ── Font Families ──
  font: {
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans SC", sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace',
  } as const,

  // ── Icon Size ──
  icon: {
    xs: '12px',
    sm: '16px',
    md: '20px',
    lg: '24px',
    xl: '32px',
  } as const,

  // ── Font Weight (aliases for convenience) ──
  weight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  } as const,

  // ── Motion Duration ──
  duration: {
    '100': 100,
    '200': 200,
    '300': 300,
    '500': 500,
    '1000': 1000,
  } as const,

  // ── Easing Curves ──
  easing: {
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  } as const,

  // ── Elevation (Box Shadow) ──
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px rgba(0,0,0,0.07)',
    lg: '0 10px 15px rgba(0,0,0,0.1)',
    xl: '0 20px 25px rgba(0,0,0,0.15)',
  } as const,

  // ── Z-Index ──
  z: {
    dropdown: 100,
    sticky: 200,
    overlay: 300,
    modal: 400,
    toast: 500,
    tooltip: 600,
  } as const,

  // ── Breakpoints ──
  bp: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
  } as const,

  // ── Colors (Light Mode) ──
  color: {
    // Background
    'bg-primary': '#ffffff',
    'bg-secondary': '#f8fafc',
    'bg-card': '#ffffff',

    // Text
    'text-primary': '#0f172a',
    'text-secondary': '#64748b',
    'text-disabled': '#94a3b8',
    'text-inverse': '#ffffff',

    // Border
    'border': '#e2e8f0',
    'border-hover': '#cbd5e1',

    // Semantic
    'accent': '#3b82f6',
    'success': '#22c55e',
    'warning': '#f59e0b',
    'error': '#ef4444',
    'info': '#3b82f6',

    // Status backgrounds (light)
    'bg-success': '#f0fdf4',
    'border-success': '#bbf7d0',
    'text-success': '#16a34a',

    'bg-warning': '#fffbeb',
    'border-warning': '#fde68a',
    'text-warning': '#d97706',

    'bg-error': '#fef2f2',
    'border-error': '#fecaca',
    'text-error': '#dc2626',

    'bg-info': '#eff6ff',
    'border-info': '#bfdbfe',
    'text-info': '#2563eb',

    'bg-neutral': '#f9fafb',
    'border-neutral': '#e5e7eb',
    'text-neutral': '#6b7280',
  } as const,

  // ── Priority Colors (for Mission Center) ──
  priority: {
    'bg-high': '#fef2f2',
    'text-high': '#dc2626',
    'border-high': '#fecaca',

    'bg-medium': '#fffbeb',
    'text-medium': '#d97706',
    'border-medium': '#fde68a',

    'bg-low': '#f0fdf4',
    'text-low': '#16a34a',
    'border-low': '#bbf7d0',
  } as const,

  // ── Chart/Score Colors ──
  chart: {
    blue: '#3b82f6',
    green: '#22c55e',
    amber: '#f59e0b',
    red: '#ef4444',
    purple: '#8b5cf6',
    teal: '#14b8a6',
  } as const,
} as const satisfies GeoTokensShape

export type GeoTokens = typeof GeoTokens
