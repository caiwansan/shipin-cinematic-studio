// ============================================================
// Capability Resolver — core resolver
// Matches a contract request to a provider mapping
// ============================================================

import type {
  CapabilityContract,
  ResolverRequest,
  ResolverResponse,
  RoutingStrategyType,
} from '../types.js'
import type { RoutingStrategy, ResolverPlugin, ResolverConfig } from './resolver-interface.js'
import type { ProviderMappingRecord } from '../repositories/mapping.repository.js'
import { capabilityRegistry } from '../registry/capability-registry.js'
import { mappingRepository } from '../repositories/mapping.repository.js'

export class CapabilityResolver {
  private strategies: Map<RoutingStrategyType, RoutingStrategy> = new Map()
  private plugins: ResolverPlugin[] = []
  private config: ResolverConfig = {
    defaultStrategy: 'Balanced' as RoutingStrategyType,
    allowedStrategies: ['QualityFirst', 'CostFirst', 'LatencyFirst', 'Balanced', 'Custom'] as RoutingStrategyType[],
    enableAudit: false,
    maxResolveTimeMs: 10000,
  }

  // ─── Strategy Management ───

  registerStrategy(strategy: RoutingStrategy): void {
    this.strategies.set(strategy.name, strategy)
    console.log(`[CapabilityResolver] ✅ Strategy registered: ${strategy.name}`)
  }

  getStrategy(name: RoutingStrategyType): RoutingStrategy | undefined {
    return this.strategies.get(name)
  }

  listStrategies(): RoutingStrategyType[] {
    return Array.from(this.strategies.keys())
  }

  // ─── Plugin Management ───

  registerPlugin(plugin: ResolverPlugin): void {
    this.plugins.push(plugin)
    console.log(`[CapabilityResolver] ✅ Plugin registered: ${plugin.name}`)
  }

  // ─── Config ───

  updateConfig(config: Partial<ResolverConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): ResolverConfig {
    return { ...this.config }
  }

  // ─── Core Resolve ───

  async resolve(request: ResolverRequest): Promise<ResolverResponse> {
    const startTime = Date.now()

    try {
      // 1. Find contract
      const contract = capabilityRegistry.getByName(request.capabilityName)
      if (!contract) {
        return {
          success: false,
          provider: '',
          capability: request.capabilityName,
          version: '',
          result: null,
          error: `Capability '${request.capabilityName}' not found in registry`,
          validationResult: null,
          metrics: { resolveTimeMs: Date.now() - startTime, strategyUsed: this.config.defaultStrategy },
        }
      }

      // 2. Check version if specified
      if (request.capabilityVersion && contract.version !== request.capabilityVersion) {
        return {
          success: false,
          provider: '',
          capability: request.capabilityName,
          version: contract.version,
          result: null,
          error: `Version mismatch: requested ${request.capabilityVersion}, available ${contract.version}`,
          validationResult: null,
          metrics: { resolveTimeMs: Date.now() - startTime, strategyUsed: this.config.defaultStrategy },
        }
      }

      // 3. Check contract status
      if (contract.status === 'removed') {
        return {
          success: false,
          provider: '',
          capability: request.capabilityName,
          version: contract.version,
          result: null,
          error: `Capability '${request.capabilityName}' has been removed`,
          validationResult: null,
          metrics: { resolveTimeMs: Date.now() - startTime, strategyUsed: this.config.defaultStrategy },
        }
      }

      // 4. Apply before-resolve plugins
      let resolvedRequest = { ...request }
      for (const plugin of this.plugins) {
        if (plugin.onBeforeResolve) {
          resolvedRequest = await plugin.onBeforeResolve(resolvedRequest, contract)
        }
      }

      // 5. Find provider mappings
      const mappings = await this.getMappings(contract.id)
      if (mappings.length === 0) {
        return {
          success: false,
          provider: '',
          capability: request.capabilityName,
          version: contract.version,
          result: null,
          error: `No provider mappings found for '${request.capabilityName}'`,
          validationResult: null,
          metrics: { resolveTimeMs: Date.now() - startTime, strategyUsed: this.config.defaultStrategy },
        }
      }

      // 6. Select strategy
      const strategyName = request.context?.priority !== undefined
        ? 'QualityFirst' as RoutingStrategyType
        : this.config.defaultStrategy

      const strategy = this.strategies.get(strategyName)
      if (!strategy) {
        return {
          success: false,
          provider: '',
          capability: request.capabilityName,
          version: contract.version,
          result: null,
          error: `Strategy '${strategyName}' not registered`,
          validationResult: null,
          metrics: { resolveTimeMs: Date.now() - startTime, strategyUsed: this.config.defaultStrategy },
        }
      }

      // 7. Run strategy selection
      const { selected, reason } = await strategy.select(contract, mappings, resolvedRequest)
      if (!selected) {
        return {
          success: false,
          provider: '',
          capability: request.capabilityName,
          version: contract.version,
          result: null,
          error: `No provider selected: ${reason}`,
          validationResult: null,
          metrics: { resolveTimeMs: Date.now() - startTime, strategyUsed: strategyName },
        }
      }

      // 8. Prepare response (provider execution happens at a higher layer)
      const response: ResolverResponse = {
        success: true,
        provider: selected.provider,
        capability: request.capabilityName,
        version: contract.version,
        result: null, // Provider runtime fills this in
        error: null,
        validationResult: null,
        metrics: {
          resolveTimeMs: Date.now() - startTime,
          strategyUsed: strategyName,
        },
      }

      // 9. Apply after-resolve plugins
      let finalResponse = { ...response }
      for (const plugin of this.plugins) {
        if (plugin.onAfterResolve) {
          finalResponse = await plugin.onAfterResolve(resolvedRequest, finalResponse)
        }
      }

      return finalResponse
    } catch (err: any) {
      return {
        success: false,
        provider: '',
        capability: request.capabilityName,
        version: '',
        result: null,
        error: `Resolve error: ${err.message}`,
        validationResult: null,
        metrics: { resolveTimeMs: Date.now() - startTime, strategyUsed: this.config.defaultStrategy },
      }
    }
  }

  private async getMappings(capabilityId: string): Promise<ProviderMappingRecord[]> {
    try {
      return await mappingRepository.findActiveByCapabilityId(capabilityId)
    } catch {
      return []
    }
  }
}

// Singleton
export const capabilityResolver = new CapabilityResolver()
