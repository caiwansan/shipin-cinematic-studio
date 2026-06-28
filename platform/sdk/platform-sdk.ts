// ============================================================
// Platform SDK — single entry point for all Runtime operations
// ARCH-001-J: Workspace code must NOT access Runtime directly; use this SDK
// ARCH-002: All SDK methods accept and forward PlatformContext
// ============================================================

import type { PlatformContext } from '../context/platform-context.js'

// ─── Domain Types (re-exported from Runtimes) ───

export interface ScanResult {
  title?: string
  description?: string
  language?: string
  robots?: Record<string, unknown>
  sitemap?: { urls: string[]; count: number }
  meta?: Record<string, unknown>
  pages?: Array<{ url: string; title: string; depth: number; type: string }>
  error?: string
}

export interface AssetData {
  id?: string
  projectId: string
  type: string
  title: string
  content?: string
  summary?: string
  metadata?: Record<string, unknown>
  status?: string
}

export interface SemanticEntityData {
  id?: string
  projectId: string
  type: string
  name: string
  description?: string
  confidence?: number
}

export interface GoalData {
  id?: string
  projectId: string
  title: string
  description?: string
  status?: string
  priority?: number
}

export interface CapabilityContract {
  id: string
  name: string
  displayName: string
  description: string | null
  category: string
  version: string
  status: string
}

export interface ExecuteRequest {
  capabilityName: string
  input: Record<string, unknown>
  context?: {
    userId?: string
    projectId?: string
    priority?: number
  }
}

export interface ExecuteResult {
  success: boolean
  provider: string
  capability: string
  result: Record<string, unknown> | null
  error: string | null
  metrics: {
    resolveTimeMs: number
    strategyUsed: string
  }
}

// ─── Service Interfaces (all accept PlatformContext) ───

export interface AssetService {
  create(data: AssetData, ctx?: PlatformContext): Promise<AssetData>
  get(id: string, ctx?: PlatformContext): Promise<AssetData | null>
  list(projectId: string, filter?: Record<string, unknown>, ctx?: PlatformContext): Promise<{ items: AssetData[]; total: number }>
  delete(id: string, ctx?: PlatformContext): Promise<void>
  importFromHtml(projectId: string, url: string, html: string, ctx?: PlatformContext): Promise<unknown>
}

export interface SemanticService {
  extract(projectId: string, content: string, ctx?: PlatformContext): Promise<void>
  listEntities(projectId: string, filter?: Record<string, unknown>, ctx?: PlatformContext): Promise<{ items: SemanticEntityData[]; total: number }>
  deleteEntity(id: string, ctx?: PlatformContext): Promise<void>
}

export interface GoalService {
  create(data: GoalData, ctx?: PlatformContext): Promise<GoalData>
  get(id: string, ctx?: PlatformContext): Promise<GoalData | null>
  executeTask(taskId: string, ctx?: PlatformContext): Promise<ExecuteResult>
  generateStrategies(goalId: string, ctx?: PlatformContext): Promise<any[]>
  runFullPipeline(goalId: string, ctx?: PlatformContext): Promise<any>
}

export interface CapabilityService {
  get(name: string, ctx?: PlatformContext): Promise<CapabilityContract | null>
  validate(contractName: string, input: Record<string, unknown>, ctx?: PlatformContext): Promise<any>
  resolve(request: ExecuteRequest, ctx?: PlatformContext): Promise<ExecuteResult>
  register(input: Record<string, unknown>, ctx?: PlatformContext): Promise<CapabilityContract>
  list(ctx?: PlatformContext): CapabilityContract[]
}

// ─── Platform SDK ───

export class PlatformSDK {
  private assetService?: AssetService
  private semanticService?: SemanticService
  private goalService?: GoalService
  private capabilityService?: CapabilityService

