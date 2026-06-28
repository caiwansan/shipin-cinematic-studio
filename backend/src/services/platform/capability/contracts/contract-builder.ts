// ============================================================
// Contract Builder — create and build capability contracts
// ============================================================

import type { CapabilityContract, ContractBuilderInput } from '../types.js'
import { CapabilityCategory, ContractStatus } from '../types.js'

export class ContractBuilder {
  private contract: Partial<CapabilityContract> = {}

  constructor() {
    this.reset()
  }

  reset(): ContractBuilder {
    this.contract = {
      schemaVersion: 1,
      status: 'active' as ContractStatus,
      version: '1.0.0',
    }
    return this
  }

  fromInput(input: ContractBuilderInput): ContractBuilder {
    this.reset()
    this.contract.name = input.name
    this.contract.displayName = input.displayName
    this.contract.description = input.description || null
    this.contract.category = input.category
    this.contract.version = input.version || '1.0.0'
    this.contract.inputSchema = input.inputSchema ? JSON.stringify(input.inputSchema) : null
    this.contract.outputSchema = input.outputSchema ? JSON.stringify(input.outputSchema) : null
    this.contract.constraints = input.constraints ? JSON.stringify(input.constraints) : null
    this.contract.qualityProfile = input.qualityProfile ? JSON.stringify(input.qualityProfile) : null
    this.contract.permissionProfile = input.permissionProfile ? JSON.stringify(input.permissionProfile) : null
    this.contract.tags = input.tags ? JSON.stringify(input.tags) : null
    this.contract.metadata = input.metadata ? JSON.stringify(input.metadata) : null
    return this
  }

  withCategory(category: CapabilityCategory | string): ContractBuilder {
    this.contract.category = category
    return this
  }

  withVersion(version: string): ContractBuilder {
    this.contract.version = version
    return this
  }

  withInputSchema(schema: object): ContractBuilder {
    this.contract.inputSchema = JSON.stringify(schema)
    return this
  }

  withOutputSchema(schema: object): ContractBuilder {
    this.contract.outputSchema = JSON.stringify(schema)
    return this
  }

  withConstraints(constraints: Record<string, unknown>): ContractBuilder {
    this.contract.constraints = JSON.stringify(constraints)
    return this
  }

  withQualityProfile(profile: Record<string, unknown>): ContractBuilder {
    this.contract.qualityProfile = JSON.stringify(profile)
    return this
  }

  withPermissionProfile(profile: Record<string, unknown>): ContractBuilder {
    this.contract.permissionProfile = JSON.stringify(profile)
    return this
  }

  withTags(tags: string[]): ContractBuilder {
    this.contract.tags = JSON.stringify(tags)
    return this
  }

  withMetadata(metadata: Record<string, unknown>): ContractBuilder {
    this.contract.metadata = JSON.stringify(metadata)
    return this
  }

  withSchemaVersion(schemaVersion: number): ContractBuilder {
    this.contract.schemaVersion = schemaVersion
    return this
  }

  /**
   * Build the contract object (without id/createdAt/updatedAt — added by repository)
   */
  build(): Partial<CapabilityContract> {
    if (!this.contract.name) throw new Error('Contract name is required')
    if (!this.contract.displayName) throw new Error('Contract displayName is required')
    if (!this.contract.category) throw new Error('Contract category is required')

    return { ...this.contract }
  }
}

/**
 * Create a contract from a builder input
 */
export function createContract(input: ContractBuilderInput): Partial<CapabilityContract> {
  return new ContractBuilder().fromInput(input).build()
}
