// ============================================================
// Resource Registry — register, discover, classify, version, lifecycle
// KMKI-PLAT-008
// ============================================================

import { PluginRegistry } from '@platform/plugins/plugin-registry'
import type { ResourcePlugin, ResourceContract } from '../types'
import { contractRepository } from '../repositories/contract.repository'
import { matrixRepository } from '../repositories/matrix.repository'
import { PlatformError } from '@platform/errors/platform-errors'

/**
 * Resource Registry — manages AI resource lifecycle.
 * Uses PluginRegistry for runtime plugin dispatch.
 */
export class ResourceRegistry {
  private pluginRegistry: PluginRegistry<ResourcePlugin>

  constructor() {
    this.pluginRegistry = new PluginRegistry<ResourcePlugin>()
  }

  // ─── Plugin Management ───

  registerPlugin(plugin: ResourcePlugin): void {
    this.pluginRegistry.register(plugin)
  }

  getPlugin(name: string): ResourcePlugin | undefined {
    return this.pluginRegistry.resolve(name)
  }

  listPlugins(type?: string): ResourcePlugin[] {
    return this.pluginRegistry.discover(type)
  }

  // ─── Contract Management ───

  async registerContract(data: {
    name: string
    type: string
    vendor: string
    description?: string
    capabilities?: string
    models?: string
    endpoints?: string
    authentication?: string
    pricing?: string
    limits?: string
    metadata?: string
  }): Promise<ResourceContract> {
    const existing = await contractRepository.findByName(data.name)
    if (existing) {
      throw new PlatformError('RESOURCE_ALREADY_EXISTS', `Resource contract "${data.name}" already exists`)
    }
    return contractRepository.create(data as any)
  }

  async getContract(id: string): Promise<ResourceContract | null> {
    return contractRepository.findById(id)
  }

  async getContractByName(name: string): Promise<ResourceContract | null> {
    return contractRepository.findByName(name)
  }

  async listContracts(params?: {
    type?: string
    vendor?: string
    status?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<{ items: ResourceContract[]; total: number }> {
    return contractRepository.list(params)
  }

  async updateContract(id: string, data: Partial<ResourceContract>): Promise<ResourceContract> {
    return contractRepository.update(id, data)
  }

  async deprecateContract(id: string): Promise<ResourceContract> {
    return contractRepository.update(id, { status: 'deprecated' as any })
  }

  async deleteContract(id: string): Promise<void> {
    await contractRepository.delete(id)
  }

  // ─── Discovery ───

  async discoverByCapability(capabilityId: string): Promise<ResourceContract[]> {
    const matrixEntries = await matrixRepository.findByCapabilityId(capabilityId)
    const resourceIds = matrixEntries.map(m => m.resourceId)
    const contracts: ResourceContract[] = []
    for (const id of resourceIds) {
      const c = await contractRepository.findById(id)
      if (c && c.status === 'active') contracts.push(c)
    }
    return contracts
  }

  async discoverByType(type: string): Promise<ResourceContract[]> {
    const result = await contractRepository.list({ type, status: 'active' })
    return result.items
  }

  async discoverByVendor(vendor: string): Promise<ResourceContract[]> {
    const result = await contractRepository.list({ vendor, status: 'active' })
    return result.items
  }

  // ─── Stats ───

  async getStats(): Promise<{
    total: number
    byType: Record<string, number>
    byVendor: Record<string, number>
    active: number
    deprecated: number
  }> {
    const all = await contractRepository.list({ limit: 1000 })
    const byType: Record<string, number> = {}
    const byVendor: Record<string, number> = {}
    let active = 0
    let deprecated = 0

    for (const c of all.items) {
      byType[c.type] = (byType[c.type] || 0) + 1
      byVendor[c.vendor] = (byVendor[c.vendor] || 0) + 1
      if (c.status === 'active') active++
      if (c.status === 'deprecated') deprecated++
    }

    return {
      total: all.total,
      byType,
      byVendor,
      active,
      deprecated,
    }
  }
}

// Singleton
export const resourceRegistry = new ResourceRegistry()
