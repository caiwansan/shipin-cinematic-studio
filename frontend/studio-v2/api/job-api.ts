/**
 * job-api.ts — 昆仑镜 AI 求职招聘工作台 API Client
 *
 * 审计: JOB-WORKSPACE-BOUNDARY-AUDIT 2026-07-26 — Phase 2 拆分完成
 *
 * ⚠️ 此文件现为兼容入口（re-export），新代码请直接引用拆分后的文件：
 *   - ~/studio-v2/api/job/candidate-api.ts         — 求职者 API
 *   - ~/studio-v2/api/job/enterprise-recruitment-api.ts — 企业招聘 API
 *   - ~/studio-v2/api/job/admin-recruitment-api.ts — 平台管理 API
 *   - ~/studio-v2/api/recruitment-api.ts           — P4 新版匹配 API
 *
 * 旧 import 保持兼容，后续逐步迁移到新路径后删除本文件。
 */

// ─── 求职者 API ───
export {
  chatWithCareerAgent,
  getCandidateProfile,
  updateCandidateProfile,
  getJobRecommendations,
  submitJobFeedback,
  getCareerProfileCenter,
  getJobNews,
  getJobStatistics,
} from '~/studio-v2/api/job/candidate-api'

export type { ChatRequest, ChatMessage } from '~/studio-v2/api/job/candidate-api'

// ─── 企业招聘 API（旧版，@deprecated） ───
export {
  getEnterpriseWorkspace,
  generateJD,
  optimizeJob,
  matchCandidates,
  getMatches,
  updateMatchStatus,
  parseResume,
  matchResumeToJob,
  getResumes,
  getResumeDetail,
  getPipeline,
  updatePipeline,
  createPipeline,
  getTalentPoolStats,
  generateInterviewPlan,
  getInterviewPlan,
  updateInterviewStatus,
  updateInterviewAnswer,
  evaluateInterview,
  getInterviews,
  getInterviewEvaluation,
  getInterviewStats,
  searchTalents,
  getTalentRecommendations,
  getTalentProfile,
  getTalentRelationships,
  updateTalentRelationship,
  getTalentStats,
  getTalentSearchTasks,
} from '~/studio-v2/api/job/enterprise-recruitment-api'

// ─── 旧版岗位管理 API（@deprecated） ───
// 以下函数已从 candidate-api / enterprise-recruitment-api 中移除，
// 保留 re-export 以兼容旧调用方，后续逐步迁移。
import { getToken } from '~/utils/token-cache'

const BASE_URL = '/api/job'

/** @deprecated 使用 P4 新版 /api/job/match/requirements 替代 */
export async function getJobPostings(params?: {
  city?: string
  status?: string
  page?: number
  limit?: number
}) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  let url = `${BASE_URL}/postings`
  if (params) {
    const qs = new URLSearchParams(params as any).toString()
    url += `?${qs}`
  }
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

/** @deprecated 使用 P4 新版 JD 创建流程替代 */
export async function createJobPosting(posting: {
  enterpriseId: string
  title: string
  salary?: string
  location?: string
  description?: string
  requirements?: string
}) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${BASE_URL}/postings`, {
    method: 'POST',
    headers,
    body: JSON.stringify(posting),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

/** @deprecated 使用 P4 新版替代 */
export async function analyzeResumes(jobId: string, resumes: any[]) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${BASE_URL}/resume/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jobId, resumes }),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

/** @deprecated 使用 P4 新版替代 */
export async function generateInterviewGuide(jobId: string, candidateId: string) {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${BASE_URL}/interview/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jobId, candidateId }),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}
