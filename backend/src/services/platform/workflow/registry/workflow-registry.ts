// ============================================================
// Workflow Registry (KMKI-PLAT-011)
// Register, unregister, find, and version workflow definitions
// ============================================================

import type { WorkflowDefinition } from '../types.js'
import { workflowDefinitionRepository } from '../repositories/definition.repository.js'
import { RepositoryError } from '@platform/errors/platform-errors'

export class WorkflowRegistry {
  // ─── Register ───

  async register(definition: WorkflowDefinition): Promise<WorkflowDefinition> {
    const existing = await workflowDefinitionRepository.findByCode(definition.code)
    if (existing) {
      // Update existing
      return workflowDefinitionRepository.update(existing.id!, definition)
    }

    return workflowDefinitionRepository.create(definition)
  }

  // ─── Unregister ───

  async unregister(code: string): Promise<void> {
    const existing = await workflowDefinitionRepository.findByCode(code)
    if (!existing || !existing.id) {
      throw new RepositoryError('Workflow definition not found', { code })
    }

    await workflowDefinitionRepository.delete(existing.id)
  }

  // ─── Find by Code ───

  async findByCode(code: string): Promise<WorkflowDefinition | null> {
    return workflowDefinitionRepository.findByCode(code)
  }

  // ─── Find by ID ───

  async findById(id: string): Promise<WorkflowDefinition | null> {
    return workflowDefinitionRepository.findById(id)
  }

  // ─── List by Category ───

  async listByCategory(category: string): Promise<WorkflowDefinition[]> {
    return workflowDefinitionRepository.list({ category })
  }

  // ─── List All ───

  async list(filter?: { status?: string; category?: string }): Promise<WorkflowDefinition[]> {
    return workflowDefinitionRepository.list(filter)
  }

  // ─── Get Version ───

  async getVersion(code: string): Promise<string | null> {
    const def = await workflowDefinitionRepository.findByCode(code)
    return def?.version || null
  }

  // ─── Check if workflow exists ───

  async exists(code: string): Promise<boolean> {
    const def = await workflowDefinitionRepository.findByCode(code)
    return def !== null
  }

  // ─── Count ───

  async count(filter?: { status?: string; category?: string }): Promise<number> {
    return workflowDefinitionRepository.count(filter)
  }

  // ─── Status Transition ───

  async setStatus(code: string, status: string): Promise<WorkflowDefinition> {
    const def = await workflowDefinitionRepository.findByCode(code)
    if (!def || !def.id) {
      throw new RepositoryError('Workflow definition not found', { code })
    }
    return workflowDefinitionRepository.update(def.id, { status })
  }

  // ─── Validate Before Registration ───

  async validateDefinition(definition: WorkflowDefinition): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!definition.code || definition.code.trim().length === 0) {
      errors.push('Workflow code is required')
    }
    if (!definition.name || definition.name.trim().length === 0) {
      errors.push('Workflow name is required')
    }
    if (!definition.version || definition.version.trim().length === 0) {
      errors.push('Workflow version is required')
    }

    // Validate graph
    if (!definition.graph) {
      errors.push('Workflow graph is required')
    } else {
      try {
        const { validateGraph, parseGraph } = await import('../graph/workflow-graph.js')
        const { nodes, edges } = parseGraph(definition)
        const validation = validateGraph(nodes, edges)
        if (!validation.valid) {
          errors.push(...validation.errors.map(e => e.message))
        }
      } catch (err: any) {
        errors.push(`Invalid graph: ${err.message}`)
      }
    }

    return { valid: errors.length === 0, errors }
  }
}

export const workflowRegistry = new WorkflowRegistry()
