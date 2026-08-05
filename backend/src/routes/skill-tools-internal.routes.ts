/**
 * S3.4.1-BLOCKED Task 01 — 内部 Skill 工具路由（Hermes 工具后端）
 * POST /api/internal/skill-tools/resume-parse
 *   真实简历解析: filePath/text → pdf-text-extractor → ResumeParserAgent（确定性正则, 零 LLM）
 * 鉴权: x-internal-token（env KUNLUN_INTERNAL_TOKEN, .env 不入 git）
 * 禁止: 本模块零 LLM 引用（RP4）
 */
import type { FastifyInstance } from 'fastify'

function checkToken(request: any): boolean {
  const token = process.env.KUNLUN_INTERNAL_TOKEN
  if (!token) return false // fail closed
  return request.headers['x-internal-token'] === token
}

export async function registerSkillToolsInternalRoutes(app: FastifyInstance) {
  // 真实简历解析（确定性, 无 LLM）— Hermes resume.parse 工具后端
  app.post('/api/internal/skill-tools/resume-parse', async (request: any, reply: any) => {
    try {
      if (!checkToken(request)) {
        return reply.code(401).send({ error: 'UNAUTHORIZED' })
      }
      const body = request.body || {}
      const { text, filePath } = body
      if (!text && !filePath) {
        return reply.code(400).send({ error: 'TEXT_OR_FILE_REQUIRED' })
      }

      let sourceText: string
      if (text) {
        sourceText = text
      } else {
        const { extractTextFromPdfFile } = await import('../services/pdf-text-extractor.js')
        const extracted = await extractTextFromPdfFile(filePath)
        sourceText = extracted.text
        if (!sourceText) {
          return reply.code(422).send({ error: 'PDF_TEXT_EMPTY', message: 'PDF 未提取到文本' })
        }
      }

      const { ResumeParserAgent } = await import('../agents/job/resume-parser-agent.js')
      const agent = new ResumeParserAgent()
      const profile = agent.parseResume({ text: sourceText, fileName: filePath || undefined })
      const quality = agent.evaluateQuality(profile)

      return reply.send({ code: 0, data: { profile, quality, source: 'real', llmInvolved: false } })
    } catch (e: any) {
      request.log.error(e, 'internal resume-parse failed')
      return reply.code(500).send({ error: 'INTERNAL', message: e.message })
    }
  })
}
