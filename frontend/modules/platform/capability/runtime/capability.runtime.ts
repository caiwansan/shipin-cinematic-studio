// ============================================================
// Capability Runtime — Frontend runtime abstraction
// ============================================================

import { capabilityService } from '../services/capability.service'
import type {
  CapabilityContract,
  ResolverRequest,
  ResolverResponse,
  ValidationResult,
  CatalogSearchRequest,
  CatalogSearchResponse,
  CapabilityStats,
  CapabilityHealth,
} from '../types/index'

export interface CapabilityRuntimeEvents {
  onContractRegistered?: (contract: CapabilityContract) => void
  onContractUpdated?: (contract: CapabilityContract) => void
  onContractDeprecated?: (contract: CapabilityContract) => void
  onContractRemoved?: (id: string) => void
  onResolved?: (response: ResolverResponse) => void
  onValidated?: (result: ValidationResult) => void
}

export function createCapabilityRuntime() {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {
    contractRegistered: [],
    contractUpdated: [],
    contractDeprecated: [],
    contractRemoved: [],
    resolved: [],
    validated: [],
  }

  return {
    on(event: string, handler: (...args: any[]) => void) {
      if (listeners[event]) listeners[event].push(handler)
    },

    // ─── Contracts ───

    async listContracts(params?: {
      category?: string
      status?: string
      search?: string
      limit?: number
      offset?: number
    }) {
      return capabilityService.listContracts(params)
    },

    async getContract(id: string) {
      return capabilityService.getContract(id)
    },

    async registerContract(data: {
      name: string
      displayName: string
      description?: string
      category: string
    }) {
      const contract = await capabilityService.registerCapability(data)
      if (contract) {
        for (const fn of listeners.contractRegistered) fn(contract)
      }
      return contract
    },

    async deprecateContract(id: string) {
      const contract = await capabilityService.deprecateCapability(id)
      if (contract) {
        for (const fn of listeners.contractDeprecated) fn(contract)
      }
      return contract
    },

    // ─── Resolver ───

    async resolve(request: ResolverRequest) {
      const response = await capabilityService.resolve(request)
      if (response) {
        for (const fn of listeners.resolved) fn(response)
      }
      return response
    },

    // ─── Validator ───

    async validateInput(contractName: string, input: Record<string, unknown>) {
      const result = await capabilityService.validateInput(contractName, input)
      if (result) {
        for (const fn of listeners.validated) fn(result)
      }
      return result
    },

    // ─── Catalog ───

    async search(request: CatalogSearchRequest) {
      return capabilityService.search(request)
    },

    async getCategories() {
      return capabilityService.getCategories()
    },

    async browseByCategory(category: string) {
      return capabilityService.browseByCategory(category)
    },

    // ─── Stats ───

    async getStats() {
      return capabilityService.getStats()
    },

    // ─── Health ───

    async getHealth() {
      return capabilityService.getHealth()
    },
  }
}
