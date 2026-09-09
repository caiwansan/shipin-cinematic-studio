import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'

export default fp(async function corsPlugin(fastify: FastifyInstance) {
  const raw = process.env.CORS_ORIGIN || 'https://aigc.fushtn.com'
  // 支持逗号分隔多 origin
  const origins = raw.split(',').map((s: string) => s.trim()).filter(Boolean)
  const originSet = new Set(origins)

  await fastify.register(cors, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
      // 无 origin（如 Postman）允许通过
      if (!origin) return cb(null, true)
      // 仅匹配白名单 origin
      if (originSet.has(origin)) return cb(null, true)
      // 拒绝未授权的 origin
      cb(new Error(`Origin ${origin} not allowed`), false)
    },
    credentials: true,
  })
})

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

