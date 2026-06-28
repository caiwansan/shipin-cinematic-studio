/**
 * 项目管理服务 — 对接后端 /api/projects CRUD + hydrate
 */

export interface ProjectInfo {
  id: string
  name: string
  description?: string
  status: string
  updatedAt: string
}

export interface ProjectHydrateData {
  success: boolean
  project: ProjectInfo
  executionResults: any
  characters: any[]
  scenes: any[]
  // ... 更多关联数据
}

function authHeaders(): Record<string, string> {
  const { getToken } = require('../utils/token-cache') as typeof import('~/utils/token-cache')
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/** 获取当前用户的所有项目 */
export async function fetchProjects(): Promise<ProjectInfo[]> {
  try {
    const res = await fetch('/api/projects', { headers: authHeaders() })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${t}`)
    }
    const data = await res.json()
    // /api/projects 直接返回数组
    if (Array.isArray(data)) return data
    return data.data || data.projects || data.project || []
  } catch (e: any) {
    console.warn('[ProjectService] fetchProjects failed:', e.message)
    return []
  }
}

/** 创建项目 */
export async function createProject(name: string, description?: string): Promise<ProjectInfo | null> {
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${t}`)
    }
    const data = await res.json()
    // 创建后端返回的直接是 project 对象（含 id）
    if (data?.id) return data
    return data.data || data.project || data
  } catch (e: any) {
    console.warn('[ProjectService] createProject failed:', e.message)
    return null
  }
}

/** 获取项目列表 */
export async function getProject(id: string): Promise<ProjectInfo | null> {
  try {
    const res = await fetch(`/api/projects/${id}`, { headers: authHeaders() })
    if (!res.ok) return null
    const data = await res.json()
    return data.data || data.project || data
  } catch {
    return null
  }
}

/** 全量加载项目状态（hydrate） */
export async function hydrateProject(id: string): Promise<ProjectHydrateData | null> {
  try {
    const res = await fetch(`/api/projects/${id}/hydrate`, { headers: authHeaders() })
    if (!res.ok) return null
    const data = await res.json()
    return data
  } catch {
    return null
  }
}

/** 保存执行结果（工作流完整状态） */
export async function saveExecutionResults(id: string, executionResults: any): Promise<boolean> {
  try {
    const res = await fetch(`/api/projects/${id}/execution-results`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ executionResults }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      console.warn('[ProjectService] saveExecutionResults failed:', t)
    }
    return res.ok
  } catch {
    return false
  }
}

/** 获取执行结果 */
export async function getExecutionResults(id: string): Promise<any | null> {
  try {
    const res = await fetch(`/api/projects/${id}/execution-results`, { headers: authHeaders() })
    if (!res.ok) return null
    const data = await res.json()
    return data.data
  } catch {
    return null
  }
}

/** 获取当前用户信息（用于判断是否登录） */
export async function fetchCurrentUser(): Promise<{ id: string; username: string; email: string } | null> {
  try {
    const res = await fetch('/api/auth/me', { headers: authHeaders() })
    if (!res.ok) return null
    const data = await res.json()
    return data.user || data
  } catch {
    return null
  }
}
