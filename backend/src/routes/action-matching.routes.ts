/**
 * action-matching.routes.ts — 动作套路匹配 API（内部使用）
 *
 * POST /api/action/match     文本 → 匹配最佳套路模板 + 返回卷轴 prompt
 * GET  /api/action/categories 列出可用分类和统计
 */

import { FastifyInstance } from 'fastify'
import { matchBestTemplateFromDB, getTemplatesFromDB, buildScrollPrompt, syncJsonTemplatesToDB } from '../services/scroll-generator.service.js'

export default async function actionMatchingRoutes(app: FastifyInstance) {
  // ─── 文本匹配模板 ───
  app.post('/api/action/match', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { text, category, charNameA, charNameB } = request.body as any

    if (!text?.trim()) {
      return reply.status(400).send({ success: false, error: '缺少 text 参数' })
    }

    const template = await matchBestTemplateFromDB(text, category)
    if (!template) {
      return reply.send({
        success: true,
        data: { matched: false, template: null, message: '未匹配到合适的动作套路模板' },
      })
    }

    const scrollPrompt = buildScrollPrompt(template, charNameA, charNameB)

    return {
      success: true,
      data: {
        matched: true,
        template: {
          id: template.id,
          name: template.name,
          category: template.category,
          school: template.school || null,
          description: template.description,
          totalRounds: template.totalRounds,
          matchKeywords: template.matchKeywords,
          scrollImageUrl: template.scrollImageUrl || null,
          rounds: template.rounds.map(r => ({
            roundNumber: r.roundNumber,
            label: r.label,
            description: r.description,
            chars: r.chars,
            camera: r.camera,
            effects: r.effects,
            physics: r.physics,
            duration: r.duration,
          })),
          cameraLayout: template.cameraLayout,
        },
        scrollPrompt,
      },
    }
  })

  // ─── 列出可用分类 ───
  app.get('/api/action/categories', { preHandler: [app.authenticate] }, async () => {
    const templates = await getTemplatesFromDB()
    const catMap: Record<string, { count: number; schools: string[] }> = {}
    for (const t of templates) {
      if (!catMap[t.category]) catMap[t.category] = { count: 0, schools: [] }
      catMap[t.category].count++
      if (t.school && !catMap[t.category].schools.includes(t.school)) {
        catMap[t.category].schools.push(t.school)
      }
    }
    return { success: true, data: catMap }
  })

  // ─── 内部：从 JSON 重新同步到 DB（仅调试） ───
  const isProd = process.env.NODE_ENV === 'production'
  if (!isProd) {
    app.post('/api/action/sync', { preHandler: [app.authenticate] }, async () => {
      const count = await syncJsonTemplatesToDB()
      return { success: true, data: { synced: count } }
    })
  }
}
