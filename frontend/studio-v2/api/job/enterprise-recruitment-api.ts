/**
 * enterprise-recruitment-api.ts — 企业招聘中心 API Client
 *
 * 归属: 企业招聘中心 (Enterprise Recruitment) → /workspace/recruitment
 * 审计: JOB-WORKSPACE-BOUNDARY-AUDIT 2026-07-26 — Phase 2 拆分
 *
 * 职责:
 *   企业侧招聘全部 API: JD 生成/优化、人才匹配、简历解析、面试、人才猎聘
 *   包含旧版 (/api/enterprise/*) 和 P4 新版 (/api/job/match/*)
 *   旧版 API 标记 @deprecated，后续随 P4 迭代逐步淘汰
 *
 * 禁止混入求职者 API 或平台管理 API
 */
import { getToken } from '~/utils/token-cache'

const ENT_BASE = '/api/enterprise'
const MATCH_BASE = '/api/job/match'

interface ApiOptions {
  method?: string
  body?: any
  params?: Record<string, string>
}

async function entRequest(path: string, options: ApiOptions = {}) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  let url = `${ENT_BASE}${path}`
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

// ─── 旧版企业招聘 API (@deprecated — 逐步被 P4 新版替代) ───

/**
 * @deprecated 使用 P4 新版 /api/job/match/* 替代
 * 获取企业招聘空间
 */
export async function getEnterpriseWorkspace(enterpriseId: string) {
  return entRequest('/workspace', { params: { enterpriseId } })
}

/**
 * @deprecated 使用 P4 新版 JD 创建流程替代
 * AI 生成 JD
 */
export async function generateJD(data: {
  enterpriseId: string
  companyName: string
  position: string
  industry?: string
  scale?: string
  salaryRange?: string
  location?: string
  requirements?: string[]
  benefits?: string[]
}) {
  return entRequest('/jd/generate', { method: 'POST', body: data })
}

/**
 * @deprecated 使用 P4 新版 JD 创建流程替代
 * 岗位优化建议
 */
export async function optimizeJob(data: {
  title: string
  description: string
  requirements: string[]
  salary: string
  location: string
}) {
  return entRequest('/jd/optimize', { method: 'POST', body: data })
}

/**
 * @deprecated 使用 P4 新版 matchCandidates 替代
 * 人才匹配
 */
export async function matchCandidates(workspaceId: string, jobId: string) {
  return entRequest('/match', { method: 'POST', body: { workspaceId, jobId } })
}

/**
 * @deprecated 使用 P4 新版替代
 * 获取匹配结果
 */
export async function getMatches(workspaceId: string, jobId?: string) {
  return entRequest('/matches', { params: { workspaceId, ...(jobId ? { jobId } : {}) } })
}

/**
 * @deprecated
 * 更新匹配状态
 */
export async function updateMatchStatus(matchId: string, status: string) {
  return entRequest('/matches/status', { method: 'POST', body: { matchId, status } })
}

/**
 * @deprecated
 * 解析简历
 */
export async function parseResume(data: {
  workspaceId: string
  text: string
  fileName?: string
  candidateName?: string
}) {
  return entRequest('/resume/parse', { method: 'POST', body: data })
}

/**
 * @deprecated
 * 简历与岗位匹配
 */
export async function matchResumeToJob(resumeId: string, jobId: string) {
  return entRequest('/resume/match', { method: 'POST', body: { resumeId, jobId } })
}

/**
 * @deprecated
 * 获取简历列表
 */
export async function getResumes(workspaceId: string) {
  return entRequest('/resumes', { params: { workspaceId } })
}

/**
 * @deprecated
 * 获取简历详情
 */
export async function getResumeDetail(resumeId: string) {
  return entRequest(`/resume/${resumeId}`)
}

/**
 * @deprecated
 * 获取招聘流程列表
 */
export async function getPipeline(workspaceId: string, jobId?: string, stage?: string) {
  return entRequest('/pipeline', { params: { workspaceId, ...(jobId ? { jobId } : {}), ...(stage ? { stage } : {}) } })
}

/**
 * @deprecated
 * 更新招聘流程
 */
