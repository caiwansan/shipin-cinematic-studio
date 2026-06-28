// ============================================================
// Resolver Interface — contract between Resolver and Routing Strategies
// ============================================================

import type {
  CapabilityContract,
  ResolverRequest,
  ResolverResponse,
  RoutingStrategyType,
  ValidationResult,
} from '../types.js'
import type { ProviderMappingRecord } from '../repositories/mapping.repository.js'

/**
 * RoutingStrategy — selects a provider from available mappings
 */
export interface RoutingStrategy {
  name: RoutingStrategyType
  description: string

  /**
   * Select a provider from available mappings
   */
  select(
    contract: CapabilityContract,
    mappings: ProviderMappingRecord[],
    request: ResolverRequest,
  ): Promise<{ selected: ProviderMappingRecord | null; reason: string }>
}

/**
 * ResolverPlugin — hook into resolve lifecycle
 */
export interface ResolverPlugin {
  name: string
  onBeforeResolve?: (request: ResolverRequest, contract: CapabilityContract) => Promise<ResolverRequest>
  onAfterResolve?: (request: ResolverRequest, response: ResolverResponse) => Promise<ResolverResponse>
}

/**
 * ResolverConfig — configuration for the resolver
 */
export interface ResolverConfig {
  defaultStrategy: RoutingStrategyType
  allowedStrategies: RoutingStrategyType[]
  enableAudit: boolean
  maxResolveTimeMs: number
}
