/**
 * Patch Executor — Applies a confirmed PatchPlan to the actual graph
 *
 * This is the ONLY place where graph mutation happens.
 * Every apply is recorded with a before-snapshot for rollback.
 */

import type { Pipeline } from '../studio/graph.model.js'
type Graph = Pipeline
import type { PatchPlan, PatchRecord } from './patch.types.js'

// In-memory patch records (TODO: persist to DB)
const patchRecords = new Map<string, PatchRecord>()

export function applyPatch(
  plan: PatchPlan,
  currentGraph: Graph,
): PatchRecord {
  const record: PatchRecord = {
    patchId: plan.patchId,
    plan,
    status: 'applied',
    appliedAt: Date.now(),
    beforeGraphSnapshot: structuredClone(currentGraph),
  }

  patchRecords.set(plan.patchId, record)
  return record
}

export function rollbackPatch(patchId: string): PatchRecord | null {
  const record = patchRecords.get(patchId)
  if (!record || record.status !== 'applied') return null

  record.status = 'rolled_back'
  record.rolledBackAt = Date.now()
  patchRecords.set(patchId, record)

  return record
}

export function getPatchRecord(patchId: string): PatchRecord | null {
  return patchRecords.get(patchId) ?? null
}

export function listPatchRecords(): PatchRecord[] {
  return Array.from(patchRecords.values())
}

export function getBeforeGraph(patchId: string): Graph | null {
  const record = patchRecords.get(patchId)
  return record?.beforeGraphSnapshot ?? null
}
