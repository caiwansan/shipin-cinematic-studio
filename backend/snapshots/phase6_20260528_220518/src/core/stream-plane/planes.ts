/**
 * Phase 3A — Stream Planes
 *
 * Canonical execution planes for the three execution models.
 *
 * This mirrors the architecture topology:
 *   SYNC  → SyncPlane   (image, tts) — immediate return
 *   STREAM → StreamPlane (llm) — event-based
 *   ASYNC → AsyncPlane  (video) — submit + poll
 *
 * Each plane type is a marker. They share no common execute() interface
 * because their execution characteristics fundamentally differ.
 */

export type PlaneType = 'SYNC' | 'STREAM' | 'ASYNC'

/**
 * ModelPluginAdapter capabilities now include the execution plane.
 */
export interface CapabilityBinding {
  capability: string
  plane: PlaneType
}

/**
 * Map every known capability to its execution plane.
 * Single source of truth — used by dispatcher to route correctly.
 */
export const CAPABILITY_PLANE_MAP: Record<string, PlaneType> = {
  image: 'SYNC',
  tts: 'SYNC',
  llm: 'STREAM',
  video: 'ASYNC',
} as const

/**
 * Get the execution plane for a capability.
 * Throws on unknown capability — prevents silent misrouting.
 */
export function getPlaneForCapability(capability: string): PlaneType {
  const plane = CAPABILITY_PLANE_MAP[capability]
  if (!plane) {
    throw new Error(
      `[PLANE] Unknown capability "${capability}". ` +
      `Known: ${Object.keys(CAPABILITY_PLANE_MAP).join(', ')}`
    )
  }
  return plane
}
