// ============================================================
// Capability Validator — unified validation entry point
// All validation goes through here — no other module validates capabilities
// ============================================================

import type { ValidationResult } from '../types.js'
import { inputValidator } from './input-validator.js'
import { outputValidator } from './output-validator.js'
import { constraintValidator, type ConstraintValidationRequest } from './constraint-validator.js'
import { permissionValidator, type PermissionCheck } from './permission-validator.js'
import type { CapabilityContract } from '../types.js'

export interface FullValidationRequest {
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  constraints?: ConstraintValidationRequest
  permissions?: PermissionCheck
}

export class CapabilityValidator {
  /**
   * Full validation pipeline: input → constraints → permissions → output
   */
  validateAll(
    contract: CapabilityContract,
    request: FullValidationRequest,
  ): { valid: boolean; results: Record<string, ValidationResult> } {
    const results: Record<string, ValidationResult> = {}

    // Input validation
    if (request.input) {
      results.input = inputValidator.validate(request.input, contract.inputSchema)
    }

    // Output validation
    if (request.output) {
      results.output = outputValidator.validate(request.output, contract.outputSchema)
    }

    // Constraint validation
    if (request.constraints) {
      results.constraints = constraintValidator.validate(request.constraints, contract.constraints)
    }

    // Permission validation
    if (request.permissions) {
      results.permissions = permissionValidator.validate(request.permissions, contract.permissionProfile)
    }

    const allValid = Object.values(results).every(r => r.valid)

    return {
      valid: allValid,
      results,
    }
  }

  /**
   * Validate input only
   */
  validateInput(contract: CapabilityContract, input: Record<string, unknown>): ValidationResult {
    return inputValidator.validate(input, contract.inputSchema)
  }

  /**
   * Validate output only
   */
  validateOutput(contract: CapabilityContract, output: Record<string, unknown>): ValidationResult {
    return outputValidator.validate(output, contract.outputSchema)
  }

  /**
   * Validate constraints only
   */
  validateConstraints(contract: CapabilityContract, constraints: ConstraintValidationRequest): ValidationResult {
    return constraintValidator.validate(constraints, contract.constraints)
  }

  /**
   * Validate permissions only
   */
  validatePermissions(contract: CapabilityContract, permissions: PermissionCheck): ValidationResult {
    return permissionValidator.validate(permissions, contract.permissionProfile)
  }
}

export const capabilityValidator = new CapabilityValidator()
