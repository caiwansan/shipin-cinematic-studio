// ============================================================
// Workspace Runtime — ARCH-002 冻结规范
// Init → Load → Validate → Execute → Update → Dispose
// 使用 PlatformContext, EventBus, PlatformError
// ============================================================

import { workspaceService } from '../workspace.service.js'
import { workspaceRepository } from '../repositories/workspace.repository.js'
import { platformEventBus } from '@platform/events/event-bus.js'
import type { PlatformContext } from '@platform/context/platform-context.js'
import type { WorkspaceDTO } from '../types.js'

export class WorkspaceRuntime {
  private context: PlatformContext | null = null
  private workspace: WorkspaceDTO | null = null
  private initialized = false

  // ─── ARCH-002 Lifecycle ───

  /**
   * Phase 1: Init — Initialize the runtime with context.
   */
  async init(ctx: PlatformContext): Promise<void> {
    this.context = ctx
    this.initialized = true
    console.debug('[WorkspaceRuntime] Initialized')
  }

  /**
   * Phase 2: Load — Load a workspace by ID.
   */
  async load(workspaceId: string): Promise<WorkspaceDTO> {
    this._requireInit()

    const { workspace } = await workspaceService.open(workspaceId)
    this.workspace = workspace

    console.debug(`[WorkspaceRuntime] Loaded workspace: ${workspaceId}`)
    return workspace
  }

  /**
   * Phase 3: Validate — Validate workspace state and configuration.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    this._requireInit()
    this._requireLoaded()

    const errors: string[] = []
    const w = this.workspace!

    if (!w.type) errors.push('Workspace type is required')
    if (!w.name) errors.push('Workspace name is required')
    if (!w.tenantId) errors.push('Workspace tenantId is required')

    return { valid: errors.length === 0, errors }
  }

  /**
   * Phase 4: Execute — Execute a workspace operation.
   */
  async execute(action: string, payload?: any): Promise<any> {
    this._requireInit()
    this._requireLoaded()

    const workspaceId = this.workspace!.id

    switch (action) {
      case 'save':
        return workspaceService.save(workspaceId, payload?.state)
      case 'snapshot':
        return workspaceService.snapshot(workspaceId, payload?.label, payload?.state)
      case 'restore':
        return workspaceService.restore(payload?.snapshotId)
      case 'publish':
        return workspaceService.publish(workspaceId)
      case 'archive':
        return workspaceService.archive(workspaceId)
      case 'undo':
        return workspaceService.undo(workspaceId)
      case 'redo':
        return workspaceService.redo(workspaceId)
      case 'manifest':
        return workspaceService.getManifest(workspaceId)
      case 'dirty':
        workspaceService.markDirty(workspaceId)
        return { marked: true }
      default:
        throw new Error(`Unknown workspace action: ${action}`)
    }
  }

  /**
   * Phase 5: Update — Update workspace metadata.
   */
  async update(input: Partial<{
    name?: string
    description?: string
    status?: string
    settings?: Record<string, unknown>
  }>): Promise<WorkspaceDTO> {
    this._requireInit()
    this._requireLoaded()

    this.workspace = await workspaceRepository.update(this.workspace!.id, input as any)
    return this.workspace
  }

  /**
   * Phase 6: Dispose — Clean up runtime state.
   */
  async dispose(): Promise<void> {
    this.workspace = null
    this.context = null
    this.initialized = false
    console.debug('[WorkspaceRuntime] Disposed')
  }

  // ─── Getters ───

  getCurrentWorkspace(): WorkspaceDTO | null {
    return this.workspace
  }

  isInitialized(): boolean {
    return this.initialized
  }

  // ─── Private ───

  private _requireInit(): void {
    if (!this.initialized) {
      throw new Error('[WorkspaceRuntime] Not initialized. Call init() first.')
    }
  }

  private _requireLoaded(): void {
    if (!this.workspace) {
      throw new Error('[WorkspaceRuntime] No workspace loaded. Call load() first.')
    }
  }
}

// Singleton
export const workspaceRuntime = new WorkspaceRuntime()
