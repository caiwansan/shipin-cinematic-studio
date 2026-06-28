/**
 * Runtime Service — business logic layer
 *
 * Orchestrates validate → compile → execute pipeline.
 * Manages run lifecycle and SSE event emission.
 */

import { randomUUID } from 'crypto'
import { GraphValidator } from '../../graph-runtime/validator/graph.validator.js'
import { compileGraph } from '../../graph-runtime/compiler/graph.compiler.js'
import { GraphRuntime, type RuntimeResult } from '../../graph-runtime/runtime/graph.runtime.js'
import { ExecutionContext } from '../../graph-runtime/runtime/context.js'
import { executeStep } from '../../graph-runtime/runtime/node.executor.js'
import type { ExecutionPlan, ExecutionStep } from '../../graph-runtime/compiler/graph.compiler.js'
import type { Graph } from '../../graph-runtime/core/graph.types.js'
import type { RuntimeRun, RuntimeRunEvent, RunStatus, NodeRunState } from './run.model.js'

// ============================================================
// SSE Event Bus (in-memory, replace with Redis in production)
// ============================================================

type SSEListener = (event: RuntimeRunEvent) => void
const sseListeners = new Map<string, Set<SSEListener>>()

export function subscribeToRun(runId: string, listener: SSEListener): () => void {
  if (!sseListeners.has(runId)) sseListeners.set(runId, new Set())
  sseListeners.get(runId)!.add(listener)
  return () => sseListeners.get(runId)?.delete(listener)
}

function emitEvent(event: RuntimeRunEvent): void {
  // Persist to event store
  const evts = runEventStore.get(event.runId) ?? []
  evts.push(event)
  runEventStore.set(event.runId, evts)

  // SSE broadcast
  const listeners = sseListeners.get(event.runId)
  if (listeners) for (const fn of listeners) fn(event)
  const wildcard = sseListeners.get('*')
  if (wildcard) for (const fn of wildcard) fn(event)
}

// ============================================================
// Run Store (in-memory — swap to DB/Redis later)
// ============================================================

const runStore = new Map<string, RuntimeRun>()

// Event store — one array per run
const runEventStore = new Map<string, RuntimeRunEvent[]>()

// Artifact store — node outputs per run
const runArtifactStore = new Map<string, Record<string, any>>()

export function getRun(runId: string): RuntimeRun | undefined {
  return runStore.get(runId)
}

export function listActiveRuns(): RuntimeRun[] {
  return [...runStore.values()].filter(r => r.status === 'pending' || r.status === 'running')
}

export function listAllRuns(): RuntimeRun[] {
  return [...runStore.values()].sort((a, b) => b.startedAt - a.startedAt)
}

// ============================================================
// Validate
// ============================================================

export function validateGraph(graph: Graph) {
  const validator = new GraphValidator()
  const result = validator.validate(graph)

  return {
    ok: result.ok,
    errors: result.errors.map(e => ({
      type: e.code,
      edgeId: e.edgeId,
      nodeId: e.nodeId,
      message: e.message,
    })),
    warnings: result.warnings.map(w => ({
      type: w.code,
      edgeId: w.edgeId,
      nodeId: w.nodeId,
      message: w.message,
    })),
  }
}

// ============================================================
// Compile
// ============================================================

export function compileExecution(graph: Graph) {
  const pipelineId = graph.id || `pipeline_${randomUUID().slice(0, 8)}`

  // Validate first
  const validation = validateGraph(graph)
  if (!validation.ok) {
    return {
      ok: false,
      executionPlan: null as any,
      errors: validation.errors.map(e => e.message),
    }
  }

  // Compile
  const plan = compileGraph(graph, pipelineId)

  const stages: string[][] = []
  const phaseMap = new Map<number, string[]>()
  for (const step of plan.steps) {
    const phase = phaseMap.get(step.phase) ?? []
    phase.push(step.nodeId)
    phaseMap.set(step.phase, phase)
  }
  for (const [phase] of [...phaseMap.entries()].sort(([a], [b]) => a - b)) {
    stages.push(phaseMap.get(phase)!)
  }

  return {
    ok: true,
    executionPlan: {
      stages,
      topologicalLevels: plan.topologicalLevels,
      totalSteps: plan.totalSteps,
      maxParallel: plan.maxParallel,
      steps: plan.steps.map(s => ({
        nodeId: s.nodeId,
        nodeType: s.nodeType,
        label: s.label,
        phase: s.phase,
        dependencies: s.dependencies,
      })),
    },
  }
}

// ============================================================
// Execute (async)
// ============================================================

