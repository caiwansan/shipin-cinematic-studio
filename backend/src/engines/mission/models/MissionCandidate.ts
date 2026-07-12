import { Action } from './Action'

/**
 * MissionCandidate is the future dedup layer.
 * 
 * Current pipeline:
 *   Action[] → Mission[]
 * 
 * Future pipeline:
 *   Action[] → MissionCandidate[] (dedup) → Mission[]
 */
export interface MissionCandidate {
  action: Action
  fingerprints: string[]
  mergeKey?: string
}
