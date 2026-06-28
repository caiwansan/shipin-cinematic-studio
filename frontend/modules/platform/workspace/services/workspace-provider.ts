// ============================================================
// Workspace Provider — 跨 Workspace 接口
// ============================================================

import { workspaceApi } from './workspace.service'
import type {
  Workspace,
  WorkspaceSnapshot,
  WorkspaceManifest,
  CreateWorkspacePayload,
  AutoSaveConfig,
} from '../types/index'

export interface WorkspaceProvider {
  listWorkspaces(params?: {
    type?: string
    status?: string
    tenantId?: string
  }): Promise<Workspace[]>

  getWorkspace(id: string): Promise<Workspace>

  createWorkspace(payload: CreateWorkspacePayload): Promise<Workspace>

  saveWorkspace(id: string, state?: Record<string, unknown>): Promise<void>

  createSnapshot(workspaceId: string, label?: string): Promise<WorkspaceSnapshot>

  restoreSnapshot(snapshotId: string): Promise<any>

  undo(workspaceId: string): Promise<{ undone: boolean }>

  redo(workspaceId: string): Promise<{ redone: boolean }>

  getManifest(workspaceId: string): Promise<WorkspaceManifest>

  exportWorkspace(workspaceId: string): Promise<any>

  configureAutoSave(workspaceId: string, config: Partial<AutoSaveConfig>): Promise<any>

  startAutoSave(workspaceId: string): Promise<any>

  stopAutoSave(workspaceId: string): Promise<any>

  markDirty(workspaceId: string): Promise<any>

  searchWorkspaces(query: string): Promise<Workspace[]>
}

export const workspaceProvider: WorkspaceProvider = {
  async listWorkspaces(params) {
    return workspaceApi.list(params)
  },

  async getWorkspace(id) {
    return workspaceApi.get(id)
  },

  async createWorkspace(payload) {
    return workspaceApi.create(payload)
  },

  async saveWorkspace(id, state) {
    if (state) {
      await workspaceApi.saveState(id, state)
    }
  },

  async createSnapshot(workspaceId, label) {
    return workspaceApi.createSnapshot(workspaceId, { label })
  },

  async restoreSnapshot(snapshotId) {
    return workspaceApi.restoreSnapshot(snapshotId)
  },

  async undo(workspaceId) {
    return workspaceApi.undo(workspaceId)
  },

  async redo(workspaceId) {
    return workspaceApi.redo(workspaceId)
  },

  async getManifest(workspaceId) {
    return workspaceApi.getManifest(workspaceId)
  },

  async exportWorkspace(workspaceId) {
    return workspaceApi.exportWorkspace(workspaceId)
  },

  async configureAutoSave(workspaceId, config) {
    return workspaceApi.startAutoSave(workspaceId, config)
  },

  async startAutoSave(workspaceId) {
    return workspaceApi.startAutoSave(workspaceId)
  },

  async stopAutoSave(workspaceId) {
    return workspaceApi.stopAutoSave(workspaceId)
  },

  async markDirty(workspaceId) {
    return workspaceApi.markDirty(workspaceId)
  },

  async searchWorkspaces(query) {
    return workspaceApi.list({ search: query })
  },
}
