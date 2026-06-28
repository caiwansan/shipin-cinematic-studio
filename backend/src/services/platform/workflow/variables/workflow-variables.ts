// ============================================================
// Workflow Variables (KMKI-PLAT-011)
// Unified variable system: Global → Workflow → Node → Output → Environment
// Template reference: ${scene.title}, ${video.url}, ${cost.total}
// ============================================================

import { workflowVariableRepository } from '../repositories/variable.repository.js'
import { workflowInstanceRepository } from '../repositories/instance.repository.js'
import { VariableScope } from '../types.js'
import { RuntimeError } from '@platform/errors/platform-errors'

export type VariableMap = Record<string, Record<string, any>>

export class WorkflowVariablesManager {
  // ─── Set Variable ───

  async setVariable(
    instanceId: string,
    scope: string,
    name: string,
    value: any,
    nodeId?: string,
  ): Promise<void> {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value)

    await workflowVariableRepository.upsert({
      instanceId,
      scope,
      name,
      value: stringValue,
      nodeId,
    })
  }

  // ─── Get Variable ───

  async getVariable(
    instanceId: string,
    scope: string,
    name: string,
  ): Promise<any | null> {
    const record = await workflowVariableRepository.findByName(instanceId, scope, name)
    if (!record) return null

    try {
      return JSON.parse(record.value as string)
    } catch {
      return record.value
    }
  }

  // ─── Get All Variables as Flat Map ───

  async getAllVariables(instanceId: string): Promise<VariableMap> {
    const records = await workflowVariableRepository.findByInstance(instanceId)
    const variables: VariableMap = {}

    for (const record of records) {
      if (!variables[record.scope]) {
        variables[record.scope] = {}
      }
      try {
        variables[record.scope][record.name] = JSON.parse(record.value as string)
      } catch {
        variables[record.scope][record.name] = record.value
      }
    }

    return variables
  }

  // ─── Get Merged Variables (all scopes, priority: Environment > Output > Node > Workflow > Global) ───

  async getMergedVariables(instanceId: string): Promise<Record<string, any>> {
    const allVars = await this.getAllVariables(instanceId)
    const merged: Record<string, any> = {}

    // Merge in priority order (lowest priority first)
    const scopeOrder = [
      VariableScope.Global,
      VariableScope.Workflow,
      VariableScope.Node,
      VariableScope.Output,
      VariableScope.Environment,
    ]

    for (const scope of scopeOrder) {
      if (allVars[scope]) {
        Object.assign(merged, allVars[scope])
      }
    }

    return merged
  }

  // ─── Resolve Template ───

  resolveTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, path: string) => {
      const value = this.resolvePath(variables, path.trim())
      if (value === undefined || value === null) {
        return match // Keep original if not found
      }
      return String(value)
    })
  }

  // ─── Resolve Template (Recursive, for nested objects) ───

  resolveObjectTemplates(
    obj: Record<string, any>,
    variables: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.resolveTemplate(value, variables)
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.resolveObjectTemplates(value, variables)
      } else if (Array.isArray(value)) {
        result[key] = value.map(item =>
          typeof item === 'object' && item !== null
            ? this.resolveObjectTemplates(item, variables)
            : typeof item === 'string'
              ? this.resolveTemplate(item, variables)
              : item,
        )
      } else {
        result[key] = value
      }
    }

    return result
  }

  // ─── Initialize Default Variables from Workflow Definition ───

  async initializeDefaultVariables(
    instanceId: string,
    workflowVariables?: Record<string, any> | string | null,
    input?: Record<string, any> | string | null,
  ): Promise<void> {
    // Parse input
    let inputObj: Record<string, any> = {}
    if (input) {
      inputObj = typeof input === 'object' ? input : JSON.parse(input)
    }

    // Set input as workflow-scoped variables
    for (const [key, value] of Object.entries(inputObj)) {
      await this.setVariable(instanceId, VariableScope.Workflow, key, value)
    }

    // Set default variables from workflow definition
    if (workflowVariables) {
      const defaults = typeof workflowVariables === 'object'
        ? workflowVariables
        : JSON.parse(workflowVariables)

      for (const [key, value] of Object.entries(defaults)) {
        // Only set if not already set by input
        const existing = await this.getVariable(instanceId, VariableScope.Workflow, key)
        if (existing === null) {
          await this.setVariable(instanceId, VariableScope.Global, key, value)
        }
      }
    }
  }

  // ─── Set Node Output as Variables ───

  async setNodeOutputVariables(
    instanceId: string,
    nodeId: string,
    output: Record<string, any>,
  ): Promise<void> {
    for (const [key, value] of Object.entries(output)) {
      await this.setVariable(instanceId, VariableScope.Output, `${nodeId}.${key}`, value, nodeId)
    }
  }

  // ─── Delete Instance Variables ───

  async deleteInstanceVariables(instanceId: string): Promise<void> {
    await workflowVariableRepository.deleteByInstance(instanceId)
  }

  // ─── Private Helpers ───

  private resolvePath(obj: Record<string, any>, path: string): any {
    const parts = path.split('.')
    let current: any = obj

    for (const part of parts) {
      if (current === undefined || current === null) return undefined
      current = current[part]
    }

    return current
  }
}

export const workflowVariablesManager = new WorkflowVariablesManager()
