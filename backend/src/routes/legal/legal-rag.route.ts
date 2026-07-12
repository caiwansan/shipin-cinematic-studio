/**
 * routes/legal/legal-rag.route.ts — Legal RAG API
 *
 * Sprint Intelligence: Legal Knowledge Retrieval
 */

import type { FastifyInstance } from 'fastify'
import { legalRAG } from '../../services/legal/legal-rag.service.js'

export default async function legalRagRoutes(app: FastifyInstance) {
  // ── POST /api/admin/legal/rag/reindex — 重建全部 embedding ──
  app.post('/api/admin/legal/rag/reindex', async (request, reply) => {
    // 异步执行，立即返回
    legalRAG.reindexAll().then(result => {
      console.log(`[LegalRAG] 重建完成: knowledge=${result.knowledge}, regulation=${result.regulation}`)
    }).catch(err => {
      console.error(`[LegalRAG] 重建失败:`, err.message)
    })

    return { success: true, data: { message: 'Embedding 重建已启动，请稍后查看结果' } }
  })

  // ── GET /api/legal/rag/search — 法律知识搜索（前端调用） ──
  app.get('/api/legal/rag/search', async (request) => {
    const query = request.query as any
    const q = query.q || ''
    const topK = Math.min(parseInt(query.topK || '5'), 20)

    if (!q) return { success: true, data: [] }

    const results = await legalRAG.retrieve(q, topK)
    return { success: true, data: results }
  })

  // ── POST /api/admin/legal/rag/index/:type/:id — 单条重建 embedding ──
  app.post('/api/admin/legal/rag/index/:type/:id', async (request) => {
    const { type, id } = request.params as any
    const start = Date.now()

    try {
      if (type === 'knowledge') {
        await legalRAG.indexKnowledge(id)
      } else if (type === 'regulation') {
        await legalRAG.indexRegulation(id)
      } else {
        return { success: false, error: '类型错误，支持: knowledge, regulation' }
      }

      return { success: true, data: { message: `${type}/${id} 索引完成`, latency: Date.now() - start } }
    } catch (err: any) {
      return { success: false, error: `索引失败: ${err.message}` }
    }
  })
}
