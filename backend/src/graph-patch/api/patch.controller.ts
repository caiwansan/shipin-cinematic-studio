/**
 * Patch Engine — Controller
 *
 * Three endpoints:
 *   POST /api/graph-patch/from-optimization
 *   POST /api/graph-patch/preview
 *   POST /api/graph-patch/apply
 *   POST /api/graph-patch/rollback
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import { buildAllPatches } from '../patch.builder.js'
import { validatePatchPlan } from '../patch.validator.js'
import { generatePreview } from '../patch.preview.engine.js'
import { applyPatch, rollbackPatch, getPatchRecord, getBeforeGraph } from '../patch.executor.js'
import type { OptimizationResult } from '../../graph-optimization/optimization.types.js'

// ── POST /api/graph-patch/from-optimization ──
// Takes optimization result + graph, returns PatchPlan[]

async function handleFromOptimization(req: FastifyRequest, reply: FastifyReply) {
  const { runId, optimization, graph } = req.body as {
    runId: string
    optimization: OptimizationResult
    graph: any
  }

  if (!runId || !optimization?.suggestions || !graph) {
    return reply.status(400).send({ ok: false, error: 'runId, optimization, and graph are required' })
  }

  try {
    const plans = buildAllPatches(runId, optimization.suggestions, graph)

    // Validate each plan
    const validated = plans.map(plan => ({
      plan,
      validation: validatePatchPlan(plan, graph),
    }))

    return reply.send({
      ok: true,
      patches: validated.filter(v => v.validation.valid).map(v => v.plan),
      invalid: validated.filter(v => !v.validation.valid).map(v => ({
        patchId: v.plan.patchId,
        errors: v.validation.errors,
      })),
    })
  } catch (err: any) {
    console.error('[patch] from-optimization error:', err)
    return reply.status(500).send({ ok: false, error: err.message })
  }
}

// ── POST /api/graph-patch/preview ──
// Takes a PatchPlan, returns preview overlay data

async function handlePreview(req: FastifyRequest, reply: FastifyReply) {
  const { plan } = req.body as { plan: any }

  if (!plan?.patchId || !plan?.diff) {
    return reply.status(400).send({ ok: false, error: 'Valid PatchPlan is required' })
  }

  try {
    const preview = generatePreview(plan)
    return reply.send({ ok: true, preview })
  } catch (err: any) {
    console.error('[patch] preview error:', err)
    return reply.status(500).send({ ok: false, error: err.message })
  }
}

// ── POST /api/graph-patch/apply ──
// Confirms and applies a patch plan to the graph

async function handleApply(req: FastifyRequest, reply: FastifyReply) {
  const { plan, graph } = req.body as { plan: any; graph: any }

  if (!plan?.patchId || !graph) {
    return reply.status(400).send({ ok: false, error: 'plan and current graph are required' })
  }

  try {
    const record = applyPatch(plan, graph)
    const previewGraph = plan.previewGraph

    return reply.send({
      ok: true,
      patchId: record.patchId,
      status: record.status,
      beforeGraph: record.beforeGraphSnapshot,
      afterGraph: previewGraph,
    })
  } catch (err: any) {
    console.error('[patch] apply error:', err)
    return reply.status(500).send({ ok: false, error: err.message })
  }
}

// ── POST /api/graph-patch/rollback ──
// Rolls back a previously applied patch

async function handleRollback(req: FastifyRequest, reply: FastifyReply) {
  const { patchId } = req.body as { patchId: string }

  if (!patchId) {
    return reply.status(400).send({ ok: false, error: 'patchId is required' })
  }

  try {
    const record = rollbackPatch(patchId)
    if (!record) {
      return reply.status(404).send({ ok: false, error: `Patch not found or already rolled back: ${patchId}` })
    }

    const beforeGraph = getBeforeGraph(patchId)
    return reply.send({
      ok: true,
      patchId,
      status: record.status,
      restoredGraph: beforeGraph,
    })
  } catch (err: any) {
    console.error('[patch] rollback error:', err)
    return reply.status(500).send({ ok: false, error: err.message })
  }
}

export async function registerPatchRoutes(app: FastifyInstance) {
  app.post('/api/graph-patch/from-optimization', handleFromOptimization)
  app.post('/api/graph-patch/preview', handlePreview)
  app.post('/api/graph-patch/apply', handleApply)
  app.post('/api/graph-patch/rollback', handleRollback)
}
