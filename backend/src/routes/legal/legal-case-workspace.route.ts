/**
 * Legal Case Workspace Routes — Case-Centric API
 *
 * All operations revolve around a LegalCase (caseId).
 * This file implements the Sprint 1 MVP:
 *   Chat (sessions + messages), Files, Analysis, Evidence, Contracts, Documents
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'

export default async function legalCaseWorkspaceRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════
  // CHAT — Sessions & Messages
  // ═══════════════════════════════════════════════

  // GET /api/legal/cases/:caseId/chats — list chat sessions for a case
  app.get('/api/legal/cases/:caseId/chats', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    // Verify ownership
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const sessions = await prisma.legalCaseChatSession.findMany({
      where: { caseId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    })
    return { success: true, data: sessions }
  })

  // POST /api/legal/cases/:caseId/chats — create a new chat session
  app.post('/api/legal/cases/:caseId/chats', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const body = request.body as any

    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const session = await prisma.legalCaseChatSession.create({
      data: { caseId, title: body.title || '新咨询' },
    })
    return { success: true, data: session }
  })

  // GET /api/legal/chats/:sessionId/messages — get messages for a session
  app.get('/api/legal/chats/:sessionId/messages', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { sessionId } = request.params as any

    // Verify the session belongs to a case owned by user
    const session = await prisma.legalCaseChatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!session) return { success: false, error: '会话不存在' }

    const c = await prisma.legalCase.findFirst({ where: { id: session.caseId, userId: user.id } })
    if (!c) return { success: false, error: '无权访问' }

    return { success: true, data: { session: { id: session.id, title: session.title, status: session.status }, messages: session.messages } }
  })

  // POST /api/legal/chats/:sessionId/messages — send a message (user) + AI reply
  app.post('/api/legal/chats/:sessionId/messages', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { sessionId } = request.params as any
    const { content } = request.body as any
    if (!content) return { success: false, error: '消息内容不能为空' }

    const session = await prisma.legalCaseChatSession.findUnique({ where: { id: sessionId } })
    if (!session) return { success: false, error: '会话不存在' }

    const c = await prisma.legalCase.findFirst({ where: { id: session.caseId, userId: user.id } })
    if (!c) return { success: false, error: '无权访问' }

    // Save user message
    const userMsg = await prisma.legalCaseChatMessage.create({
      data: { sessionId, role: 'user', content },
    })

    // Sprint 1.5: AI Runtime Integration — Legal Agent
    let aiContent: string
    try {
      const { legalAgent } = await import('../../services/legal/legal-agent.service.js')
      aiContent = await legalAgent.chat(session.caseId, sessionId, content, user.id)
    } catch (err: any) {
      console.error(`[LegalChat] AI Runtime error for case ${session.caseId}:`, err.message)
      aiContent = `感谢您的咨询。我已收到您的信息：「${content}」。\n\n（AI 服务暂时不可用，请稍后再试）`
    }

    const aiMsg = await prisma.legalCaseChatMessage.create({
      data: { sessionId, role: 'assistant', content: aiContent },
    })

    return { success: true, data: { user: userMsg, assistant: aiMsg } }
  })

  // ═══════════════════════════════════════════════
  // FILES
  // ═══════════════════════════════════════════════

  // GET /api/legal/cases/:caseId/files — list files for a case
  app.get('/api/legal/cases/:caseId/files', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const files = await prisma.legalCaseFile.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } })
    return { success: true, data: files }
  })

  // POST /api/legal/cases/:caseId/files — register an uploaded file to a case
  app.post('/api/legal/cases/:caseId/files', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const body = request.body as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const file = await prisma.legalCaseFile.create({
      data: {
        caseId,
        fileName: body.fileName,
        mimeType: body.mimeType,
        size: body.size,
        storageKey: body.storageKey,
        category: body.category || null,
      },
    })
    return { success: true, data: file }
  })

  // DELETE /api/legal/cases/:caseId/files/:fileId
  app.delete('/api/legal/cases/:caseId/files/:fileId', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId, fileId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    await prisma.legalCaseFile.delete({ where: { id: fileId } })
    return { success: true, data: { id: fileId } }
  })

  // ═══════════════════════════════════════════════
  // ANALYSIS
  // ═══════════════════════════════════════════════

  // GET /api/legal/cases/:caseId/analyses — list all analysis versions
  app.get('/api/legal/cases/:caseId/analyses', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const analyses = await prisma.legalCaseAnalysis.findMany({
      where: { caseId },
      orderBy: { version: 'desc' },
    })
    return { success: true, data: analyses }
  })

  // GET /api/legal/cases/:caseId/analyses/latest — get latest analysis
  app.get('/api/legal/cases/:caseId/analyses/latest', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const analysis = await prisma.legalCaseAnalysis.findFirst({
      where: { caseId },
      orderBy: { version: 'desc' },
    })
    return { success: true, data: analysis }
  })

  // POST /api/legal/cases/:caseId/analyses — trigger AI analysis
  app.post('/api/legal/cases/:caseId/analyses', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    // Get latest version number
    const latest = await prisma.legalCaseAnalysis.findFirst({
      where: { caseId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const newVersion = (latest?.version || 0) + 1

    // Create analysis with processing status
    const analysis = await prisma.legalCaseAnalysis.create({
      data: {
        caseId,
        version: newVersion,
        status: 'processing',
      },
    })

    // Sprint 1.5: AI Runtime Integration — Real analysis
    try {
      const { legalAgent } = await import('../../services/legal/legal-agent.service.js')
      // Trigger analysis asynchronously — user can poll status
      legalAgent.analyze(caseId, user.id, newVersion).then(async (result) => {
        await prisma.legalCaseAnalysis.update({
          where: { id: analysis.id },
          data: { ...result, id: undefined, caseId: undefined, version: undefined, createdAt: undefined, updatedAt: undefined },
        })
      }).catch(async (err) => {
        console.error(`[LegalAnalysis] Error for case ${caseId}:`, err.message)
        await prisma.legalCaseAnalysis.update({
          where: { id: analysis.id },
          data: { status: 'failed', summary: `AI 分析失败：${err.message}` },
        })
      })
    } catch (err: any) {
      console.error(`[LegalAnalysis] LegalAgent init error:`, err.message)
      // Fallback: mark as done with minimal data
      setTimeout(async () => {
        await prisma.legalCaseAnalysis.update({
          where: { id: analysis.id },
          data: { status: 'done', summary: `案件「${c.caseName}」的 AI 分析已排队，请稍后刷新查看完整结果。` },
        })
      }, 100)
    }

    return { success: true, data: analysis }
  })

  // ═══════════════════════════════════════════════
  // EVIDENCE
  // ═══════════════════════════════════════════════

  // GET /api/legal/cases/:caseId/evidence — list evidence
  app.get('/api/legal/cases/:caseId/evidence', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const evidence = await prisma.legalEvidence.findMany({
      where: { caseId },
      orderBy: [{ evidenceDate: 'asc' }, { createdAt: 'asc' }],
    })
    return { success: true, data: evidence }
  })

  // POST /api/legal/cases/:caseId/evidence — add evidence
  app.post('/api/legal/cases/:caseId/evidence', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const body = request.body as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const ev = await prisma.legalEvidence.create({
      data: {
        caseId,
        title: body.title,
        description: body.description || null,
        evidenceDate: body.evidenceDate ? new Date(body.evidenceDate) : null,
        category: body.category || null,
        fileId: body.fileId || null,
        status: body.status || 'collected',
      },
    })
    return { success: true, data: ev }
  })

  // PATCH /api/legal/cases/:caseId/evidence/:evidenceId — update evidence
  app.patch('/api/legal/cases/:caseId/evidence/:evidenceId', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId, evidenceId } = request.params as any
    const body = request.body as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const updated = await prisma.legalEvidence.update({ where: { id: evidenceId }, data: body })
    return { success: true, data: updated }
  })

  // DELETE /api/legal/cases/:caseId/evidence/:evidenceId
  app.delete('/api/legal/cases/:caseId/evidence/:evidenceId', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId, evidenceId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    await prisma.legalEvidence.delete({ where: { id: evidenceId } })
    return { success: true, data: { id: evidenceId } }
  })

  // ═══════════════════════════════════════════════
  // CONTRACTS
  // ═══════════════════════════════════════════════

  // GET /api/legal/cases/:caseId/contracts
  app.get('/api/legal/cases/:caseId/contracts', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const contracts = await prisma.legalContract.findMany({ where: { caseId }, orderBy: { updatedAt: 'desc' } })
    return { success: true, data: contracts }
  })

  // POST /api/legal/cases/:caseId/contracts
  app.post('/api/legal/cases/:caseId/contracts', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const body = request.body as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const contract = await prisma.legalContract.create({
      data: {
        caseId,
        title: body.title,
        content: body.content || null,
        category: body.category || null,
        status: body.status || 'draft',
      },
    })
    return { success: true, data: contract }
  })

  // PATCH /api/legal/cases/:caseId/contracts/:contractId
  app.patch('/api/legal/cases/:caseId/contracts/:contractId', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId, contractId } = request.params as any
    const body = request.body as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const updated = await prisma.legalContract.update({ where: { id: contractId }, data: body })
    return { success: true, data: updated }
  })

  // DELETE /api/legal/cases/:caseId/contracts/:contractId
  app.delete('/api/legal/cases/:caseId/contracts/:contractId', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId, contractId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    await prisma.legalContract.delete({ where: { id: contractId } })
    return { success: true, data: { id: contractId } }
  })

  // ═══════════════════════════════════════════════
  // LEGAL DOCUMENTS
  // ═══════════════════════════════════════════════

  // GET /api/legal/cases/:caseId/documents
  app.get('/api/legal/cases/:caseId/documents', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const docs = await prisma.legalLegalDocument.findMany({ where: { caseId }, orderBy: { updatedAt: 'desc' } })
    return { success: true, data: docs }
  })

  // POST /api/legal/cases/:caseId/documents
  app.post('/api/legal/cases/:caseId/documents', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const body = request.body as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const doc = await prisma.legalLegalDocument.create({
      data: {
        caseId,
        title: body.title,
        docType: body.docType,
        content: body.content || null,
        status: body.status || 'draft',
      },
    })
    return { success: true, data: doc }
  })

  // PATCH /api/legal/cases/:caseId/documents/:docId
  app.patch('/api/legal/cases/:caseId/documents/:docId', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId, docId } = request.params as any
    const body = request.body as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const updated = await prisma.legalLegalDocument.update({ where: { id: docId }, data: body })
    return { success: true, data: updated }
  })

  // DELETE /api/legal/cases/:caseId/documents/:docId
  app.delete('/api/legal/cases/:caseId/documents/:docId', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId, docId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    await prisma.legalLegalDocument.delete({ where: { id: docId } })
    return { success: true, data: { id: docId } }
  })

  // ═══════════════════════════════════════════════
  // CASE WORKSPACE — Aggregated view
  // ═══════════════════════════════════════════════

  // GET /api/legal/cases/:caseId/workspace — full workspace data for CaseWorkspace.vue
  app.get('/api/legal/cases/:caseId/workspace', { preHandler: [app.authenticate] }, async (request) => {
    const user = request.user as any
    const { caseId } = request.params as any
    const c = await prisma.legalCase.findFirst({ where: { id: caseId, userId: user.id } })
    if (!c) return { success: false, error: '案件不存在或无权访问' }

    const [
      chatSessions,
      files,
      analyses,
      evidence,
      contracts,
      documents,
    ] = await Promise.all([
      prisma.legalCaseChatSession.findMany({ where: { caseId }, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { messages: true } } } }),
      prisma.legalCaseFile.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } }),
      prisma.legalCaseAnalysis.findMany({ where: { caseId }, orderBy: { version: 'desc' }, take: 1 }),
      prisma.legalEvidence.findMany({ where: { caseId }, orderBy: [{ evidenceDate: 'asc' }, { createdAt: 'asc' }] }),
      prisma.legalContract.findMany({ where: { caseId }, orderBy: { updatedAt: 'desc' } }),
      prisma.legalLegalDocument.findMany({ where: { caseId }, orderBy: { updatedAt: 'desc' } }),
    ])

    return {
      success: true,
      data: {
        case: c,
        chatSessions,
        files,
        latestAnalysis: analyses[0] || null,
        evidence,
        contracts,
        documents,
      },
    }
  })
}
