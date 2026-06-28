// ============================================================
// Governance Runtime — KMKI-PLAT-012
// ARCH-002: Init → Load → Validate → Execute → Update → Dispose
// ============================================================

import type { PlatformContext } from '@platform/context/platform-context.js'
import type { RuntimeLifecycle } from '@platform/lifecycle/runtime-lifecycle.js'
import { platformEventBus } from '@platform/events/event-bus.js'
import { governanceService } from '../governance.service.js'

interface GovernanceInput {
  action: string
  tenantId: string
  payload?: Record<string, any>
}

interface GovernanceOutput {
  success: boolean
  data?: any
  error?: string
}

export class GovernanceRuntime implements RuntimeLifecycle<GovernanceInput, GovernanceOutput> {
  private initialized = false
  private name = 'GovernanceRuntime'

  async init(ctx: PlatformContext, config?: Record<string, any>): Promise<void> {
    if (this.initialized) return
    console.log(`[${this.name}] Initializing...`)
    this.initialized = true
    console.log(`[${this.name}] ✅ Initialized`)
  }

  async load(ctx: PlatformContext, id: string): Promise<GovernanceInput> {
    return { action: 'load', tenantId: id }
  }

  async validate(ctx: PlatformContext, input: GovernanceInput): Promise<boolean> {
    if (!input.tenantId) return false
    return true
  }

  async execute(ctx: PlatformContext, input: GovernanceInput): Promise<GovernanceOutput> {
    try {
      const { action, tenantId, payload } = input
      let result: any

      switch (action) {
        case 'authorize':
          result = await governanceService.auth.authorize(tenantId, payload?.capability, ctx.userId)
          break
        case 'consumeQuota':
          result = await governanceService.quota.consumeQuota(
            tenantId, payload?.resourceType, payload?.amount, payload?.source, payload?.sourceId
          )
          break
        case 'checkQuota':
          result = await governanceService.quota.checkQuota(tenantId, payload?.resourceType, payload?.amount)
          break
        case 'checkPolicies':
          result = await governanceService.policy.checkAll(tenantId, payload?.context || {})
          break
        case 'logAudit':
          result = await governanceService.audit.log(
            payload?.action, tenantId, payload?.resource, payload?.resourceId, payload?.details, ctx.userId
          )
          break
        case 'recordBilling':
          result = await governanceService.billing.recordBilling({
            tenantId: payload?.tenantId || tenantId,
            type: payload?.type,
            amount: payload?.amount,
            currency: payload?.currency,
            source: payload?.source,
            description: payload?.description,
            metadata: payload?.metadata,
          } as any, ctx.userId)
          break
        case 'getOverview':
          result = await governanceService.getOverview(tenantId)
          break
        default:
          return { success: false, error: `Unknown action: ${action}` }
      }
      return { success: true, data: result }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  async update(ctx: PlatformContext, id: string, data: Partial<GovernanceInput>): Promise<GovernanceOutput> {
    return { success: false, error: 'Update not supported' }
  }

  async dispose(ctx: PlatformContext): Promise<void> {
    this.initialized = false
    console.log(`[${this.name}] Disposed`)
  }
}

export const governanceRuntime = new GovernanceRuntime()
