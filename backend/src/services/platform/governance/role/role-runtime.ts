// ============================================================
// Role Runtime — KMKI-PLAT-012
// RBAC + Capability dual-dimension permission model
// ============================================================

import { roleRepository } from '../repositories/role.repository.js'
import { govUserRepository } from '../repositories/user.repository.js'
import { auditRepository } from '../repositories/audit.repository.js'
import { platformEventBus } from '@platform/events/event-bus.js'
import { createRoleCreatedEvent, createRoleAssignedEvent } from '../events/governance-events.js'
import type { RoleDTO } from '../types.js'

export class RoleRuntime {
  async createRole(data: {
    tenantId: string; code: string; name: string;
    description?: string; capabilities: string[]
  }, userId?: string): Promise<RoleDTO> {
    const role = await roleRepository.create(data)
    await auditRepository.log({
      tenantId: data.tenantId, userId, action: 'permissionChanged',
      resource: 'role', resourceId: role.id,
      details: { code: data.code, capabilities: data.capabilities },
    })
    platformEventBus.emit(createRoleCreatedEvent(data.tenantId, { roleId: role.id, code: data.code }))
    return role
  }

  async assignRole(userId: string, roleId: string, tenantId: string, operatorId?: string): Promise<void> {
    await roleRepository.assignToUser(userId, roleId)
    await auditRepository.log({
      tenantId, userId: operatorId, action: 'permissionChanged',
      resource: 'user', resourceId: userId,
      details: { roleId },
    })
    platformEventBus.emit(createRoleAssignedEvent(tenantId, { userId, roleId }))
  }

  async getUserCapabilities(userId: string): Promise<string[]> {
    const user = await govUserRepository.findById(userId)
    if (!user?.role) return []
    const role = await roleRepository.findById(user.role)
    if (!role) return []
    return role.capabilities
  }

  async getRoles(tenantId: string): Promise<RoleDTO[]> {
    return roleRepository.findByTenant(tenantId)
  }

  async updateRole(id: string, data: Partial<{ name: string; description: string; capabilities: string[] }>): Promise<RoleDTO> {
    return roleRepository.update(id, data)
  }

  async deleteRole(id: string): Promise<void> {
    await roleRepository.delete(id)
  }
}

export const roleRuntime = new RoleRuntime()
