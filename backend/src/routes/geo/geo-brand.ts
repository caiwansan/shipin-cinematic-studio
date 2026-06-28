// Brand stub — Sprint 1B
import type { FastifyInstance } from 'fastify'
export default async function geoBrandRoutes(fastify: FastifyInstance) {
  fastify.get('/api/geo/brands', async (_request, reply) => {
    return { success: true, data: { brands: [] } }
  })
}
