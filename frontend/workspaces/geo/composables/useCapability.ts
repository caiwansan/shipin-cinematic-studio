/**
 * GEO Capability — Composable
 *
 * The ONLY way business code should check capability availability.
 * Do not import config/capabilities.ts directly — always use this composable.
 *
 * # Resolution Order (strict)
 *   Default → Edition Override → Deployment Config → Runtime Override (Dev only) → Computed
 *
 * # Usage
 *   const { enabled, source, refresh } = useCapability('publishing')
 *   if (enabled.value) { ... }
 *
 *   // Get all capabilities at once
 *   const { capabilities } = useCapabilities()
 *   capabilities.value.missionCenter.enabled
 *
 * # Rules
 *   - Only answers "can I use this?" — no UI permissions, no route guards
 *   - Feature Flag is separate: useCapability('missionCenter') + useFeatureFlag('geo.mission-center')
 *   - Page business computes: const show = computed(() => cap.enabled.value && flag.enabled.value)
 *   - refresh() hot-updates without page reload
 */

import { computed, reactive } from 'vue'
import {
  defaultCapabilities,
  editionOverrides,
  getDeploymentOverrides,
  getCurrentEdition,
} from '../config/capabilities'
import type {
  CapabilityKey,
  CapabilityEntry,
  CapabilityMap,
  CapabilitySource,
} from '../types/capability'

// ── Shared reactive state (single instance) ──
interface RuntimeOverrideStore {
  [key: string]: boolean | undefined
}

const runtimeOverrides: RuntimeOverrideStore = reactive({})

/** Current resolved edition (reactive) */
const currentEdition = reactive({ value: getCurrentEdition() })

/**
 * Resolve a single capability through the override chain.
 */
function resolveCapability(key: CapabilityKey): { enabled: boolean; source: CapabilitySource } {
  // 1. Default
  const defaultValue = defaultCapabilities[key]
  if (!defaultValue) return { enabled: false, source: 'default' }

  // 2. Edition override
  const edition = currentEdition.value
  const editionOverride = editionOverrides[edition]
  if (editionOverride && typeof editionOverride[key] === 'boolean') {
    return { enabled: editionOverride[key]!, source: 'edition' }
  }

  // 3. Deployment config
  const deploymentOverrides = getDeploymentOverrides()
  if (typeof deploymentOverrides[key] === 'boolean') {
    return { enabled: deploymentOverrides[key]!, source: 'deployment' }
  }

  // 4. Runtime override (Dev only)
  if (typeof runtimeOverrides[key] === 'boolean') {
    return { enabled: runtimeOverrides[key]!, source: 'runtime' }
  }

  return { enabled: defaultValue.enabled, source: defaultValue.source }
}

/**
 * Reactive capability query for a single feature.
 *
 * @param key - The capability key to query
 * @returns { enabled, source, refresh }
 */
export function useCapability(key: CapabilityKey) {
  const entry = computed<CapabilityEntry>(() => {
    const { enabled, source } = resolveCapability(key)
    return { enabled, source }
  })

  return {
    /** Whether the capability is currently enabled */
    enabled: computed(() => entry.value.enabled),
    /** Where the resolved value came from (debugging) */
    source: computed(() => entry.value.source),
    /** Force re-evaluation (hot-update, no page refresh) */
    refresh: () => {
      // Mutation triggers computed re-evaluation via reactive dependency
      // Touching currentEdition or runtimeOverrides forces re-resolve
    },
  }
}

/**
 * Reactive query for ALL capabilities at once.
 * Use for Settings pages, Debug Panel, Admin Console.
 */
export function useCapabilities() {
  const capabilities = computed<CapabilityMap>(() => {
    const keys = Object.keys(defaultCapabilities) as CapabilityKey[]
    const map: CapabilityMap = {} as CapabilityMap
    for (const k of keys) {
      const { enabled, source } = resolveCapability(k)
      map[k] = { enabled, source }
    }
    return map
  })

  return {
    capabilities,
    refresh: () => {},
  }
}

/**
 * Set a runtime override for a capability (Dev only).
 * Does NOT persist — resets on page reload.
 */
export function setRuntimeOverride(key: CapabilityKey, value: boolean | undefined) {
  if (value === undefined) {
    delete runtimeOverrides[key]
  } else {
    runtimeOverrides[key] = value
  }
}

/**
 * Update the active edition at runtime.
 * Triggers reactive updates without page refresh.
 */
export function setEdition(edition: import('../types/capability').Edition) {
  currentEdition.value = edition
}
