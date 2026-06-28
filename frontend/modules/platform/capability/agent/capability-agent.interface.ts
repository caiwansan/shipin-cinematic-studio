// ============================================================
// Capability Agent Interface — AI/Agent facing API
// Functions: ResolveCapability, ValidateCapability, DiscoverCapability
// ============================================================

import { capabilityService } from '../services/capability.service'
import type {
  CapabilityContract,
  ResolverRequest,
  ResolverResponse,
  ValidationResult,
  CatalogSearchRequest,
} from '../types/index'

/**
 * CapabilityAgentInterface — used by AI agents to interact with Capability Platform
 */
export const capabilityAgentInterface = {
  /**
   * Resolve a capability to a provider
   * @param request - The resolve request including capability name, input, and context
   * @returns ResolverResponse with provider and routing info
   */
  async ResolveCapability(request: ResolverRequest): Promise<ResolverResponse | null> {
    return capabilityService.resolve(request)
  },

  /**
   * Validate input/output against a capability contract
   * @param contractName - Name of the capability contract
   * @param data - Input, output, constraints, and permissions to validate
   * @returns Validation result
   */
  async ValidateCapability(
    contractName: string,
    data: {
      input?: Record<string, unknown>
      output?: Record<string, unknown>
      constraints?: Record<string, unknown>
      permissions?: Record<string, unknown>
    },
  ): Promise<{ valid: boolean; results: Record<string, ValidationResult> } | null> {
    return capabilityService.validate(contractName, data)
  },

  /**
   * Discover capabilities by search criteria
   * @param request - Search request with query, category, tags, etc.
   * @returns Matching capabilities
   */
  async DiscoverCapability(request: CatalogSearchRequest): Promise<CapabilityContract[]> {
    const result = await capabilityService.search(request)
    return result?.items || []
  },

  /**
   * Get all available categories
   * @returns List of category names
   */
  async GetCategories(): Promise<string[]> {
    return capabilityService.getCategories()
  },

  /**
   * Quick search for a capability by name or keyword
   * @param query - Search query
   * @returns Matching capabilities
   */
  async QuickSearch(query: string): Promise<CapabilityContract[]> {
    return capabilityService.quickSearch(query)
  },
}
