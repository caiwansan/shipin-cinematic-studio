// ============================================================
// Resource Runtime — lifecycle management
// KMKI-PLAT-008
// ARCH-002: Init → Load → Validate → Execute → Update → Dispose
// ============================================================

import type { PlatformContext } from '@platform/context/platform-context'
import type { RuntimeLifecycle } from '@platform/lifecycle/runtime-lifecycle'
import { PlatformError } from '@platform/errors/platform-errors'
import { platformEventBus } from '@platform/events/event-bus'
import { resourceService } from '../resource.service'
import { resourceRegistry } from '../registry/resource-registry'
import { healthChecker } from '../health/health-checker'
import { resourceResolver } from '../resolver/resource-resolver'
import { qualityFirstStrategy } from '../resolver/strategies/quality-first'
import { costFirstStrategy } from '../resolver/strategies/cost-first'
import { latencyFirstStrategy } from '../resolver/strategies/latency-first'
import { balancedStrategy } from '../resolver/strategies/balanced'
import type { ResolveRequest, ResolveResponse } from '../types'

interface ResourceRuntimeInput {
  capabilityName: string
  strategy?: string
  tenantId: string
  workspaceId?: string
  options?: ResolveRequest['options']
}

export class ResourceRuntime implements RuntimeLifecycle<ResourceRuntimeInput, ResolveResponse> {
  private initialized = false
  private name = 'ResourceRuntime'

  async init(ctx: PlatformContext, config?: Record<string, any>): Promise<void> {
    if (this.initialized) return
    console.log(`[${this.name}] Initializing...`)

    // Register resolver strategies
    resourceResolver.registerStrategy(qualityFirstStrategy)
    resourceResolver.registerStrategy(costFirstStrategy)
    resourceResolver.registerStrategy(latencyFirstStrategy)
    resourceResolver.registerStrategy(balancedStrategy)
    console.log(`[${this.name}] Registered 4 resolver strategies`)

    // Start health checker
    healthChecker.start({
      intervalMs: config?.healthCheckIntervalMs || 5 * 60 * 1000,
      concurrency: config?.healthCheckConcurrency || 5,
    })

    this.initialized = true
    console.log(`[${this.name}] ✅ Initialized`)
  }

  async load(ctx: PlatformContext, id: string): Promise<ResourceRuntimeInput> {
    // Load a resolve request by some identifier
    throw new PlatformError('NOT_IMPLEMENTED', 'load() not implemented — use execute() directly')
  }

  async validate(ctx: PlatformContext, input: ResourceRuntimeInput): Promise<boolean> {
    if (!input.capabilityName) {
      throw new PlatformError('VALIDATION_ERROR', 'capabilityName is required')
    }
    if (!input.tenantId) {
      throw new PlatformError('VALIDATION_ERROR', 'tenantId is required')
    }
    return true
  }

  async execute(ctx: PlatformContext, input: ResourceRuntimeInput): Promise<ResolveResponse> {
    if (!this.initialized) {
      throw new PlatformError('RUNTIME_ERROR', `${this.name} not initialized. Call init() first.`)
    }

    const request: ResolveRequest = {
      capabilityName: input.capabilityName,
      strategy: input.strategy || 'balanced',
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      context: ctx,
      options: input.options,
    }

    const response = await resourceResolver.resolve(request)

    // Emit event
    platformEventBus.emit({
      type: 'capability:Resolved',
      source: this.name,
      timestamp: new Date().toISOString(),
      context: ctx,
      payload: {
        capabilityName: request.capabilityName,
        strategy: request.strategy,
        resourceId: response.resource.id,
        resourceName: response.resource.name,
        resolveTimeMs: response.resolveTimeMs,
      },
    })

    return response
  }

  async update(ctx: PlatformContext, id: string, data: Partial<ResourceRuntimeInput>): Promise<ResolveResponse> {
    throw new PlatformError('NOT_IMPLEMENTED', 'update() not implemented for ResourceRuntime')
  }

  async dispose(ctx: PlatformContext): Promise<void> {
    healthChecker.stop()
    this.initialized = false
    console.log(`[${this.name}] Disposed`)
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

// Singleton
export const resourceRuntime = new ResourceRuntime()
