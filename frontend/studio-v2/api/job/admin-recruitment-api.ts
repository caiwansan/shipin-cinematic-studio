/**
 * admin-recruitment-api.ts — 平台招聘管理 API Client
 *
 * 归属: 平台管理后台 (Admin Recruitment) → /admin/recruitment
 * 审计: JOB-WORKSPACE-BOUNDARY-AUDIT 2026-07-26 — Phase 2 拆分
 *
 * 职责:
 *   平台运营侧 API: Agent 配置、风控审计、全局数据视图、Campaign 管理
 *   禁止混入求职者 API 或企业招聘 API
 *
 * 注意:
 *   当前 admin API 由后端 routes/admin-recruitment.ts 提供，
 *   前端页面 (pages/admin/recruitment/*) 已存在但部分仍在开发中。
 *   本文件为预留结构，后续随 Admin 页面开发逐步补充。
 */
import { getToken } from '~/utils/token-cache'

const ADMIN_BASE = '/api/admin/recruitment'

interface ApiOptions {
  method?: string
  body?: any
  params?: Record<string, string>
}

async function adminRequest(path: string, options: ApiOptions = {}) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  let url = `${ADMIN_BASE}${path}`
  if (options.params) {
    const qs = new URLSearchParams(options.params).toString()
    url += `?${qs}`
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

// ─── 平台运营概览 ───

/**
 * 获取招聘平台全局统计
 */
export async function getAdminOverview() {
  return adminRequest('/overview')
}

/**
 * 获取 Agent 配置列表
 */
export async function getAgentConfigs() {
  return adminRequest('/agents')
}

/**
 * 更新 Agent 配置
 */
export async function updateAgentConfig(agentId: string, config: Record<string, unknown>) {
  return adminRequest(`/agents/${agentId}`, {
    method: 'PUT',
    body: config,
  })
}

/**
 * 获取风控审计日志
 */
export async function getAuditLogs(params?: {
  page?: number
  limit?: number
  severity?: string
}) {
  return adminRequest('/audit', { params: params as any })
}

/**
 * 获取 Campaign 列表
 */
export async function getCampaigns(params?: {
  status?: string
  page?: number
  limit?: number
}) {
  return adminRequest('/campaigns', { params: params as any })
}
