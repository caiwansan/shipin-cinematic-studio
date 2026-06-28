// ============================================================
// Capability Runtime — lifecycle management
// Method: loadRegistry, validateContract, resolve, emitRequest, returnResult
// Runtime does NOT execute providers or care about models.
// ============================================================

import type {
  CapabilityContract,
  ContractBuilderInput,
  ValidationResult,
  ResolverRequest,
  ResolverResponse,
} from '../types.js'
import { capabilityRegistry } from '../registry/capability-registry.js'
import { capabilityService } from '../capability.service.js'
import { capabilityValidator } from '../validators/capability-validator.js'
import { capabilityResolver } from '../resolver/capability-resolver.js'
import { capabilityEventBus } from '../events/capability-events.js'
import { contractRepository } from '../repositories/contract.repository.js'

export class CapabilityRuntime {
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    console.log('[CapabilityRuntime] 🚀 Initializing...')

    try {
      // Load all active contracts from database into registry
      await this.loadRegistry()
      console.log('[CapabilityRuntime] ✅ Registry loaded from database')
    } catch (err: any) {
      console.warn('[CapabilityRuntime] ⚠️ Could not load from database:', err.message)
    }

    console.log('[CapabilityRuntime] ✅ Runtime initialized')
  }

  /**
   * Load contracts from database into in-memory registry
   */
  async loadRegistry(): Promise<void> {
    const contracts = await contractRepository.findAll({ status: 'active', limit: 10000 })
    for (const contract of contracts.items) {
      capabilityRegistry.register(contract, 'database')
    }
    console.log(`[CapabilityRuntime] 📦 Loaded ${contracts.total} active contracts into registry`)
  }

  /**
   * Validate input against a contract
   */
  async validateContract(
    contractName: string,
    input: Record<string, unknown>,
  ): Promise<ValidationResult> {
    const contract = capabilityRegistry.getByName(contractName) ||
      await contractRepository.findByName(contractName)

    if (!contract) {
      return {
        valid: false,
        errors: [{ field: 'contract', code: 'NOT_FOUND', message: `Contract '${contractName}' not found` }],
        warnings: [],
        validatedAt: new Date().toISOString(),
      }
    }

    const result = capabilityValidator.validateInput(contract, input)

    capabilityEventBus.emit({
      type: 'Validated',
      capabilityId: contract.id,
      capabilityName: contract.name,
      timestamp: new Date().toISOString(),
      payload: { valid: result.valid, errorCount: result.errors.length },
    })

    return result
  }

  /**
   * Resolve a capability to a provider
   */
  async resolve(request: ResolverRequest): Promise<ResolverResponse> {
    return capabilityService.resolve(request)
  }

  /**
   * Emit a request event (for observability)
   */
  emitRequest(request: ResolverRequest): void {
    capabilityEventBus.emit({
      type: 'Resolved' as any,
      capabilityId: '',
      capabilityName: request.capabilityName,
      timestamp: new Date().toISOString(),
      payload: { request, phase: 'request' },
    })
  }

  /**
   * Return result event (for observability)
   */
  returnResult(response: ResolverResponse): void {
    capabilityEventBus.emit({
      type: 'Resolved' as any,
      capabilityId: '',
      capabilityName: response.capability,
      timestamp: new Date().toISOString(),
      payload: { response, phase: 'result' },
    })
  }

  /**
   * Register a new capability (via service)
   */
  async register(input: ContractBuilderInput): Promise<CapabilityContract> {
    return capabilityService.register(input)
  }

  /**
   * Get a capability by name
   */
  async getCapability(name: string): Promise<CapabilityContract | null> {
    return capabilityRegistry.getByName(name) || contractRepository.findByName(name)
  }

  /**
   * List all capabilities in registry
   */
  listCapabilities(): CapabilityContract[] {
    return capabilityRegistry.list()
  }

  /**
   * Check if runtime is ready
   */
  isReady(): boolean {
    return this.initialized
  }

  /**
   * Reload registry from database
   */
  async reload(): Promise<void> {
    capabilityRegistry.clear()
    await this.loadRegistry()
    console.log('[CapabilityRuntime] 🔄 Registry reloaded')
  }
}

// Singleton
export const capabilityRuntime = new CapabilityRuntime()
