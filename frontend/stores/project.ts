import { defineStore } from 'pinia'

export interface Project {
  id: string
  title: string
  status: 'active' | 'draft' | 'completed'
  thumbnail?: string
  description: string
  shotCount: number
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

// Mock projects data
const MOCK_PROJECTS: Project[] = [
]

export const useProjectStore = defineStore('project', {
  state: () => ({
    currentProject: null as Project | null,
    projects: [] as Project[],
    searchQuery: '',
    statusFilter: '' as string,
    sortField: 'updatedAt' as string,
    sortDir: 'desc' as 'asc' | 'desc',
  }),
  getters: {
    selectedProject: (state) => state.currentProject,
    filteredProjects: (state) => {
      let list = [...state.projects]
      // Search
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase()
        list = list.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      }
      // Status filter
      if (state.statusFilter) {
        list = list.filter(p => p.status === state.statusFilter)
      }
      // Sort
      const dir = state.sortDir === 'asc' ? 1 : -1
      list.sort((a, b) => {
        const aVal = (a as any)[state.sortField] || ''
        const bVal = (b as any)[state.sortField] || ''
        return aVal > bVal ? dir : aVal < bVal ? -dir : 0
      })
      return list
    },
    recentProjects: (state) => state.projects.slice(0, 5),
    activeProjects: (state) => state.projects.filter(p => p.status === 'active'),
  },
  actions: {
    setCurrentProject(p: Project | null) { this.currentProject = p },
    setProjects(list: Project[]) { this.projects = list },
    async fetchProjects() {
      try {
        const { fetchProjects: apiFetch } = await import('~/services/projectService')
        const list = await apiFetch()
        if (list && list.length > 0) {
          this.projects = list.map((p: any) => ({
            id: p.id,
            title: p.name || '未命名',
            status: (p.status || 'draft') as 'active' | 'draft' | 'completed',
            thumbnail: '',
            description: p.description || '',
            shotCount: 0,
            isFavorite: false,
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString(),
          }))
          return
        }
      } catch (e) {
        console.warn('[Project] API fetch failed, using local:', e)
      }
      this.projects = MOCK_PROJECTS
    },
    toggleFavorite(id: string) {
      const p = this.projects.find(p => p.id === id)
      if (p) p.isFavorite = !p.isFavorite
    },
    deleteProject(id: string) {
      this.projects = this.projects.filter(p => p.id !== id)
    },
    async createProject(title: string, description: string) {
      try {
        // Create project via API to get a real UUID-backed ID
        const { createProject: apiCreate } = await import('~/services/projectService')
        const result = await apiCreate(title, description)
        if (result && result.id) {
          const newProject: Project = {
            id: result.id,
            title: result.name || title,
            status: (result.status as any) || 'draft',
            thumbnail: '',
            description: result.description || description,
            shotCount: 0,
            isFavorite: false,
            createdAt: result.createdAt || new Date().toISOString(),
            updatedAt: result.updatedAt || new Date().toISOString(),
          }
          this.projects.unshift(newProject)
          return newProject
        }
      } catch (e) {
        console.warn('[Project] API create failed, falling back to local ID:', e)
      }
      // Fallback: local-only ID if API is unavailable
      const newProject: Project = {
        id: `p${Date.now()}`,
        title,
        status: 'draft',
        thumbnail: '',
        description,
        shotCount: 0,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.projects.unshift(newProject)
      return newProject
    },
  },
})
