import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'

export default fp(async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: (process.env.CORS_ORIGIN || 'https://aigc.fushtn.com').split(',').map(s => s.trim()),
    credentials: true,
  })
})

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};
