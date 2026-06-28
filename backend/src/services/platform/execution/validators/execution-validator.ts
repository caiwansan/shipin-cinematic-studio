// ============================================================
// Execution Validator — Plan validation
// Validates: Step legality, Dependency DAG, Context, Contract Version, Retry Policy, Timeout
// ============================================================

import type { ExecutionPlan, ExecutionStep } from '../types.js'
import { StepType, EXECUTION_SCHEMA_VERSION } from '../types.js'
import { PlatformContext } from '@platform/context/platform-context'
import { ValidationError } from '@platform/errors/platform-errors'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  details?: Record<string, any>
}

/**
 * Valid step types for execution.
 */
const VALID_STEP_TYPES = new Set(Object.values(StepType))

export const executionValidator = {
  /**
   * Full plan validation.
   */
  async validate(
    plan: ExecutionPlan,
    _ctx?: PlatformContext,
  ): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // 1. Schema version check
    this._validateSchemaVersion(plan, errors, warnings)

    // 2. Basic structure
    this._validateBasicStructure(plan, errors, warnings)

    // 3. Step validation
    this._validateSteps(plan, errors, warnings)

    // 4. Dependency DAG validation
    this._validateDag(plan, errors, warnings)

    // 5. Retry policy validation
    this._validateRetryPolicy(plan, errors, warnings)

    // 6. Timeout validation
    this._validateTimeouts(plan, errors, warnings)

    // 7. Context validation
    this._validateContext(plan, errors, warnings)

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: {
        stepCount: plan.steps.length,
        dependencyCount: Object.keys(plan.dependencies || {}).length,
        parallelGroups: plan.parallelGroups?.length || 0,
      },
    }
  },

  /**
   * Quick validation — checks basic structure only.
   */
  async validateQuick(
    plan: ExecutionPlan,
    _ctx?: PlatformContext,
  ): Promise<boolean> {
    const result = await this.validate(plan, _ctx)
    return result.valid
  },

  /**
   * Validate schema version.
   */
  _validateSchemaVersion(
    plan: ExecutionPlan,
    errors: string[],
    warnings: string[],
  ): void {
    if (!plan.schemaVersion) {
      errors.push('Plan missing schemaVersion')
      return
    }
    const [major, minor] = plan.schemaVersion.split('.').map(Number)
    const [currentMajor] = EXECUTION_SCHEMA_VERSION.split('.').map(Number)
    if (major !== currentMajor) {
      errors.push(
        `Schema version mismatch: plan v${plan.schemaVersion}, runtime v${EXECUTION_SCHEMA_VERSION}`,
      )
    }
    if (minor > 0) {
      warnings.push(`Plan schema v${plan.schemaVersion} includes minor version features`)
    }
  },

  /**
   * Validate basic plan structure.
   */
  _validateBasicStructure(
    plan: ExecutionPlan,
    errors: string[],
    warnings: string[],
  ): void {
    if (!plan.id) {
      errors.push('Plan missing id')
    }
    if (!plan.capabilityId) {
      errors.push('Plan missing capabilityId')
    }
    if (!plan.version) {
      errors.push('Plan missing version')
    }
    if (!plan.steps || plan.steps.length === 0) {
      errors.push('Plan has no steps')
    }
    if (plan.steps.length > 100) {
      warnings.push(`Plan has ${plan.steps.length} steps; consider splitting`)
    }
  },

  /**
   * Validate each step.
   */
  _validateSteps(
    plan: ExecutionPlan,
    errors: string[],
    warnings: string[],
  ): void {
    const stepIds = new Set<string>()

    for (const step of plan.steps) {
      // Step ID uniqueness
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step id: ${step.id}`)
      }
      stepIds.add(step.id)

      // Step type validity
      if (!VALID_STEP_TYPES.has(step.type)) {
        errors.push(`Invalid step type: ${step.type} (step: ${step.id})`)
      }

      // Step name
      if (!step.name) {
        errors.push(`Step ${step.id} missing name`)
      }

      // Timeout
      if (step.timeout && (step.timeout < 100 || step.timeout > 600000)) {
        warnings.push(`Step ${step.id} timeout (${step.timeout}ms) out of range [100, 600000]`)
      }

      // Retry
      if (step.retry) {
        if (step.retry.maxAttempts < 1) {
          errors.push(`Step ${step.id} retry.maxAttempts must be >= 1`)
        }
        if (step.retry.backoffMs < 0) {
          errors.push(`Step ${step.id} retry.backoffMs must be >= 0`)
        }
      }

      // Dependencies
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (depId === step.id) {
            errors.push(`Step ${step.id} depends on itself`)
          }
        }
      }
    }
  },

  /**
   * Validate dependency DAG (no cycles).
   */
  _validateDag(
    plan: ExecutionPlan,
    errors: string[],
    warnings: string[],
  ): void {
    const stepIds = new Set(plan.steps.map(s => s.id))

    // Check that all dependencies reference valid steps
    for (const step of plan.steps) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            errors.push(`Step ${step.id} depends on unknown step: ${depId}`)
          }
        }
      }
    }

    // Check for cycles using DFS
    const visited = new Set<string>()
    const inStack = new Set<string>()

    function hasCycle(stepId: string): boolean {
      if (inStack.has(stepId)) return true
      if (visited.has(stepId)) return false

      visited.add(stepId)
      inStack.add(stepId)

      const step = plan.steps.find(s => s.id === stepId)
      if (step?.dependencies) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) return true
        }
      }

      inStack.delete(stepId)
      return false
    }

    for (const step of plan.steps) {
      if (!visited.has(step.id)) {
        if (hasCycle(step.id)) {
          errors.push(`Dependency cycle detected involving step: ${step.id}`)
          break
        }
      }
    }
  },

  /**
   * Validate retry policy.
   */
  _validateRetryPolicy(
    plan: ExecutionPlan,
    errors: string[],
    _warnings: string[],
  ): void {
    if (plan.retryPolicy) {
      if (plan.retryPolicy.maxAttempts < 1) {
        errors.push('Plan retry.maxAttempts must be >= 1')
      }
      if (plan.retryPolicy.maxAttempts > 10) {
        errors.push('Plan retry.maxAttempts cannot exceed 10')
      }
      if (plan.retryPolicy.backoffMs < 0) {
        errors.push('Plan retry.backoffMs must be >= 0')
      }
    }
  },

  /**
   * Validate timeout configuration.
   */
  _validateTimeouts(
    plan: ExecutionPlan,
    errors: string[],
    _warnings: string[],
  ): void {
    if (plan.timeoutProfile) {
      if (plan.timeoutProfile.stepTimeout < 100) {
        errors.push('Plan step timeout too low: must be >= 100ms')
      }
      if (plan.timeoutProfile.planTimeout < plan.timeoutProfile.stepTimeout) {
        errors.push('Plan timeout must be >= step timeout')
      }
      if (plan.timeoutProfile.executionTimeout < plan.timeoutProfile.planTimeout) {
        errors.push('Execution timeout must be >= plan timeout')
      }
    }
  },

  /**
   * Validate platform context.
   */
  _validateContext(
    plan: ExecutionPlan,
    _errors: string[],
    warnings: string[],
  ): void {
    if (plan.context) {
      if (plan.context.capabilityId && plan.context.capabilityId !== plan.capabilityId) {
        warnings.push('Context capabilityId differs from plan capabilityId')
      }
    }
  },
}
