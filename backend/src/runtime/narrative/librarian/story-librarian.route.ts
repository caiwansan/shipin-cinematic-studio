/**
 * story-librarian.route.ts — Story Librarian HTTP API
 * 
 * 挂载路由
 * POST /api/narrative/librarian/process  — 处理一章正文
 * GET  /api/narrative/librarian/status    — 检查状态
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { storyLibrarian } from './story-librarian.js'

export async function registerStoryLibrarianRoutes(app: FastifyInstance) {
  // ─── 处理一章正文 ───
  app.post('/api/narrative/librarian/process', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any
    if (!body?.projectId || !body?.chapterNo || !body?.content) {
      return reply.status(400).send({ error: 'projectId, chapterNo, content required' })
    }

    const userId = (req as any).user?.id || body.userId || 'system'
    
    const report = await storyLibrarian.process({
      projectId: body.projectId,
      userId,
      chapterNo: body.chapterNo,
      chapterTitle: body.chapterTitle || '',
      content: body.content,
      povCharacter: body.povCharacter,
    })

    return reply.send(report)
  })

  // ─── 检查状态 ───
  app.get('/api/narrative/librarian/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'active',
      description: 'Narrative Truth Maintainer — only component with Runtime write access',
      version: 'phase-2',
    })
  })
}
