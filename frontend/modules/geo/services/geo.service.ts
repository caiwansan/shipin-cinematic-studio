// ============================================================
// GEO API Service — 前端 API 调用层
// ============================================================

import type {
  GEOProject,
  Entity,
  EntityRelation,
  KnowledgeGraph,
  GraphVisualizationData,
  ResearchOutput,
  GraphNodeDetail,
  ProvenanceChain,
} from '../types/index'

const BASE = '/api/geo'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error || 'Request failed')
  }
  return json.data as T
}

export const geoApi = {
  // ─── Projects ───

  async createProject(data: {
    name: string
    topic?: string
    userId?: string
    language?: string
    industry?: string
    config?: Record<string, unknown>
  }): Promise<GEOProject> {
    return request<GEOProject>(`${BASE}/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async listProjects(tenantId: string): Promise<GEOProject[]> {
    return request<GEOProject[]>(`${BASE}/projects?tenantId=${encodeURIComponent(tenantId)}`)
  },

  async getProject(id: string): Promise<GEOProject> {
    return request<GEOProject>(`${BASE}/projects/${id}`)
  },

  async updateProject(id: string, data: Partial<GEOProject>): Promise<GEOProject> {
    return request<GEOProject>(`${BASE}/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async deleteProject(id: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`${BASE}/projects/${id}`, {
      method: 'DELETE',
    })
  },

  async snapshotProject(id: string): Promise<any> {
    return request(`${BASE}/projects/${id}/snapshot`, {
      method: 'POST',
    })
  },

  // ─── Entities ───

  async discoverEntities(projectId: string, topic: string): Promise<{
    entities: Entity[]
    relations: EntityRelation[]
  }> {
    return request(`${BASE}/projects/${projectId}/discover`, {
      method: 'POST',
      body: JSON.stringify({ topic }),
    })
  },

  async getEntity(id: string): Promise<Entity> {
    return request<Entity>(`${BASE}/entities/${id}`)
  },

  async listEntities(projectId: string): Promise<Entity[]> {
    return request<Entity[]>(`${BASE}/projects/${projectId}/entities`)
  },

  async updateEntity(id: string, data: Partial<Entity>): Promise<Entity> {
    return request<Entity>(`${BASE}/entities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async addRelation(
    sourceId: string,
    targetId: string,
    type: string,
    metadata?: Record<string, unknown>,
  ): Promise<EntityRelation> {
    return request<EntityRelation>(`${BASE}/entities/${sourceId}/relations`, {
      method: 'POST',
      body: JSON.stringify({ targetId, type, metadata }),
    })
  },

  async getEntityRelations(entityId: string): Promise<EntityRelation[]> {
    return request<EntityRelation[]>(`${BASE}/entities/${entityId}/relations`)
  },

  async getEntityProvenance(entityId: string): Promise<ProvenanceChain> {
    return request<ProvenanceChain>(`${BASE}/entities/${entityId}/provenance`)
  },

  // ─── Knowledge Graph ───

  async buildGraph(projectId: string): Promise<KnowledgeGraph> {
    return request<KnowledgeGraph>(`${BASE}/projects/${projectId}/graph/build`, {
      method: 'POST',
    })
  },

  async getGraph(projectId: string): Promise<KnowledgeGraph> {
    return request<KnowledgeGraph>(`${BASE}/projects/${projectId}/graph`)
  },

  async getGraphNode(projectId: string, entityId: string): Promise<GraphNodeDetail> {
    return request<GraphNodeDetail>(`${BASE}/projects/${projectId}/graph/node/${entityId}`)
  },

  async getGraphEdges(projectId: string): Promise<EntityRelation[]> {
    return request<EntityRelation[]>(`${BASE}/projects/${projectId}/graph/edges`)
  },

  async visualize(projectId: string): Promise<GraphVisualizationData> {
    return request<GraphVisualizationData>(`${BASE}/projects/${projectId}/graph/visualize`)
  },
}
