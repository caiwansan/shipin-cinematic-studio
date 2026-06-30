// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
/**
 * projectService — Project operations via GEOApiClient.
 */
import { client } from '../clients/GEOApiClient'
export interface GeoProjectV2 {
  id: string
  userId: string
  name: string
  topic?: string
  industry?: string
  language: string
  status: string
  createdAt: string
  updatedAt: string
}

export const projectService = {
  async list(): Promise<GeoProjectV2[]> {
    const res = await client.get<{ projects: GeoProjectV2[] }>('/projects')
    return res.data?.projects || []
  },

  async get(id: string): Promise<GeoProjectV2 | null> {
    const res = await client.get<{ project: GeoProjectV2 }>(`/projects/${id}`)
    return res.data?.project || null
  },

  async create(data: Partial<GeoProjectV2>): Promise<GeoProjectV2 | null> {
    const res = await client.post<{ project: GeoProjectV2 }>('/projects', data)
    return res.data?.project || null
  },

  async remove(id: string): Promise<void> {
    await client.delete(`/projects/${id}`)
  },
}
