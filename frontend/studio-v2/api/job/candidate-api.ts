import { getAuthToken, setAuthToken, clearAuthToken } from '~/utils/auth/token'
/**
 * candidate-api.ts — 求职者工作台 API Client
 *
 * 归属: 求职者工作台 (Candidate Workspace) → /workspace/job
 * 审计: JOB-WORKSPACE-BOUNDARY-AUDIT 2026-07-26 — Phase 2 拆分
 *
 * 职责:
 *   仅包含求职者侧 API: chat, profile, recommendations, news, statistics
 *   禁止混入企业招聘或平台管理 API
 */
import { getToken } from '~/utils/token-cache'

const BASE_URL = '/api/job'

interface ApiOptions {
  method?: string
  body?: any
  params?: Record<string, string>
}

async function request(path: string, options: ApiOptions = {}) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  let url = `${BASE_URL}${path}`
  if (options.params) {
    const qs = new URLSearchParams(options.params).toString()
    url += `?${qs}`
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    if (!window.location.pathname.includes('/login')) {
      clearAuthToken()
      window.location.href = '/login'
    }
    throw new Error('未登录或登录已过期')
  }

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

// ─── API Contract Types ───

export interface ChatRequest {
  message: string
  userId?: string
  history?: ChatMessage[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── AI 求职助手 ───

/**
 * 与 AI 求职助手聊天
 */
export async function chatWithCareerAgent(req: ChatRequest) {
  return request('/chat', {
    method: 'POST',
    body: { message: req.message, userId: req.userId, history: req.history },
  })
}

// ─── 求职者画像 ───

/**
 * 获取求职者画像
 */
export async function getCandidateProfile(userId: string) {
  return request('/profile', { params: { userId } })
}

/**
 * 更新求职者画像
 */
export async function updateCandidateProfile(profile: {
  userId: string
  education?: string
  skills?: string[]
  experience?: string
  city?: string
  salaryExpectation?: string
  careerGoal?: string
  profileJson?: any
}) {
  return request('/profile', {
    method: 'PUT',
    body: profile,
  })
}

// ─── 推荐岗位 ───

/**
 * 获取推荐岗位
 */
export async function getJobRecommendations(userId: string) {
  return request('/recommendations', { params: { userId } })
}

/**
 * 岗位行为反馈
 */
export async function submitJobFeedback(userId: string, jobId: string, feedback: string) {
  return request('/recommendations/feedback', {
    method: 'POST',
    body: { userId, jobId, feedback },
  })
}

/**
 * 个人职业档案中心
 */
export async function getCareerProfileCenter(userId: string) {
  return request('/profile/center', { params: { userId } })
}

// ─── 招聘动态 ───

/**
 * 获取招聘动态
 */
export async function getJobNews(params?: {
  category?: string
  page?: number
  limit?: number
}) {
  return request('/news', { params: params as any })
}

/**
 * 获取招聘统计
 */
export async function getJobStatistics() {
  return request('/statistics')
}
