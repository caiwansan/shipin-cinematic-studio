// ============================================================
// Execution Plan Repository — Plan CRUD
// Plan and Runtime data are stored separately (decoupled)
// ============================================================

import type { ExecutionPlan, ExecutionPlanQuery } from '../types.js'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { PlatformContext } from '@platform/context/platform-context'

/**
 * In-memory store for execution plans.
 * Can be replaced with a database-backed implementation.
 */
const planStore = new Map<string, ExecutionPlan>()

export const executionPlanRepository = {
  /**
   * Save a new execution plan.
   */
  async save(plan: ExecutionPlan, _ctx?: PlatformContext): Promise<ExecutionPlan> {
    planStore.set(plan.id, { ...plan })
    return plan
  },

  /**
   * Get a plan by ID.
   */
  async getById(id: string, _ctx?: PlatformContext): Promise<ExecutionPlan | null> {
    const plan = planStore.get(id)
    return plan ? { ...plan } : null
  },

  /**
   * Update an existing plan.
   */
  async update(id: string, plan: Partial<ExecutionPlan>, _ctx?: PlatformContext): Promise<ExecutionPlan> {
    const existing = planStore.get(id)
    if (!existing) {
      throw new RepositoryError(`Plan not found: ${id}`, { planId: id })
    }
    const updated = { ...existing, ...plan, id }
    planStore.set(id, updated)
    return updated
  },

  /**
   * Delete a plan by ID.
   */
  async delete(id: string, _ctx?: PlatformContext): Promise<void> {
    planStore.delete(id)
  },

  /**
   * List plans with optional filtering.
   */
  async list(query: ExecutionPlanQuery, _ctx?: PlatformContext): Promise<{ items: ExecutionPlan[]; total: number }> {
    let items = Array.from(planStore.values())

    if (query.capabilityId) {
      items = items.filter(p => p.capabilityId === query.capabilityId)
    }
    if (query.version) {
      items = items.filter(p => p.version === query.version)
    }

    const total = items.length
    const page = query.page || 1
    const pageSize = query.pageSize || 50
    const start = (page - 1) * pageSize
    items = items.slice(start, start + pageSize)

    return { items, total }
  },

  /**
   * Get all plan IDs.
   */
  async listIds(_ctx?: PlatformContext): Promise<string[]> {
    return Array.from(planStore.keys())
  },

  /**
   * Clear all plans (for testing).
   */
  async clear(_ctx?: PlatformContext): Promise<void> {
    planStore.clear()
  },
}
