// ============================================================
// Execution Route — Execute API endpoints
// POST /api/platform/execution/execute
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { executionService } from '../../../services/platform/execution/execution.service.js'
import { PlatformContext } from '@platform/context/platform-context'

interface ExecuteRequestBody {
  capabilityId: string
  contract: {
    id: string
    name: string
    displayName: string
    description: string | null
    category: string
    version: string
    status: string
    steps?: any[]
    metadata?: Record<string, any>
  }
  input?: Record<string, any>
  strategy?: string
}

export default async function executionRoute(app: FastifyInstance): Promise<void> {
  /**
   * Execute a capability from its contract.
   */
  app.post('/platform/execution/execute', async (request: FastifyRequest<{ Body: ExecuteRequestBody }>, reply: FastifyReply) => {
    try {
      const { capabilityId, contract, input, strategy } = request.body

      if (!capabilityId || !contract) {
        return reply.status(400).send({
          success: false,
          error: 'capabilityId and contract are required',
        })
      }

      const ctx: PlatformContext = {
        traceId: `exec-${Date.now()}`,
        requestId: `req-${Date.now()}`,
        userId: (request as any).user?.id,
        projectId: input?.projectId,
      }

      const result = await executionService.executeFromContract({
        capabilityId,
        contract: {
          id: contract.id,
          name: contract.name,
          displayName: contract.displayName,
          description: contract.description,
          category: contract.category,
          version: contract.version,
          status: contract.status,
          metadata: contract.metadata,
        },
        input,
        strategy: strategy as any,
      }, ctx)

      return reply.status(result.status === 'completed' ? 200 : 500).send({
        success: result.status === 'completed',
        data: result,
      })
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: (err as Error).message,
      })
    }
  })

  /**
   * Compile a contract without executing.
   */
  app.post('/platform/execution/compile', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { contract } = request.body as any

      if (!contract) {
        return reply.status(400).send({
          success: false,
          error: 'contract is required',
        })
      }

      const result = await executionService.compileOnly(contract)
      return reply.send({
        success: true,
        data: result,
      })
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: (err as Error).message,
      })
    }
  })

  /**
   * Validate a plan without executing.
   */
  app.post('/platform/execution/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { plan } = request.body as any

      if (!plan) {
        return reply.status(400).send({
          success: false,
          error: 'plan is required',
        })
      }

      const result = await executionService.validatePlan(plan)
      return reply.send({
        success: result.valid,
        data: result,
      })
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: (err as Error).message,
      })
    }
  })
}
