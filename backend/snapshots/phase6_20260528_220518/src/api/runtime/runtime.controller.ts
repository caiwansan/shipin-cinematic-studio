/**
 * Runtime API — Controller
 *
 * Thin handlers that parse request, call service, format response.
 */

import type { FastifyRequest, FastifyReply } from 'fastify'
import {
  validateGraph,
  compileExecution,
  executeGraph,
  getRunStatus,
  getRunReplayData,
  listAllRuns,
  subscribeToRun,
} from './runtime.service.js'
import { convertToGraphDSL } from './graph.adapter.js'
import type { ValidateRequest, CompileRequest, ExecuteRequest } from './dto/runtime.dto.js'

export async function handleValidate(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const body = req.body as ValidateRequest
  const graph = convertToGraphDSL(body.graph)
  const result = validateGraph(graph)
  return reply.send(result)
}

export async function handleCompile(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const body = req.body as CompileRequest
  const graph = convertToGraphDSL(body.graph)
  const result = compileExecution(graph)
  return reply.send(result)
}

export async function handleExecute(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const body = req.body as ExecuteRequest
  const graph = convertToGraphDSL(body.graph)
  try {
    const { runId } = await executeGraph(graph, body.pipelineId)
    return reply.status(202).send({
      runId,
      status: 'running',
      graphId: body.graph.id || body.pipelineId,
      startedAt: Date.now(),
    })
  } catch (err: any) {
    return reply.status(400).send({ ok: false, error: err.message })
  }
}

export async function handleRunStatus(
  req: FastifyRequest<{ Params: { runId: string } }>,
  reply: FastifyReply,
) {
  const result = getRunStatus(req.params.runId)
  if (!result) return reply.status(404).send({ ok: false, error: 'Run not found' })
  return reply.send(result)
}

export async function handleRunEvents(
  req: FastifyRequest<{ Params: { runId: string } }>,
  reply: FastifyReply,
) {
  const runId = req.params.runId
  const run = getRunStatus(runId)
  if (!run) {
    return reply.status(404).send({ ok: false, error: 'Run not found' })
  }

  // SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  // Send initial status
  reply.raw.write(`data: ${JSON.stringify({ type: 'status', ...run })}\n\n`)

  // Send all stored events first
  const { getRunEvents } = await import('./runtime.service.js')
  const stored = getRunEvents(runId)
  for (const evt of stored) {
    reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`)
  }

  // Subscribe to events
  const unsubscribe = subscribeToRun(runId, (event) => {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
  })

  // Keep alive
  const keepAlive = setInterval(() => {
    reply.raw.write(': keepalive\n\n')
  }, 15000)

  // Cleanup on disconnect
  req.raw.on('close', () => {
    unsubscribe()
    clearInterval(keepAlive)
  })
}

/**
 * List all runs
 */
export async function handleRunList(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const runs = listAllRuns().map(r => ({
    runId: r.id,
    pipelineId: r.pipelineId,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    totalSteps: r.totalSteps,
    completedSteps: r.completedSteps,
    failedSteps: r.failedSteps,
  }))
  return reply.send({ runs })
}

/**
 * Replay data for a specific run
 * Returns the full event log + node outputs for frontend replay
 */
export async function handleRunReplay(
  req: FastifyRequest<{ Params: { runId: string } }>,
  reply: FastifyReply,
) {
  const runId = req.params.runId
  const data = getRunReplayData(runId)
  if (!data) return reply.status(404).send({ ok: false, error: 'Run not found' })
  return reply.send(data)
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

