// ============================================================
// Contract Validator — self-validation for Capability Contracts
// Validates: Schema, Constraints, Permissions
// ============================================================

import type {
  CapabilityContract,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types.js'
import { CapabilityCategory } from '../types.js'

export class ContractValidator {
  /**
   * Validate a full contract
   */
  validate(contract: Partial<CapabilityContract>): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Basic field validation
    this.validateName(contract.name, errors)
    this.validateDisplayName(contract.displayName, errors)
    this.validateCategory(contract.category, errors)
    this.validateVersion(contract.version, errors)
    this.validateStatus(contract.status, errors)

    // Schema validation
    if (contract.inputSchema) {
      this.validateSchemaString('inputSchema', contract.inputSchema, errors)
    }
    if (contract.outputSchema) {
      this.validateSchemaString('outputSchema', contract.outputSchema, errors)
    }

    // Constraints validation
    if (contract.constraints) {
      this.validateConstraints(contract.constraints, errors, warnings)
    }

    // Permissions validation
    if (contract.permissionProfile) {
      this.validatePermissions(contract.permissionProfile, errors, warnings)
    }

    // Quality profile validation
    if (contract.qualityProfile) {
      this.validateQualityProfile(contract.qualityProfile, errors, warnings)
    }

    // Tags validation
    if (contract.tags) {
      this.validateTags(contract.tags, warnings)
    }

    // Schema version
    this.validateSchemaVersion(contract.schemaVersion, warnings)

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date().toISOString(),
    }
  }

  private validateName(name: string | undefined, errors: ValidationError[]): void {
    if (!name) {
      errors.push({ field: 'name', code: 'REQUIRED', message: 'Contract name is required' })
    } else if (name.length < 2) {
      errors.push({ field: 'name', code: 'TOO_SHORT', message: 'Contract name must be at least 2 characters', value: name })
    } else if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
      errors.push({ field: 'name', code: 'INVALID_FORMAT', message: 'Contract name must start with a letter and contain only alphanumeric, underscore, or hyphen', value: name })
    }
  }

  private validateDisplayName(displayName: string | undefined, errors: ValidationError[]): void {
    if (!displayName) {
      errors.push({ field: 'displayName', code: 'REQUIRED', message: 'Display name is required' })
    }
  }

  private validateCategory(category: string | undefined, errors: ValidationError[]): void {
    if (!category) {
      errors.push({ field: 'category', code: 'REQUIRED', message: 'Category is required' })
    } else {
      const validCategories = Object.values(CapabilityCategory) as string[]
      if (!validCategories.includes(category)) {
        errors.push({
          field: 'category',
          code: 'INVALID_CATEGORY',
          message: `Invalid category '${category}'. Valid: ${validCategories.join(', ')}`,
          value: category,
        })
      }
    }
  }

  private validateVersion(version: string | undefined, errors: ValidationError[]): void {
    if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
      errors.push({ field: 'version', code: 'INVALID_VERSION', message: 'Version must be semver format (x.y.z)', value: version })
    }
  }

  private validateStatus(status: string | undefined, errors: ValidationError[]): void {
    if (status && !['active', 'deprecated', 'removed'].includes(status)) {
      errors.push({ field: 'status', code: 'INVALID_STATUS', message: `Invalid status '${status}'. Valid: active, deprecated, removed`, value: status })
    }
  }

  private validateSchemaString(field: string, schema: string, errors: ValidationError[]): void {
    try {
      const parsed = JSON.parse(schema)
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push({ field, code: 'INVALID_SCHEMA', message: `${field} must be a valid JSON Schema object` })
      }
    } catch {
      errors.push({ field, code: 'INVALID_JSON', message: `${field} is not valid JSON` })
    }
  }

  private validateConstraints(constraints: string, errors: ValidationError[], warnings: ValidationWarning[]): void {
    try {
      const parsed = JSON.parse(constraints)
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push({ field: 'constraints', code: 'INVALID_FORMAT', message: 'constraints must be a JSON object' })
      }
    } catch {
      errors.push({ field: 'constraints', code: 'INVALID_JSON', message: 'constraints is not valid JSON' })
    }
  }

  private validatePermissions(permissions: string, errors: ValidationError[], warnings: ValidationWarning[]): void {
    try {
      const parsed = JSON.parse(permissions)
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push({ field: 'permissionProfile', code: 'INVALID_FORMAT', message: 'permissionProfile must be a JSON object' })
      }
    } catch {
      errors.push({ field: 'permissionProfile', code: 'INVALID_JSON', message: 'permissionProfile is not valid JSON' })
    }
  }

  private validateQualityProfile(profile: string, errors: ValidationError[], warnings: ValidationWarning[]): void {
    try {
      const parsed = JSON.parse(profile)
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push({ field: 'qualityProfile', code: 'INVALID_FORMAT', message: 'qualityProfile must be a JSON object' })
      }
    } catch {
      errors.push({ field: 'qualityProfile', code: 'INVALID_JSON', message: 'qualityProfile is not valid JSON' })
    }
  }

  private validateTags(tags: string, warnings: ValidationWarning[]): void {
    try {
      const parsed = JSON.parse(tags)
      if (!Array.isArray(parsed)) {
        warnings.push({ field: 'tags', code: 'INVALID_FORMAT', message: 'tags should be a JSON array' })
      }
    } catch {
      warnings.push({ field: 'tags', code: 'INVALID_JSON', message: 'tags is not valid JSON' })
    }
  }

  private validateSchemaVersion(schemaVersion: number | undefined, warnings: ValidationWarning[]): void {
    if (schemaVersion === undefined || schemaVersion === null) {
      warnings.push({ field: 'schemaVersion', code: 'MISSING', message: 'schemaVersion should be explicitly set' })
    }
  }
}

export const contractValidator = new ContractValidator()