export async function executeGraph(graph: Graph, pipelineId?: string): Promise<{ runId: string }> {
  const runId = `run_${randomUUID().slice(0, 12)}`
  const pid = pipelineId || graph.id || `pipeline_${randomUUID().slice(0, 8)}`

  // Validate first
  const validation = validateGraph(graph)
  if (!validation.ok) {
    throw new Error(`Graph validation failed: ${validation.errors.map(e => e.message).join('; ')}`)
  }

  // Compile
  const plan = compileGraph(graph, pid)

  // Create run record
  const run: RuntimeRun = {
    id: runId,
    pipelineId: pid,
    graphSnapshot: JSON.parse(JSON.stringify(graph)),
    status: 'pending',
    startedAt: Date.now(),
    nodeStates: {},
    totalSteps: plan.totalSteps,
    completedSteps: 0,
    failedSteps: 0,
  }

  // Initialize node states
  for (const step of plan.steps) {
    run.nodeStates[step.nodeId] = { status: 'pending' }
  }

  runStore.set(runId, run)
  emitEvent({ runId, type: 'run:pending', timestamp: Date.now() })

  // Execute in background (non-blocking)
  setImmediate(async () => {
    await executeRunInBackground(run, plan)
  })

  return { runId }
}

async function executeRunInBackground(run: RuntimeRun, plan: ExecutionPlan): Promise<void> {
  run.status = 'running'
  emitEvent({ runId: run.id, type: 'run:start', timestamp: Date.now() })

  const ctx = new ExecutionContext()

  // Group by phase
  const phases = new Map<number, ExecutionStep[]>()
  for (const step of plan.steps) {
    const p = phases.get(step.phase) ?? []
    p.push(step)
    phases.set(step.phase, p)
  }

  let completedSteps = 0
  let failedSteps = 0

  for (const [phaseIdx, steps] of [...phases.entries()].sort(([a], [b]) => a - b)) {
    emitEvent({ runId: run.id, type: 'phase:start', timestamp: Date.now(), phase: phaseIdx })

    const phasePromises = steps.map(async (step) => {
      // Mark node as running
      run.nodeStates[step.nodeId] = { status: 'running', startedAt: Date.now() }
      emitEvent({ runId: run.id, type: 'node:start', timestamp: Date.now(), nodeId: step.nodeId, nodeType: step.nodeType })

      try {
        const result = await executeStep(step, ctx)
        run.nodeStates[step.nodeId] = { status: 'completed', startedAt: Date.now(), finishedAt: Date.now() }
        completedSteps++

        // Store output artifact
        const artifacts = runArtifactStore.get(run.id) ?? {}
        artifacts[step.nodeId] = result
        runArtifactStore.set(run.id, artifacts)

        emitEvent({
          runId: run.id, type: 'node:complete', timestamp: Date.now(),
          nodeId: step.nodeId, nodeType: step.nodeType,
          durationMs: Date.now() - (run.nodeStates[step.nodeId].startedAt ?? Date.now()),
        })
        return result
      } catch (err: any) {
        run.nodeStates[step.nodeId] = { status: 'failed', startedAt: Date.now(), finishedAt: Date.now(), error: err.message }
        failedSteps++
        emitEvent({
          runId: run.id, type: 'node:failed', timestamp: Date.now(),
          nodeId: step.nodeId, nodeType: step.nodeType, error: err.message,
        })
      }
    })

    await Promise.allSettled(phasePromises)
    emitEvent({ runId: run.id, type: 'phase:complete', timestamp: Date.now(), phase: phaseIdx })
  }

  // Finalize run
  run.completedSteps = completedSteps
  run.failedSteps = failedSteps
  run.status = failedSteps === 0 ? 'completed' : 'failed'
  run.finishedAt = Date.now()

  emitEvent({
    runId: run.id,
    type: run.status === 'completed' ? 'run:complete' : 'run:failed',
    timestamp: Date.now(),
    progress: { completed: completedSteps, total: run.totalSteps },
  })

  // ── v5.4: Auto-ingest execution feedback into trajectory system ──
  maybeIngestExecutionFeedback(run, plan)
}

/**
 * Attempt to auto-ingest execution feedback into the v5.4 feedback loop.
 * Deactivated — autograph v5.4 pruned (2026-05-21).
 */
async function maybeIngestExecutionFeedback(_run: RuntimeRun, _plan: ExecutionPlan): Promise<void> {
  // autograph v5.4 ingestion pipeline removed — no-op
}

// ============================================================
// Run Status
// ============================================================

export function getRunStatus(runId: string) {
  const run = runStore.get(runId)
  if (!run) return null

  return {
    runId: run.id,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    nodeStates: run.nodeStates,
    progress: {
      total: run.totalSteps,
      completed: run.completedSteps,
      failed: run.failedSteps,
    },
  }
}

// ============================================================
// Event Store
// ============================================================

export function getRunEvents(runId: string): RuntimeRunEvent[] {
  return runEventStore.get(runId) ?? []
}

// ============================================================
// Replay Data
// ============================================================

export function getRunReplayData(runId: string) {
  const run = runStore.get(runId)
  if (!run) return null

  return {
    run: {
      id: run.id,
      pipelineId: run.pipelineId,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      totalSteps: run.totalSteps,
      completedSteps: run.completedSteps,
      failedSteps: run.failedSteps,
    },
    graphSnapShot: run.graphSnapshot,
    nodeStates: run.nodeStates,
    events: runEventStore.get(runId) ?? [],
    artifacts: runArtifactStore.get(runId) ?? {},
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

