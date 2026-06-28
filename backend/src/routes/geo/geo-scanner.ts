// ============================================================
// GEO Scanner Routes (Brand GEO compat → KMKI-GEO Sprint 1A)
// ============================================================

import { FastifyInstance } from 'fastify'

export default async function geoScannerRoutes(fastify: FastifyInstance) {
  // Stub: Scanner will be implemented in Sprint 1B
  fastify.post('/api/geo/scanner/scan', async (_request, reply) => {
    return { success: true, data: { message: 'Scanner not yet implemented (Sprint 1B)' } }
  })
}
