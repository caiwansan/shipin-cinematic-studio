/**
 * routes/model-selection.ts — MSAL HTTP endpoint
 *
 * Exposes the single model selection authority as an API:
 *   POST /api/v1/authority/select-model
 *
 * This is the ONLY place in the system where model selection happens.
 * Every backend consumer (SECS, adapters, workers) must call this.
 */

import { FastifyInstance } from 'fastify'
import { selectModel, type CapabilityType, type ModelSelectionInput } from '../authority/model-selection/index.js'

export default async function register(server: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/authority/select-model
   *
   * Input:  { capability, userId, preferredModel?, preferredProvider? }
   * Output: { provider, modelName, source }
   */
  server.post('/select-model', async (request, reply) => {
    try {
      const body = request.body as Record<string, any>
      const { capability, userId, preferredModel, preferredProvider } = body

      if (!capability || !userId) {
        return reply.status(400).send({
          success: false,
          error: 'capability and userId are required',
        })
      }

      const validCapabilities: CapabilityType[] = ['llm_generate', 'image_generate', 'video_generate', 'tts']
      if (!validCapabilities.includes(capability as CapabilityType)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid capability. Must be one of: ${validCapabilities.join(', ')}`,
        })
      }

      const input: ModelSelectionInput = {
        capability: capability as CapabilityType,
        userId,
        preferredModel,
        preferredProvider,
      }

      const result = await selectModel(input)

      return reply.send({
        success: true,
        data: result,
      })
    } catch (err: any) {
      if (err.name === 'MSALResolutionError') {
        return reply.status(400).send({
          success: false,
          error: err.message,
        })
      }
      console.error('[MSAL] Error:', err)
      return reply.status(500).send({
        success: false,
        error: 'Model selection failed',
      })
    }
  })

  /**
   * GET /api/v1/authority/health — MSAL ping
   */
  server.get('/health', async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        authority: 'MSAL',
        status: 'active',
        message: 'Single Authority Model Selection Protocol (SAMSP) is active. No default models. No fallback.',
      },
    })
  })
}
