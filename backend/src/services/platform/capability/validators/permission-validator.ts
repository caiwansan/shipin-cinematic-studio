// ============================================================
// Permission Validator — validate permissions against contract
// ============================================================

import type { ValidationResult, ValidationError, ValidationWarning } from '../types.js'

export interface PermissionCheck {
  userId?: string
  roles?: string[]
  permissions?: string[]
  workspaceId?: string
}

export class PermissionValidator {
  /**
   * Validate request permissions against contract permission profile
   */
  validate(
    request: PermissionCheck,
    permissionProfileStr: string | null,
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    if (!permissionProfileStr) {
      return {
        valid: true,
        errors: [],
        warnings: [{ field: 'permissionProfile', code: 'NO_PERMISSION_PROFILE', message: 'No permission profile defined' }],
        validatedAt: new Date().toISOString(),
      }
    }

    let profile: {
      requireAuth?: boolean
      requiredRoles?: string[]
      requiredPermissions?: string[]
    }
    try {
      profile = JSON.parse(permissionProfileStr)
    } catch {
      return {
        valid: false,
        errors: [{ field: 'permissionProfile', code: 'INVALID_JSON', message: 'Permission profile is not valid JSON' }],
        warnings: [],
        validatedAt: new Date().toISOString(),
      }
    }

    // Check auth requirement
    if (profile.requireAuth === true && !request.userId) {
      errors.push({
        field: 'userId',
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required for this capability',
      })
    }

    // Check required roles
    if (profile.requiredRoles && profile.requiredRoles.length > 0) {
      const userRoles = request.roles || []
      const hasRequiredRole = profile.requiredRoles.some(role => userRoles.includes(role))
      if (!hasRequiredRole) {
        errors.push({
          field: 'roles',
          code: 'INSUFFICIENT_ROLES',
          message: `Required one of roles: ${profile.requiredRoles.join(', ')}`,
          value: { userRoles, requiredRoles: profile.requiredRoles },
        })
      }
    }

    // Check required permissions
    if (profile.requiredPermissions && profile.requiredPermissions.length > 0) {
      const userPermissions = request.permissions || []
      const hasRequiredPermission = profile.requiredPermissions.some(p => userPermissions.includes(p))
      if (!hasRequiredPermission) {
        errors.push({
          field: 'permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Required one of permissions: ${profile.requiredPermissions.join(', ')}`,
          value: { userPermissions, requiredPermissions: profile.requiredPermissions },
        })
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

export const permissionValidator = new PermissionValidator()
