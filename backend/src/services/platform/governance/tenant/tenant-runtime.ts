// ============================================================
// Tenant Runtime — KMKI-PLAT-012
// ============================================================

import { tenantRepository } from '../repositories/tenant.repository.js'
import { quotaRepository } from '../repositories/quota.repository.js'
import { auditRepository } from '../repositories/audit.repository.js'
import { platformEventBus } from '@platform/events/event-bus.js'
import {
  createTenantCreatedEvent, createTenantActivatedEvent, createTenantDeactivatedEvent,
} from '../events/governance-events.js'
import type { TenantDTO, CreateTenantInput } from '../types.js'

export class TenantRuntime {
  async createTenant(input: CreateTenantInput, userId?: string): Promise<TenantDTO> {
    const tenant = await tenantRepository.create(input)
    // Auto-init quota
    await quotaRepository.init(tenant.id)
    // Audit
    await auditRepository.log({
      tenantId: tenant.id,
      userId,
      action: 'tenantCreated',
      resource: 'tenant',
      resourceId: tenant.id,
      details: { type: input.type, name: input.name },
    })
    // Event
    platformEventBus.emit(createTenantCreatedEvent(tenant.id, { type: input.type, name: input.name }))
    return tenant
  }

  async getTenant(id: string): Promise<TenantDTO | null> {
    return tenantRepository.findById(id)
  }

  async listTenants(): Promise<TenantDTO[]> {
    return tenantRepository.findAll()
  }

  async activateTenant(id: string, userId?: string): Promise<TenantDTO> {
    const tenant = await tenantRepository.update(id, { status: 'active' })
    await auditRepository.log({
      tenantId: id, userId, action: 'tenantActivated', resource: 'tenant', resourceId: id,
    })
    platformEventBus.emit(createTenantActivatedEvent(id))
    return tenant
  }

  async deactivateTenant(id: string, userId?: string): Promise<TenantDTO> {
    const tenant = await tenantRepository.update(id, { status: 'inactive' })
    await auditRepository.log({
      tenantId: id, userId, action: 'tenantDeactivated', resource: 'tenant', resourceId: id,
    })
    platformEventBus.emit(createTenantDeactivatedEvent(id))
    return tenant
  }

  async deleteTenant(id: string): Promise<void> {
    await tenantRepository.delete(id)
  }
}

export const tenantRuntime = new TenantRuntime()
