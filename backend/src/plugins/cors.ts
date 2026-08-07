import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'

export default fp(async function corsPlugin(fastify: FastifyInstance) {
  const raw = process.env.CORS_ORIGIN || 'https://aigc.fushtn.com'
  // 支持逗号分隔多 origin（如 "https://aigc.fushtn.com,http://tauri.localhost"）
  const origins = raw.split(',').map((s: string) => s.trim()).filter(Boolean)
  await fastify.register(cors, {
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
  })
})

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};
