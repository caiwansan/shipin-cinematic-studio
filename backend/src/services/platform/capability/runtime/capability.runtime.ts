// ============================================================
// Capability Runtime — lifecycle management
// Lifecycle: RuntimeLifecycle (Init → Load → Validate → Execute → Update → Dispose)
// Events: Created, Updated, Deleted, Started, Completed, Failed (via PlatformEventBus)
// Runtime does NOT execute providers or care about models.
// ============================================================

import { PlatformContext, createContext } from '@platform/context/platform-context.js'
import type { RuntimeLifecycle } from '@platform/lifecycle/runtime-lifecycle.js'
import { IEventBus, platformEventBus } from '@platform/events/event-bus.js'
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
import { contractRepository } from '../repositories/contract.repository.js'
import { PlatformError, NotFoundError, ValidationError } from '@platform/errors/platform-errors.js'

export interface CapabilityInput {
  contractName?: string
  input?: Record<string, unknown>
  request?: ResolverRequest
  contract?: ContractBuilderInput
}

export interface CapabilityOutput {
  contract?: CapabilityContract | null
  validation?: ValidationResult
  resolution?: ResolverResponse
  registered?: CapabilityContract
  capabilities?: CapabilityContract[]
}

export class CapabilityRuntime implements RuntimeLifecycle<CapabilityInput, CapabilityOutput> {
  private initialized = false
  private eventBus: IEventBus

  constructor(eventBus: IEventBus = platformEventBus) {
    this.eventBus = eventBus
  }

  async init(ctx: PlatformContext, config?: Record<string, any>): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    console.log('[CapabilityRuntime] 🚀 Initializing...')

    try {
      await this.loadRegistry()
      console.log('[CapabilityRuntime] ✅ Registry loaded from database')
    } catch (err: any) {
      console.warn('[CapabilityRuntime] ⚠️ Could not load from database:', err.message)
    }

    console.log('[CapabilityRuntime] ✅ Runtime initialized')
  }

  async load(ctx: PlatformContext, id: string): Promise<CapabilityInput> {
    const contract = capabilityRegistry.getByName(id) || await contractRepository.findByName(id)
    if (!contract) throw new NotFoundError('Capability not found', { name: id })
    return { contractName: id }
  }

  async validate(ctx: PlatformContext, input: CapabilityInput): Promise<boolean> {
    if (input.contractName && input.input) {
      const contract = capabilityRegistry.getByName(input.contractName) ||
        await contractRepository.findByName(input.contractName)
      if (!contract) return false
      const result = capabilityValidator.validateInput(contract, input.input)
      return result.valid
    }
    if (input.contract) {
      return !!(input.contract.name && input.contract.displayName && input.contract.category)
    }
    return false
  }

  async execute(ctx: PlatformContext, input: CapabilityInput): Promise<CapabilityOutput> {
    if (input.request) {
      const result = await capabilityService.resolve(input.request)
      this.eventBus.emit({
        type: 'capability:Resolved',
        source: 'capability',
        timestamp: new Date().toISOString(),
        traceId: ctx.traceId,
        entityId: '',
        payload: { capabilityName: input.request.capabilityName, success: result.success },
      })
      return { resolution: result }
    }
    if (input.contract) {
      const registered = await capabilityService.register(input.contract)
      this.eventBus.emit({
        type: 'capability:Registered',
        source: 'capability',
        timestamp: new Date().toISOString(),
        traceId: ctx.traceId,
        entityId: registered.id,
        payload: { name: registered.name, version: registered.version },
      })
      return { registered }
    }
    throw new ValidationError('Invalid input: request or contract required')
  }

  async update(ctx: PlatformContext, id: string, data: Partial<CapabilityInput>): Promise<CapabilityOutput> {
    const contract = await capabilityService.update(id, data as any)
    if (contract) {
      this.eventBus.emit({
        type: 'capability:Updated',
        source: 'capability',
        timestamp: new Date().toISOString(),
        traceId: ctx.traceId,
        entityId: id,
        payload: { updates: Object.keys(data) },
      })
    }
    return { contract }
  }

  async dispose(ctx: PlatformContext): Promise<void> {
    this.initialized = false
    console.log('[CapabilityRuntime] Disposed')
  }

  // ─── Private ───

  private async loadRegistry(): Promise<void> {
    const contracts = await contractRepository.findAll({ status: 'active', limit: 10000 })
    for (const contract of contracts.items) {
      capabilityRegistry.register(contract, 'database')
    }
    console.log(`[CapabilityRuntime] 📦 Loaded ${contracts.total} active contracts into registry`)
  }

  // ─── Legacy Methods (maintain backward compat) ───

  async initialize(): Promise<void> {
    return this.init(createContext())
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
    // Legacy method - no-op with platform event bus
  }

  /**
   * Return result event (for observability)
   */
  returnResult(response: ResolverResponse): void {
    // Legacy method - no-op with platform event bus
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
