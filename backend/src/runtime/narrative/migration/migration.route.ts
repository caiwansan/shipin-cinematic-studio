/**
 * migration.route.ts — Migration Engine HTTP API
 * 
 * POST /api/narrative/migration/run    执行迁移
 * GET  /api/narrative/migration/status  查看迁移状态
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { narrativeMigrationEngine } from './migration-engine.js'

export async function registerMigrationRoutes(app: FastifyInstance) {
  app.post('/api/narrative/migration/run', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any
    if (!body?.projectId) {
      return reply.status(400).send({ error: 'projectId required' })
    }

    const options = {
      projectId: body.projectId,
      targetRuntimes: body.targetRuntimes || ['event', 'relationship'],
      fromChapter: body.fromChapter || 1,
      toChapter: body.toChapter || undefined,
      overwrite: body.overwrite || false,
    }

    // 验证 targetRuntimes
    const valid = ['event', 'relationship']
    for (const t of options.targetRuntimes) {
      if (!valid.includes(t)) {
        return reply.status(400).send({ error: `Invalid target runtime: ${t}. Valid: ${valid.join(', ')}` })
      }
    }

    const record = await narrativeMigrationEngine.migrate(options)

    const statusCode = record.status === 'failed' ? 500 : record.status === 'partial' ? 207 : 200
    return reply.status(statusCode).send(record)
  })

  app.post('/api/narrative/migration/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      engine: 'NarrativeMigrationEngine',
      phase: '3.1.6',
      targetRuntimes: ['event', 'relationship'],
      principles: [
        '只迁移 P0 类型',
        '所有 Fact 标注 Origin=MIGRATION',
        '高置信度优先',
        '增量兼容',
        '可追溯',
      ],
      excludedRuntimes: {
        knowledge: '等待 Story Librarian 自然建立',
        foreshadow: '容易误判',
        world: '后果比空更严重',
      },
    })
  })
}
