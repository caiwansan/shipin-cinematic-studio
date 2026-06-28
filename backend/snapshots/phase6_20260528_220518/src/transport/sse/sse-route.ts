/**
 * Phase SSE Wiring — SSE Route (Fastify)
 *
 * Provides the HTTP endpoint for SSE connections.
 * Clients connect with an executionId to receive live events.
 *
 * R5_EXECUTION_SCOPED_CONNECTION — Clients connect per executionId, not global
 * R4_SSE_NOT_TRUTH — SSE does NOT read or write ExecutionStore
 */

import type { FastifyInstance } from 'fastify'
import { globalSseSubscriber } from './sse-subscriber.js'

/**
 * Register the SSE route on a Fastify instance.
 */
export function registerSseRoute(app: FastifyInstance): void {
  app.get('/api/v1/events/:executionId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          executionId: { type: 'string' },
        },
      },
    },
  }, (request, reply) => {
    const { executionId } = request.params as { executionId: string }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // Subscribe the client — SSE is pure forwarder, no state access
    globalSseSubscriber.addClient(executionId, reply.raw)
  })
}
