// ============================================================
// Agent Tool REST Routes
// ============================================================

import { FastifyInstance } from 'fastify'
import { agentService } from '../../../services/platform/agent/agent.service'

export default async function toolRoutes(app: FastifyInstance) {
  // List available tools
  app.get('/api/platform/agent-tools', async (request, reply) => {
    const tools = agentService.listTools()
    return { success: true, data: tools }
  })

  // Get tool status
  app.get<{ Params: { type: string } }>('/api/platform/agent-tools/:type/status', async (request, reply) => {
    const status = agentService.getToolStatus(request.params.type as any)
    return { success: true, data: { type: request.params.type, status } }
  })

  // Install tool
  app.post('/api/platform/agent-tools/:type/install', async (request, reply) => {
    const { type } = request.params as any
    const body = request.body as any
    try {
      await agentService.installTool(type as any, body)
      return { success: true, data: { type, status: 'installed' } }
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: err.message })
    }
  })

  // Invoke tool
  app.post('/api/platform/agent-tools/:type/invoke', async (request, reply) => {
    const { type } = request.params as any
    const body = request.body as any
    try {
      const result = await agentService.invokeTool(
        type as any,
        body.name || type,
        body.params || {},
        body.context,
      )
      return { success: true, data: result }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}
