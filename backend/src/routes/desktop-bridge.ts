import { FastifyInstance } from 'fastify'
import { randomBytes } from 'crypto'

/**
 * Workspace Connection Protocol — Identity Exchange（S1）
 * 遵守 ADR-021: 壳不写 Web localStorage / 不注入 JWT / 不复制凭据
 * 链路: Desktop auth_token → ticket(一次性,5min) → Cloud exchange → accessToken
 */
const tickets = new Map<string, { userId: string; expiresAt: number }>()

export default async function desktopBridgeRoutes(fastify: FastifyInstance) {
  // POST /api/auth/desktop/ticket — Desktop 签发一次性 ticket
  fastify.post('/api/auth/desktop/ticket', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const userId = request.user?.id
    if (!userId) return reply.status(401).send({ error: 'unauthorized' })
    const t = randomBytes(24).toString('hex')
    tickets.set(t, { userId, expiresAt: Date.now() + 5 * 60 * 1000 })
    return { code: 0, data: { ticket: t, expiresIn: 300 } }
  })

  // POST /api/auth/ticket/exchange — 工作台页面换取 accessToken（单次消费）
  fastify.post('/api/auth/ticket/exchange', async (request: any, reply: any) => {
    const { ticket } = request.body || {}
    if (!ticket) return reply.status(400).send({ error: 'missing ticket' })
    const rec = tickets.get(ticket)
    if (!rec || rec.expiresAt < Date.now()) {
      tickets.delete(ticket)
      return reply.status(401).send({ error: 'ticket invalid or expired' })
    }
    tickets.delete(ticket)
    const accessToken = fastify.jwt.sign({ id: rec.userId, tokenVersion: 1 })
    return { code: 0, data: { accessToken, user: { id: rec.userId } } }
  })
}
