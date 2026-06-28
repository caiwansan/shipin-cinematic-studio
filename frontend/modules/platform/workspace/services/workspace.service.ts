// ============================================================
// Workspace Service — 前端 API 调用
// ============================================================

import type {
  Workspace,
  WorkspaceSnapshot,
  WorkspaceVersion,
  WorkspaceManifest,
  WorkspaceAsset,
  WorkspaceConversationMessage,
  CreateWorkspacePayload,
  AutoSaveConfig,
  UndoRedoState,
} from '../types/index'

const BASE_URL = '/api/platform/workspace'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

export const workspaceApi = {
  // ─── CRUD ───

  async create(payload: CreateWorkspacePayload): Promise<Workspace> {
    return request<Workspace>(BASE_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async list(params?: {
    type?: string
    status?: string
    tenantId?: string
    search?: string
  }): Promise<Workspace[]> {
    const query = new URLSearchParams()
    if (params?.type) query.set('type', params.type)
    if (params?.status) query.set('status', params.status)
    if (params?.tenantId) query.set('tenantId', params.tenantId)
    if (params?.search) query.set('search', params.search)
    const qs = query.toString()
    return request<Workspace[]>(`${BASE_URL}${qs ? `?${qs}` : ''}`)
  },

  async get(id: string): Promise<Workspace> {
    return request<Workspace>(`${BASE_URL}/${id}`)
  },

  async update(id: string, data: Partial<Workspace>): Promise<Workspace> {
    return request<Workspace>(`${BASE_URL}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async delete(id: string): Promise<void> {
    return request<void>(`${BASE_URL}/${id}`, { method: 'DELETE' })
  },

  async open(id: string): Promise<{ workspace: Workspace; state: Record<string, unknown> | null }> {
    return request(`${BASE_URL}/${id}/open`, { method: 'POST' })
  },

  async publish(id: string): Promise<WorkspaceVersion> {
    return request<WorkspaceVersion>(`${BASE_URL}/${id}/publish`, { method: 'POST' })
  },

  async archive(id: string): Promise<void> {
    return request<void>(`${BASE_URL}/${id}/archive`, { method: 'POST' })
  },

  // ─── Snapshot ───

  async createSnapshot(workspaceId: string, data?: {
    label?: string
    runtimeState?: Record<string, unknown>
  }): Promise<WorkspaceSnapshot> {
    return request<WorkspaceSnapshot>(`${BASE_URL}/${workspaceId}/snapshot`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    })
  },

  async listSnapshots(workspaceId: string): Promise<WorkspaceSnapshot[]> {
    return request<WorkspaceSnapshot[]>(`${BASE_URL}/${workspaceId}/snapshot`)
  },

  async restoreSnapshot(snapshotId: string): Promise<any> {
    return request(`${BASE_URL}/snapshot/${snapshotId}/restore`, { method: 'POST' })
  },

  async getSnapshotCount(workspaceId: string): Promise<number> {
    const res = await request<{ count: number }>(`${BASE_URL}/${workspaceId}/snapshot/count`)
    return res.count
  },

  // ─── Version ───

  async createVersion(workspaceId: string, data: {
    label: string
    description?: string
    snapshotId?: string
  }): Promise<WorkspaceVersion> {
    return request<WorkspaceVersion>(`${BASE_URL}/${workspaceId}/version`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async listVersions(workspaceId: string): Promise<WorkspaceVersion[]> {
    return request<WorkspaceVersion[]>(`${BASE_URL}/${workspaceId}/version`)
  },

  async publishVersion(versionId: string): Promise<WorkspaceVersion> {
    return request<WorkspaceVersion>(`${BASE_URL}/version/${versionId}/publish`, { method: 'POST' })
  },

  // ─── Undo/Redo ───

  async undo(workspaceId: string): Promise<{ undone: boolean }> {
    return request(`${BASE_URL}/${workspaceId}/undo`, { method: 'POST' })
  },

  async redo(workspaceId: string): Promise<{ redone: boolean }> {
    return request(`${BASE_URL}/${workspaceId}/redo`, { method: 'POST' })
  },

  async getUndoRedoState(workspaceId: string): Promise<UndoRedoState> {
    return request<UndoRedoState>(`${BASE_URL}/${workspaceId}/undo-redo`)
  },

  // ─── Manifest ───

  async getManifest(workspaceId: string): Promise<WorkspaceManifest> {
    return request<WorkspaceManifest>(`${BASE_URL}/${workspaceId}/manifest`)
  },

  async exportWorkspace(workspaceId: string): Promise<any> {
    return request(`${BASE_URL}/${workspaceId}/export`)
  },

  // ─── AutoSave ───

  async startAutoSave(workspaceId: string, config?: Partial<AutoSaveConfig>): Promise<any> {
    return request(`${BASE_URL}/${workspaceId}/autosave/start`, {
      method: 'POST',
      body: JSON.stringify(config ?? {}),
    })
  },

  async stopAutoSave(workspaceId: string): Promise<any> {
    return request(`${BASE_URL}/${workspaceId}/autosave/stop`, { method: 'POST' })
  },

  async markDirty(workspaceId: string): Promise<any> {
    return request(`${BASE_URL}/${workspaceId}/autosave/dirty`, { method: 'POST' })
  },

  async flushAutoSave(workspaceId: string): Promise<any> {
    return request(`${BASE_URL}/${workspaceId}/autosave/flush`, { method: 'POST' })
  },

  // ─── State ───

  async saveState(workspaceId: string, state: Record<string, unknown>): Promise<any> {
    return request(`${BASE_URL}/${workspaceId}/state`, {
      method: 'PUT',
      body: JSON.stringify(state),
    })
  },

  async loadState(workspaceId: string): Promise<Record<string, unknown> | null> {
    return request(`${BASE_URL}/${workspaceId}/state`)
  },

  async patchState(workspaceId: string, patch: Record<string, unknown>): Promise<any> {
    return request(`${BASE_URL}/${workspaceId}/state`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  },

  // ─── Conversation ───

  async logMessage(
    workspaceId: string,
    sessionId: string,
    role: string,
    content: string,
    context?: Record<string, unknown>,
  ): Promise<WorkspaceConversationMessage> {
    return request(`${BASE_URL}/${workspaceId}/conversation`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, role, content, context }),
    })
  },

  async getConversation(workspaceId: string, sessionId: string): Promise<WorkspaceConversationMessage[]> {
    return request(`${BASE_URL}/${workspaceId}/conversation/${sessionId}`)
  },

  async getConversationForLLM(workspaceId: string, sessionId: string): Promise<Array<{ role: string; content: string }>> {
    return request(`${BASE_URL}/${workspaceId}/conversation/${sessionId}/llm`)
  },

  // ─── Assets ───

  async listAssets(workspaceId: string, type?: string): Promise<WorkspaceAsset[]> {
    const qs = type ? `?type=${type}` : ''
    return request(`${BASE_URL}/${workspaceId}/asset${qs}`)
  },

  async getAssetCount(workspaceId: string): Promise<number> {
    const res = await request<{ count: number }>(`${BASE_URL}/${workspaceId}/asset/count`)
    return res.count
  },
}
