// ============================================================
// Output Validator — validate output against contract outputSchema
// ============================================================

import type { ValidationResult, ValidationError, ValidationWarning } from '../types.js'

export class OutputValidator {
  /**
   * Validate output data against a JSON Schema
   */
  validate(output: Record<string, unknown>, outputSchema: string | null): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    if (!outputSchema) {
      return {
        valid: true,
        errors: [],
        warnings: [{ field: 'outputSchema', code: 'NO_SCHEMA', message: 'No output schema defined — skipping validation' }],
        validatedAt: new Date().toISOString(),
      }
    }

    let schema: Record<string, any>
    try {
      schema = JSON.parse(outputSchema)
    } catch {
      return {
        valid: false,
        errors: [{ field: 'outputSchema', code: 'INVALID_JSON', message: 'Output schema is not valid JSON' }],
        warnings: [],
        validatedAt: new Date().toISOString(),
      }
    }

    // Validate type
    if (schema.type === 'object' && schema.properties) {
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredField of schema.required) {
          if (!(requiredField in output) || output[requiredField] === undefined || output[requiredField] === null) {
            errors.push({
              field: requiredField,
              code: 'REQUIRED_OUTPUT',
              message: `Output is missing required field '${requiredField}'`,
            })
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date().toISOString(),
    }
  }
}

export const outputValidator = new OutputValidator()
