// ============================================================
// Capability Service — business logic orchestration
// ============================================================

import type {
  CapabilityContract,
  ContractBuilderInput,
  ValidationResult,
  ResolverRequest,
  ResolverResponse,
} from './types.js'
import { capabilityRegistry } from './registry/capability-registry.js'
import { contractRepository } from './repositories/contract.repository.js'
import { mappingRepository } from './repositories/mapping.repository.js'
import { capabilityValidator } from './validators/capability-validator.js'
import { capabilityResolver } from './resolver/capability-resolver.js'
import { capabilityEventBus } from './events/capability-events.js'
import { ContractBuilder } from './contracts/contract-builder.js'
import { contractValidator } from './contracts/contract-validator.js'

export class CapabilityService {
  // ─── Register ───

  async register(input: ContractBuilderInput): Promise<CapabilityContract> {
    // 1. Build contract
    const contractData = new ContractBuilder().fromInput(input).build()

    // 2. Validate contract
    const validation = contractValidator.validate(contractData)
    if (!validation.valid) {
      throw new Error(`Contract validation failed: ${validation.errors.map(e => e.message).join('; ')}`)
    }

    // 3. Persist to database
    const contract = await contractRepository.create(contractData)

    // 4. Register in-memory registry
    capabilityRegistry.register(contract, 'database')

    // 5. Emit event
    capabilityEventBus.emit({
      type: 'Registered',
      capabilityId: contract.id,
      capabilityName: contract.name,
      timestamp: new Date().toISOString(),
      payload: { contract },
    })

    return contract
  }

  // ─── Update ───

  async update(id: string, updates: Partial<CapabilityContract>): Promise<CapabilityContract | null> {
    const contract = await contractRepository.update(id, updates)
    if (contract) {
      capabilityRegistry.update(id, updates)
      capabilityEventBus.emit({
        type: 'Updated',
        capabilityId: contract.id,
        capabilityName: contract.name,
        timestamp: new Date().toISOString(),
        payload: { updates },
      })
    }
    return contract
  }

  // ─── Deprecate ───

  async deprecate(id: string): Promise<CapabilityContract | null> {
    const contract = await contractRepository.update(id, { status: 'deprecated' } as any)
    if (contract) {
      capabilityRegistry.update(id, { status: 'deprecated' } as any)
      capabilityEventBus.emit({
        type: 'Deprecated',
        capabilityId: contract.id,
        capabilityName: contract.name,
        timestamp: new Date().toISOString(),
      })
    }
    return contract
  }

  // ─── Remove ───

  async remove(id: string): Promise<boolean> {
    const contract = await contractRepository.findById(id)
    if (!contract) return false

    await mappingRepository.deleteByCapabilityId(id)
    await contractRepository.delete(id)
    capabilityRegistry.remove(id)

    capabilityEventBus.emit({
      type: 'Removed',
      capabilityId: id,
      capabilityName: contract.name,
      timestamp: new Date().toISOString(),
    })

    return true
  }

  // ─── Get ───

  async get(id: string): Promise<CapabilityContract | null> {
    return contractRepository.findById(id)
  }

  async getByName(name: string): Promise<CapabilityContract | null> {
    return contractRepository.findByName(name)
  }

  // ─── Validate ───

  validate(contract: CapabilityContract, input: Record<string, unknown>): ValidationResult {
    return capabilityValidator.validateInput(contract, input)
  }

  // ─── Resolve ───

  async resolve(request: ResolverRequest): Promise<ResolverResponse> {
    const result = await capabilityResolver.resolve(request)

    capabilityEventBus.emit({
      type: 'Resolved',
      capabilityId: '',
      capabilityName: request.capabilityName,
      timestamp: new Date().toISOString(),
      payload: { request, result: { success: result.success, provider: result.provider } },
    })

    return result
  }

  // ─── Search ───

  async search(filter?: {
    category?: string
    status?: string
    search?: string
    tags?: string[]
    limit?: number
    offset?: number
  }): Promise<{ items: CapabilityContract[]; total: number }> {
    return contractRepository.findAll(filter)
  }

  // ─── List Categories ───

  async getCategories(): Promise<string[]> {
    return contractRepository.getCategories()
  }

  // ─── Stats ───

  async getStats(): Promise<{
    totalContracts: number
    activeContracts: number
    deprecatedContracts: number
    categoriesCount: number
    categories: { category: string; count: number }[]
  }> {
    const allContracts = await contractRepository.findAll({ limit: 10000 })
    const activeCount = allContracts.items.filter(c => c.status === 'active').length
    const deprecatedCount = allContracts.items.filter(c => c.status === 'deprecated').length

    const categoryMap = new Map<string, number>()
    for (const c of allContracts.items) {
      categoryMap.set(c.category, (categoryMap.get(c.category) || 0) + 1)
    }
    const categories = Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }))

    return {
      totalContracts: allContracts.total,
      activeContracts: activeCount,
      deprecatedContracts: deprecatedCount,
      categoriesCount: categories.length,
      categories,
    }
  }

  // ─── Provider Mapping ───

  async addProviderMapping(data: {
    capabilityId: string
    provider: string
    priority?: number
    config?: Record<string, unknown>
  }) {
    return mappingRepository.create(data)
  }

  async removeProviderMapping(id: string) {
    return mappingRepository.delete(id)
  }

  async getProviderMappings(capabilityId: string) {
    return mappingRepository.findByCapabilityId(capabilityId)
  }
}

export const capabilityService = new CapabilityService()
