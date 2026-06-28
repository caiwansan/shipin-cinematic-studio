// ============================================================
// Resource Service — business orchestration
// KMKI-PLAT-008
// ============================================================

import type { ResourceContract, ResolveRequest, ResolveResponse, ResourceCredential, ResourceHealth, ResourceUsage } from './types'
import { resourceRegistry } from './registry/resource-registry'
import { resourceResolver } from './resolver/resource-resolver'
import { credentialVault } from './vault/credential-vault'
import { resourceHealth } from './health/resource-health'
import { costRuntime } from './cost/cost-runtime'
import { costEstimator, type CostEstimate } from './cost/cost-estimator'
import { capabilityMatrix } from './matrix/capability-matrix'
import { matrixValidator } from './matrix/matrix-validator'
import { PlatformError } from '@platform/errors/platform-errors'

export const resourceService = {
  // ─── Resource Registry ───

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
    return resourceRegistry.registerContract(data)
  },

  async getContract(id: string): Promise<ResourceContract | null> {
    return resourceRegistry.getContract(id)
  },

  async getContractByName(name: string): Promise<ResourceContract | null> {
    return resourceRegistry.getContractByName(name)
  },

  async listContracts(params?: {
    type?: string
    vendor?: string
    status?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<{ items: ResourceContract[]; total: number }> {
    return resourceRegistry.listContracts(params)
  },

  async updateContract(id: string, data: Partial<ResourceContract>): Promise<ResourceContract> {
    return resourceRegistry.updateContract(id, data)
  },

  async deprecateContract(id: string): Promise<ResourceContract> {
    return resourceRegistry.deprecateContract(id)
  },

  async deleteContract(id: string): Promise<void> {
    return resourceRegistry.deleteContract(id)
  },

  async getRegistryStats(): Promise<{
    total: number
    byType: Record<string, number>
    byVendor: Record<string, number>
    active: number
    deprecated: number
  }> {
    return resourceRegistry.getStats()
  },

  // ─── Credential ───

  async storeCredential(data: {
    resourceId: string
    tenantId: string
    workspaceId?: string
    name: string
    apiKey: string
    endpoint?: string
    models?: string
    expiresAt?: Date
  }): Promise<ResourceCredential> {
    return credentialVault.store(data)
  },

  async listCredentials(tenantId: string, resourceId?: string): Promise<ResourceCredential[]> {
    const { credentialRepository } = await import('./repositories/credential.repository')
    return credentialRepository.listByTenant(tenantId, { resourceId })
  },

  async deleteCredential(id: string): Promise<void> {
    const { credentialRepository } = await import('./repositories/credential.repository')
    await credentialRepository.delete(id)
  },

  async rotateCredential(credentialId: string, newApiKey: string): Promise<ResourceCredential> {
    return credentialVault.rotate(credentialId, newApiKey)
  },

  // ─── Resolver ───

  async resolve(request: ResolveRequest): Promise<ResolveResponse> {
    return resourceResolver.resolve(request)
  },

  async hasResolvable(capabilityName: string, tenantId: string): Promise<boolean> {
    return resourceResolver.hasResolvable(capabilityName, tenantId)
  },

  listResolverStrategies(): Array<{ name: string; description: string }> {
    return resourceResolver.listStrategies()
  },

  // ─── Health ───

  async checkHealth(resourceId: string): Promise<ResourceHealth | null> {
    const resource = await resourceRegistry.getContract(resourceId)
    if (!resource) return null
    return resourceHealth.check(resource)
  },

  async getResourceHealth(resourceId: string): Promise<ResourceHealth | null> {
    return resourceHealth.getLatest(resourceId)
  },

  async getHealthOverview(): Promise<Record<string, number>> {
    return resourceHealth.getAggregated()
  },

  // ─── Matrix ───

  async mapCapability(data: {
    resourceId: string
    capabilityId: string
    supported: boolean
    qualityScore?: number
    costMultiplier?: number
  }) {
    return capabilityMatrix.map(data)
  },

  async batchMapCapabilities(resourceId: string, mappings: Array<{
    capabilityId: string
    supported: boolean
    qualityScore?: number
    costMultiplier?: number
  }>) {
    return capabilityMatrix.batchMap(resourceId, mappings)
  },

  async getResourceCapabilities(resourceId: string) {
    return capabilityMatrix.getResourceCapabilities(resourceId)
  },

  async getCapabilityResources(capabilityId: string) {
    return capabilityMatrix.getCapabilityResources(capabilityId)
  },

  async getCapabilityResourceMap() {
    return capabilityMatrix.getCapabilityResourceMap()
  },

  async unmapCapability(resourceId: string, capabilityId: string) {
    return capabilityMatrix.unmap(resourceId, capabilityId)
  },

  async validateMatrix() {
    return matrixValidator.validateAll()
  },

  // ─── Cost ───

  async recordUsage(data: Omit<ResourceUsage, 'id' | 'createdAt'>): Promise<ResourceUsage> {
    return costRuntime.recordUsage(data)
  },

  async getUsageHistory(tenantId: string, params?: {
    resourceType?: string
    status?: string
    limit?: number
    offset?: number
    startDate?: Date
    endDate?: Date
  }) {
    return costRuntime.getUsageHistory(tenantId, params)
  },

  async aggregateUsage(tenantId: string, startDate: Date, endDate: Date) {
    return costRuntime.aggregateUsage(tenantId, startDate, endDate)
  },

  async getCosts(tenantId: string, params?: {
    workspaceId?: string
    billingPeriod?: string
    limit?: number
    offset?: number
  }) {
    return costRuntime.getCosts(tenantId, params)
  },

  async getTotalCost(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
    return costRuntime.getTotalCost(tenantId, startDate, endDate)
  },

  async estimateCost(resourceId: string, input: { promptLength?: number; expectedOutputLength?: number }) {
    const resource = await resourceRegistry.getContract(resourceId)
    if (!resource) throw new PlatformError('RESOURCE_NOT_FOUND', `Resource ${resourceId} not found`)
    return costEstimator.estimate(resource, input)
  },
}
