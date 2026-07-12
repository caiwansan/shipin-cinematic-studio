// ============================================================
// ExecutionContext 工厂函数
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import type { ExecutionContext, ProviderPolicy } from './types'

export function createExecutionContext(params: {
  brandId: string
  tenantId: string
  sourceType: string
  sourceId: string
  variables?: Record<string, unknown>
  providerPolicy?: ProviderPolicy
}): ExecutionContext {
  return {
    executionId: uuidv4(),
    brandId: params.brandId,
    tenantId: params.tenantId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    variables: params.variables ?? {},
    providerPolicy: params.providerPolicy ?? 'FASTEST',
    metadata: {},
  }
}
