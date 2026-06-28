// Scanner stub — Sprint 1B
import type { FastifyInstance } from 'fastify'
export default async function geoScannerRoutes(fastify: FastifyInstance) {
  fastify.post('/api/geo/scanner/scan', async (_request, reply) => {
    return { success: true, data: { message: 'Not implemented (Sprint 1B)' } }
  })
}
