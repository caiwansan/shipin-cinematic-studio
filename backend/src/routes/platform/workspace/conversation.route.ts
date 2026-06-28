// ============================================================
// Conversation Routes — 对话记录
// ============================================================

import type { FastifyInstance } from 'fastify'
import { conversationRuntime } from '../../../services/platform/workspace/conversation/conversation-runtime.js'

export default async function conversationRoutes(app: FastifyInstance) {
  // Log a message
  app.post('/api/platform/workspace/:workspaceId/conversation', async (req, reply) => {
    const { workspaceId } = req.params as any
    const { sessionId, role, content, context } = req.body as any
    const message = await conversationRuntime.logMessage(
      workspaceId, sessionId, role, content, context,
    )
    return reply.code(201).send(message)
  })

  // Get conversation context
  app.get('/api/platform/workspace/:workspaceId/conversation/:sessionId', async (req, reply) => {
    const { workspaceId, sessionId } = req.params as any
    const messages = await conversationRuntime.getContext(workspaceId, sessionId)
    return reply.send(messages)
  })

  // Get messages for LLM
  app.get('/api/platform/workspace/:workspaceId/conversation/:sessionId/llm', async (req, reply) => {
    const { workspaceId, sessionId } = req.params as any
    const messages = await conversationRuntime.getMessagesForLLM(workspaceId, sessionId)
    return reply.send(messages)
  })

  // Summarize conversation
  app.post('/api/platform/workspace/:workspaceId/conversation/:sessionId/summarize', async (req, reply) => {
    const { workspaceId, sessionId } = req.params as any
    const summary = await conversationRuntime.summarize(workspaceId, sessionId)
    return reply.send({ summary })
  })

  // Count messages
  app.get('/api/platform/workspace/:workspaceId/conversation/:sessionId/count', async (req, reply) => {
    const { workspaceId, sessionId } = req.params as any
    const count = await conversationRuntime.countMessages(workspaceId, sessionId)
    return reply.send({ count })
  })
}