  async initialize(): Promise<void> {
    const { assetRuntime } = await import('../../backend/src/services/asset/runtime/asset.runtime.js')

    this.assetService = {
      async create(data, ctx) { throw new Error('use importFromHtml instead') },
      async get(id, ctx) { return assetRuntime.getAsset(id) as any },
      async list(projectId, filter, ctx) { return assetRuntime.listByProject(projectId, filter) as any },
      async delete(id, ctx) { await assetRuntime.deleteAsset(id) },
      async importFromHtml(projectId, url, html, ctx) { return assetRuntime.importFromHtml(projectId, url, html) },
    }

    const { semanticRuntime } = await import('../../backend/src/services/semantic/runtime/semantic.runtime.js')
    this.semanticService = {
      async extract(projectId, content, ctx) {
        if (ctx) {
          await semanticRuntime.init(ctx)
          await semanticRuntime.execute(ctx, { projectId, content })
        } else {
          await (semanticRuntime as any).loadFromContent(projectId, { content })
        }
      },
      async listEntities(projectId, filter, ctx) { return semanticRuntime.listEntities({ projectId, ...filter } as any) as any },
      async deleteEntity(id, ctx) { await (semanticRuntime as any).deleteEntity(id) },
    }

    const { goalRuntime } = await import('../../backend/src/services/goal/runtime/goal.runtime.js')
    this.goalService = {
      async create(data, ctx) { return goalRuntime.createGoal(data) as any },
      async get(id, ctx) { return goalRuntime.getGoal(id) as any },
      async executeTask(taskId, ctx) {
        const result = await goalRuntime.executeTask(taskId)
        return {
          success: result.execution.status === 'completed',
          provider: 'internal',
          capability: result.execution.actionType,
          result: { execution: result.execution, results: result.results },
          error: result.execution.status === 'failed' ? 'execution failed' : null,
          metrics: { resolveTimeMs: 0, strategyUsed: 'internal' },
        }
      },
      async generateStrategies(goalId, ctx) { return goalRuntime.generateStrategies(goalId) as any },
      async runFullPipeline(goalId, ctx) { return goalRuntime.runFullPipeline(goalId, ctx) as any },
    }

    const { capabilityRuntime } = await import('../../backend/src/services/platform/capability/runtime/capability.runtime.js')
    this.capabilityService = {
      async get(name, ctx) { return capabilityRuntime.getCapability(name) as any },
      async validate(contractName, input, ctx) { return capabilityRuntime.validateContract(contractName, input) },
      async resolve(request, ctx) { return capabilityRuntime.resolve(request as any) as any },
      async register(input, ctx) { return capabilityRuntime.register(input as any) as any },
      list(ctx) { return capabilityRuntime.listCapabilities() as any },
    }
  }

  // ─── Public API ───

  async scan(url: string, ctx?: PlatformContext): Promise<ScanResult> {
    const { runScannerPipeline } = await import('../../backend/src/services/geo/scanner/pipeline.js')
    return runScannerPipeline({ url, projectId: ctx?.projectId || '' }) as any
  }

  asset(): AssetService {
    if (!this.assetService) throw new Error('SDK not initialized. Call platformSDK.initialize() first.')
    return this.assetService
  }

  semantic(): SemanticService {
    if (!this.semanticService) throw new Error('SDK not initialized. Call platformSDK.initialize() first.')
    return this.semanticService
  }

  goal(): GoalService {
    if (!this.goalService) throw new Error('SDK not initialized. Call platformSDK.initialize() first.')
    return this.goalService
  }

  capability(name: string): CapabilityService {
    if (!this.capabilityService) throw new Error('SDK not initialized. Call platformSDK.initialize() first.')
    return this.capabilityService
  }

  async execute(request: ExecuteRequest, ctx?: PlatformContext): Promise<ExecuteResult> {
    if (!this.capabilityService) throw new Error('SDK not initialized. Call platformSDK.initialize() first.')
    return this.capabilityService.resolve(request, ctx)
  }
}

// Singleton
export const platformSDK = new PlatformSDK()
