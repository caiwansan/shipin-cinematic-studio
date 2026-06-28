// ============================================================
// Input Validator — validate input against contract inputSchema
// ============================================================

import type { ValidationResult, ValidationError, ValidationWarning } from '../types.js'

export class InputValidator {
  /**
   * Validate input data against a JSON Schema
   */
  validate(input: Record<string, unknown>, inputSchema: string | null): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    if (!inputSchema) {
      // No schema defined — skip validation
      return {
        valid: true,
        errors: [],
        warnings: [{ field: 'inputSchema', code: 'NO_SCHEMA', message: 'No input schema defined — skipping validation' }],
        validatedAt: new Date().toISOString(),
      }
    }

    let schema: Record<string, any>
    try {
      schema = JSON.parse(inputSchema)
    } catch {
      return {
        valid: false,
        errors: [{ field: 'inputSchema', code: 'INVALID_JSON', message: 'Input schema is not valid JSON' }],
        warnings: [],
        validatedAt: new Date().toISOString(),
      }
    }

    // Basic schema validation
    if (schema.type === 'object' && schema.properties) {
      // Check required fields
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredField of schema.required) {
          if (!(requiredField in input) || input[requiredField] === undefined || input[requiredField] === null) {
            errors.push({
              field: requiredField,
              code: 'REQUIRED',
              message: `Required field '${requiredField}' is missing or null`,
            })
          }
        }
      }

      // Check field types
      for (const [key, value] of Object.entries(input)) {
        const propSchema = schema.properties[key]
        if (propSchema && propSchema.type) {
          this.validateFieldType(key, value, propSchema, errors)
        }
      }
    }

    // Check for unknown fields (if additionalProperties is false)
    if (schema.type === 'object' && schema.additionalProperties === false && schema.properties) {
      const allowedFields = new Set(Object.keys(schema.properties))
      for (const key of Object.keys(input)) {
        if (!allowedFields.has(key)) {
          warnings.push({
            field: key,
            code: 'UNKNOWN_FIELD',
            message: `Unknown field '${key}' — will be ignored by some providers`,
            value: input[key],
          })
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

  private validateFieldType(field: string, value: unknown, schema: Record<string, any>, errors: ValidationError[]): void {
    const type = schema.type

    if (value === null || value === undefined) return

    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push({ field, code: 'TYPE_MISMATCH', message: `Expected string, got ${typeof value}`, value })
        } else if (schema.minLength && value.length < schema.minLength) {
          errors.push({ field, code: 'TOO_SHORT', message: `Minimum length is ${schema.minLength}`, value })
        } else if (schema.maxLength && value.length > schema.maxLength) {
          errors.push({ field, code: 'TOO_LONG', message: `Maximum length is ${schema.maxLength}`, value })
        } else if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
          errors.push({ field, code: 'PATTERN_MISMATCH', message: `Does not match pattern: ${schema.pattern}`, value })
        }
        break

      case 'number':
      case 'integer':
        if (typeof value !== 'number') {
          errors.push({ field, code: 'TYPE_MISMATCH', message: `Expected ${type}, got ${typeof value}`, value })
        } else {
          if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push({ field, code: 'TOO_SMALL', message: `Minimum value is ${schema.minimum}`, value })
          }
          if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push({ field, code: 'TOO_LARGE', message: `Maximum value is ${schema.maximum}`, value })
          }
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({ field, code: 'TYPE_MISMATCH', message: `Expected boolean, got ${typeof value}`, value })
        }
        break

      case 'array':
        if (!Array.isArray(value)) {
          errors.push({ field, code: 'TYPE_MISMATCH', message: `Expected array, got ${typeof value}`, value })
        } else {
          if (schema.minItems && value.length < schema.minItems) {
            errors.push({ field, code: 'TOO_FEW_ITEMS', message: `Minimum items is ${schema.minItems}`, value })
          }
          if (schema.maxItems && value.length > schema.maxItems) {
            errors.push({ field, code: 'TOO_MANY_ITEMS', message: `Maximum items is ${schema.maxItems}`, value })
          }
        }
        break

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push({ field, code: 'TYPE_MISMATCH', message: `Expected object, got ${typeof value}`, value })
        }
        break
    }
  }
}

export const inputValidator = new InputValidator()