export async function updatePipeline(pipelineId: string, data: {
  stage?: string
  screeningScore?: number
  screeningNote?: string
}) {
  return entRequest('/pipeline/update', { method: 'POST', body: { pipelineId, ...data } })
}

/**
 * @deprecated
 * 创建招聘流程
 */
export async function createPipeline(data: {
  workspaceId: string
  jobId: string
  candidateName: string
  resumeId?: string
  stage?: string
}) {
  return entRequest('/pipeline/create', { method: 'POST', body: data })
}

/**
 * @deprecated
 * 获取人才池统计
 */
export async function getTalentPoolStats(workspaceId: string) {
  return entRequest('/talent-pool/stats', { params: { workspaceId } })
}

/**
 * @deprecated
 * 生成面试方案
 */
export async function generateInterviewPlan(data: {
  workspaceId: string
  jobId: string
  candidateName: string
  resumeId?: string
  level?: string
}) {
  return entRequest('/interview/plan', { method: 'POST', body: data })
}

/**
 * @deprecated
 * 获取面试方案详情
 */
export async function getInterviewPlan(sessionId: string) {
  return entRequest(`/interview/plan/${sessionId}`)
}

/**
 * @deprecated
 * 更新面试状态
 */
export async function updateInterviewStatus(sessionId: string, status: string) {
  return entRequest('/interview/status', { method: 'POST', body: { sessionId, status } })
}

/**
 * @deprecated
 * 更新面试问题答案
 */
export async function updateInterviewAnswer(questionId: string, answer: string, score?: number) {
  return entRequest('/interview/answer', { method: 'POST', body: { questionId, answer, score } })
}

/**
 * @deprecated
 * 生成面试评价报告
 */
export async function evaluateInterview(sessionId: string) {
  return entRequest('/interview/evaluate', { method: 'POST', body: { sessionId } })
}

/**
 * @deprecated
 * 获取面试列表
 */
export async function getInterviews(workspaceId: string, jobId?: string, status?: string) {
  return entRequest('/interviews', { params: { workspaceId, ...(jobId ? { jobId } : {}), ...(status ? { status } : {}) } })
}

/**
 * @deprecated
 * 获取面试评价详情
 */
export async function getInterviewEvaluation(sessionId: string) {
  return entRequest(`/interview/evaluation/${sessionId}`)
}

/**
 * @deprecated
 * 获取面试统计
 */
export async function getInterviewStats(workspaceId: string) {
  return entRequest('/interview/stats', { params: { workspaceId } })
}

/**
 * @deprecated
 * AI 人才猎聘搜索
 */
export async function searchTalents(data: {
  workspaceId: string
  enterpriseId: string
  title: string
  description?: string
  skills?: string[]
  city?: string
  salaryMin?: number
  salaryMax?: number
  careerLevel?: string
  education?: string
  experienceYears?: number
  limit?: number
}) {
  return entRequest('/talent/search', { method: 'POST', body: data })
}

/**
 * @deprecated
 */
export async function getTalentRecommendations(taskId?: string, workspaceId?: string) {
  return entRequest('/talent/recommendations', { params: { taskId, workspaceId } })
}

/**
 * @deprecated
 */
export async function getTalentProfile(talentId: string) {
  return entRequest(`/talent/profile/${talentId}`)
}

/**
 * @deprecated
 */
export async function getTalentRelationships(workspaceId: string, stage?: string) {
  return entRequest('/talent/relationships', { params: { workspaceId, stage } })
}

/**
 * @deprecated
 */
export async function updateTalentRelationship(data: {
  workspaceId: string
  enterpriseId: string
  talentId: string
  stage: string
  note?: string
}) {
  return entRequest('/talent/relationship', { method: 'POST', body: data })
}

/**
 * @deprecated
 */
export async function getTalentStats(workspaceId: string) {
  return entRequest('/talent/stats', { params: { workspaceId } })
}

/**
 * @deprecated
 */
export async function getTalentSearchTasks(workspaceId: string) {
  return entRequest('/talent/tasks', { params: { workspaceId } })
}
