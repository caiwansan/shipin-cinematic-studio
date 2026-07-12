// ─────────────────────────────────────────────────
// Mission Engine — Index (统一出口)
// P0 — FROZEN
// ─────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify'
import geoMissionEngineRoutes from './routes'

export { MissionGenerator } from './mission-generator'
export { MissionVerifier } from './mission-verifier'
export type { Mission, MissionCenterState, MissionStatus, MissionDifficulty, MissionCategory } from './types'

export function registerMissionEngineRoutes(fastify: FastifyInstance): void {
  return geoMissionEngineRoutes(fastify)
}
