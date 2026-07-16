/**
 * narrative-integrity.route.ts — NOS Integrity Check HTTP API
 * 
 * 路由挂载在 /api/narrative/integrity 下，仅开发阶段可用。
 * 生产环境应通过 Story Librarian 自动调用。
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { NarrativeIntegrityChecker } from './narrative-integrity-checker.js'

export async function registerNarrativeIntegrityRoutes(app: FastifyInstance) {
  // ─── 执行完整性检查 ───
  app.post('/api/narrative/integrity/check', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId, rules } = req.body as any
    if (!projectId) {
      return reply.status(400).send({ error: 'projectId required' })
    }

    const checker = new NarrativeIntegrityChecker()
    const report = rules
      ? await checker.checkRules(projectId, rules)
      : await checker.check(projectId)
    return reply.send(report)
  })

  // ─── 获取可用规则 ───
  app.get('/api/narrative/integrity/rules', async (_req: FastifyRequest, reply: FastifyReply) => {
    const checker = new NarrativeIntegrityChecker()
    return reply.send(checker.listRules())
  })
}
