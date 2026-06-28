// ============================================================
// Frontend Workspace Runtime — 前端 Runtime
// ============================================================

import { useWorkspaceStore } from '../store/useWorkspaceStore'
import { workspaceApi } from '../services/workspace.service'
import type { Workspace, WorkspaceSnapshot, CreateWorkspacePayload } from '../types/index'

export class WorkspaceRuntimeClient {
  private store = useWorkspaceStore()

  async initialize(tenantId: string): Promise<void> {
    await this.store.loadWorkspaces({ tenantId })
  }

  async createWorkspace(payload: CreateWorkspacePayload): Promise<Workspace | null> {
    return this.store.createWorkspace(payload)
  }

  async openWorkspace(id: string): Promise<{
    workspace: Workspace
    state: Record<string, unknown> | null
  } | null> {
    return this.store.openWorkspace(id)
  }

  async saveSnapshot(workspaceId: string, label?: string): Promise<WorkspaceSnapshot | null> {
    return this.store.createSnapshot(workspaceId, label)
  }

  async restoreWorkspace(snapshotId: string): Promise<any> {
    return this.store.restoreSnapshot(snapshotId)
  }

  async undo(workspaceId: string): Promise<any> {
    return this.store.undo(workspaceId)
  }

  async redo(workspaceId: string): Promise<any> {
    return this.store.redo(workspaceId)
  }

  async saveState(workspaceId: string, state: Record<string, unknown>): Promise<void> {
    await this.store.saveState(workspaceId, state)
  }

  getWorkspaces(): Workspace[] {
    return this.store.workspaces
  }

  getCurrentWorkspace(): Workspace | null {
    return this.store.currentWorkspace
  }

  getUndoRedoState() {
    return this.store.undoRedoState
  }

  reset(): void {
    this.store.reset()
  }
}

export const workspaceRuntimeClient = new WorkspaceRuntimeClient()
