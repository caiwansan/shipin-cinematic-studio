// ============================================================
// Capability Provider — Cross-Workspace interface
// Provides a unified API for any workspace to interact with Capability Runtime
// ============================================================

import { capabilityService } from './capability.service'
import type {
  CapabilityContract,
  ResolverRequest,
  ResolverResponse,
  ValidationResult,
  CatalogSearchRequest,
  CatalogSearchResponse,
} from '../types/index'

/**
 * CapabilityProvider — used by any workspace that needs to
 * list capabilities, resolve to a provider, validate inputs/outputs, etc.
 */
export const capabilityProvider = {
  // ─── List Capabilities ───

  async listCapabilities(params?: {
    category?: string
    status?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<{ items: CapabilityContract[]; total: number }> {
    return capabilityService.listContracts(params)
  },

  // ─── Get Capability ───

  async getCapability(id: string): Promise<CapabilityContract | null> {
    return capabilityService.getContract(id)
  },

  async getCapabilityByName(name: string): Promise<CapabilityContract | null> {
    const result = await capabilityService.listContracts({ search: name, limit: 1 })
    return result.items.find(c => c.name === name) || null
  },

  // ─── Resolve ───

  async resolve(request: ResolverRequest): Promise<ResolverResponse | null> {
    return capabilityService.resolve(request)
  },

  // ─── Validate ───

  async validateInput(contractName: string, input: Record<string, unknown>): Promise<ValidationResult | null> {
    return capabilityService.validateInput(contractName, input)
  },

  async validateOutput(contractName: string, output: Record<string, unknown>): Promise<ValidationResult | null> {
    return capabilityService.validateOutput(contractName, output)
  },

  // ─── Search ───

  async search(request: CatalogSearchRequest): Promise<CatalogSearchResponse | null> {
    return capabilityService.search(request)
  },

  // ─── Categories ───

  async getCategories(): Promise<string[]> {
    return capabilityService.getCategories()
  },
}
