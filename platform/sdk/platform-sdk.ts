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

// ─── Execution Runtime Types (KMKI-PLAT-007) ───

export interface ExecutionStepDTO {
  id: string
  type: string
  name: string
  inputs?: Record<string, any>
  outputs?: Record<string, string>
  dependencies?: string[]
  timeout?: number
  retry?: { maxAttempts: number; backoffMs: number }
  metadata?: Record<string, any>
}

export interface ExecutionPlanDTO {
  id: string
  capabilityId: string
  version: string
  steps: ExecutionStepDTO[]
  dependencies?: Record<string, string[]>
  parallelGroups?: string[][]
  metadata?: Record<string, any>
  schemaVersion: string
}

export interface ExecutionResultDTO {
  planId: string
  capabilityId: string
  status: 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  durationMs?: number
  stepResults: Array<{
    stepId: string
    stepType: string
    status: string
    durationMs?: number
    error?: { code: string; message: string }
  }>
  error?: { code: string; message: string }
  metrics: {
    totalSteps: number
    completedSteps: number
    failedSteps: number
    totalDurationMs: number
  }
  schemaVersion: string
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

// ─── Workspace Runtime Types (KMKI-PLAT-009) ───

export type WorkspaceType = 'short_drama' | 'novel' | 'ppt' | 'geo' | 'asset'

export interface WorkspaceDTO {
  id: string
  type: WorkspaceType
  tenantId: string
  name: string
  description?: string
  status: string
  runtimeState?: Record<string, unknown>
  manifest?: string
  settings?: Record<string, unknown>
  metadata?: Record<string, unknown>
  schemaVersion: number
  createdAt: Date
  updatedAt: Date
}

export interface WorkspaceSnapshotDTO {
  id: string
  workspaceId: string
  version: number
  label?: string
  runtimeState?: Record<string, unknown>
  createdAt: Date
  autoSave: boolean
}

export interface WorkspaceManifest {
  workspaceId: string
  name: string
  type: WorkspaceType
  capabilities: Array<{ id: string; name: string; version: string; category: string }>
  assets: Array<{ id: string; type: string; path: string; size: number }>
  outputVersions: Array<{ version: string; label: string; published: boolean; createdAt: string }>
  costSummary: { totalEstimatedCost: number; currency: string }
  auditTrail: Array<{ operation: string; userId?: string; timestamp: string }>
  generatedAt: string
  schemaVersion: number
}

export interface WorkspaceService {
  create(type: WorkspaceType, name: string, tenantId: string, description?: string): Promise<WorkspaceDTO>
  get(id: string): Promise<WorkspaceDTO | null>
  list(tenantId: string): Promise<WorkspaceDTO[]>
  snapshot(workspaceId: string, label?: string): Promise<WorkspaceSnapshotDTO>
  restore(snapshotId: string): Promise<any>
  undo(workspaceId: string): Promise<boolean>
  redo(workspaceId: string): Promise<boolean>
  getManifest(workspaceId: string): Promise<WorkspaceManifest | null>
  export(workspaceId: string): Promise<any>
  delete(id: string): Promise<void>
}

// ─── Platform SDK ───

export class PlatformSDK {
  private assetService?: AssetService
  private semanticService?: SemanticService
  private goalService?: GoalService
  private capabilityService?: CapabilityService
  private executionRuntime?: any

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

    // Initialize Execution Runtime (KMKI-PLAT-007)
    try {
      const { executionRuntime } = await import('../../backend/src/services/platform/execution/runtime/execution.runtime.js')
      this.executionRuntime = executionRuntime
      await executionRuntime.init({})
      console.log('[PlatformSDK] Execution Runtime initialized')
    } catch (err) {
      console.warn('[PlatformSDK] Failed to init Execution Runtime:', (err as Error).message)
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

  // ─── Execution Runtime Methods (KMKI-PLAT-007) ───

  /**
   * Compile a capability into an execution plan.
   */
  async compile(capabilityId: string, ctx?: PlatformContext): Promise<ExecutionPlanDTO> {
    if (!this.executionRuntime) throw new Error('Execution Runtime not available')

    const { executionCompiler } = await import('../../backend/src/services/platform/execution/compiler/execution-compiler.js')
    const compiled = await executionCompiler.compile({
      id: capabilityId,
      name: capabilityId,
      displayName: capabilityId,
      description: null,
      category: 'general',
      version: '1.0.0',
      status: 'active',
    }, undefined, ctx as any)

    return compiled.plan as any
  }

  /**
   * Create an execution plan from a capability.
   */
  async plan(capabilityId: string, _input: any, ctx?: PlatformContext): Promise<ExecutionPlanDTO> {
    return this.compile(capabilityId, ctx)
  }

  /**
   * Execute an execution plan and return results.
   */
  async executePlan(plan: ExecutionPlanDTO, ctx?: PlatformContext): Promise<ExecutionResultDTO> {
    if (!this.executionRuntime) throw new Error('Execution Runtime not available')
    return this.executionRuntime.execute(ctx || {}, plan) as any
  }

  // ─── Workspace Runtime (KMKI-PLAT-009) ───

  private workspaceService?: WorkspaceService

  /**
   * Get the Workspace service for managing AI creation workspaces.
   */
  workspace(): WorkspaceService {
    if (!this.workspaceService) {
      this.workspaceService = this._createWorkspaceService()
    }
    return this.workspaceService
  }

  private _createWorkspaceService(): WorkspaceService {
    const that = this
    return {
      async create(type, name, tenantId, description) {
        const { workspaceService } = await import('../../backend/src/services/platform/workspace/workspace.service.js')
        return workspaceService.create({ type, name, tenantId, description })
      },
      async get(id) {
        const { workspaceService } = await import('../../backend/src/services/platform/workspace/workspace.service.js')
        return workspaceService.get(id) as any
      },
      async list(tenantId) {
        const { workspaceService } = await import('../../backend/src/services/platform/workspace/workspace.service.js')
        return workspaceService.list({ tenantId }) as any
      },
      async snapshot(workspaceId, label) {
        const { workspaceService } = await import('../../backend/src/services/platform/workspace/workspace.service.js')
        return workspaceService.snapshot(workspaceId, label)
      },
      async restore(snapshotId) {
        const { workspaceService } = await import('../../backend/src/services/platform/workspace/workspace.service.js')
        return workspaceService.restore(snapshotId)
      },
      async undo(workspaceId) {
        const { workspaceService } = await import('../../backend/src/services/platform/workspace/workspace.service.js')
        return workspaceService.undo(workspaceId)
      },
      async redo(workspaceId) {
        const { workspaceService } = await import('../../backend/src/services/platform/workspace/workspace.service.js')
        return workspaceService.redo(workspaceId)
      },
      async getManifest(workspaceId) {
        const { workspaceService } = await import('../../backend/src/services/platform/workspace/workspace.service.js')
        return workspaceService.getManifest(workspaceId) as any
      },
      async export(workspaceId) {
        const { workspaceService } = await import('../../backend/src/services/platform/workspace/workspace.service.js')
        return workspaceService.exportWorkspace(workspaceId)
      },
      async delete(id) {
        const { workspaceService } = await import('../../backend/src/services/platform/workspace/workspace.service.js')
        return workspaceService.delete(id)
      },
    }
  }
}

// Singleton
export const platformSDK = new PlatformSDK()
