/**
 * GEO Capability — Default Configuration
 *
 * SSOT for default capability values and edition overrides.
 * Edit this file to change what's available per edition.
 *
 * Resolution order:
 *   Default → Edition Override → Deployment Config → Runtime Override (Dev only)
 *
 * Usage:
 *   import { defaultCapabilities, editionOverrides } from './capabilities'
 */

import type { CapabilityKey, CapabilityEntry, CapabilityMap, EditionOverrideMap } from '../types/capability'

/**
 * Default capabilities — applies when no override is active.
 * All capabilities enabled by default (GEO V4 baseline).
 */
export const defaultCapabilities: CapabilityMap = {
  missionCenter:  { enabled: true, source: 'default' },
  brandWorkspace: { enabled: true, source: 'default' },
  publishing:     { enabled: true, source: 'default' },
  insights:       { enabled: true, source: 'default' },
  growth:         { enabled: true, source: 'default' },
  discovery:      { enabled: true, source: 'default' },
  verification:   { enabled: true, source: 'default' },
  recommendations:{ enabled: true, source: 'default' },
  copilot:        { enabled: true, source: 'default' },
}

/**
 * Edition overrides — keys not listed inherit from default.
 *
 * Example:
 *   enterprise: {
 *     advancedAnalytics: true,  // only enterprise has this
 *   },
 *   community: {
 *     publishing: false,  // publishing disabled in free tier
 *   },
 */
export const editionOverrides: EditionOverrideMap = {
  community: {
    insights: false,
    growth: false,
  },
  pro: {},
  enterprise: {},
}

/**
 * Deployment-level overrides — applied AFTER edition override.
 * Set via VITE_GEO_CAPABILITIES env var (JSON), or by editing this file.
 *
 * Format (env): VITE_GEO_CAPABILITIES='{"publishing":false,"insights":true}'
 */
export function getDeploymentOverrides(): Partial<Record<CapabilityKey, boolean>> {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEO_CAPABILITIES) {
    try {
      return JSON.parse(import.meta.env.VITE_GEO_CAPABILITIES as string) as Partial<Record<CapabilityKey, boolean>>
    } catch {
      // silent — invalid JSON just falls through
    }
  }
  return {}
}

/**
 * Get the current edition.
 * Controlled by VITE_GEO_EDITION env var. Defaults to 'enterprise'.
 */
export function getCurrentEdition(): import('../types/capability').Edition {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEO_EDITION) {
    const val = (import.meta.env.VITE_GEO_EDITION as string).toLowerCase()
    if (val === 'community' || val === 'pro' || val === 'enterprise') {
      return val
    }
  }
  return 'enterprise'
}
