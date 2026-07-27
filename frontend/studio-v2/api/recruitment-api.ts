/**
 * recruitment-api.ts — AI 招聘中心 API Client
 *
 * 对接 P4 Recruitment Intelligence 后端 API
 * P4-01 ~ P4-04 ALL FROZEN
 *
 * 所有企业招聘工作台的前后端通信通过此模块进行
 */
import { getToken } from '~/utils/token-cache'

const BASE = '/api/job/match'

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

  let url = `${BASE}${path}`
  if (options.params) {
    const qs = new URLSearchParams(options.params).toString()
    url += `?${qs}`
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body:options.body ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    throw new Error('未登录或登录已过期')
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || `API Error: ${res.status}`)
  }

  return res.json()
}

// ─── Types ───

export interface JobRequirement {
  id: string
  enterpriseId: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'closed'
  requiredSkills?: string[]
  preferredSkills?: string[]
  experienceMin?: number
  experienceMax?: number
  educationLevel?: string
  salaryMin?: number
  salaryMax?: number
  location?: string
  departmentLevel?: string
  jobType?: string
  rawText?: string
  createdAt: string
  updatedAt: string
}

export interface ExtractedRequirement {
  title: string
  description?: string
  requiredSkills: string[]
  preferredSkills: string[]
  experienceMin?: number
  experienceMax?: number
  educationLevel?: string
  salaryMin?: number
  salaryMax?: number
  location?: string
  departmentLevel?: string
  jobType?: string
  modelUsed?: string
}

export interface MatchResult {
  id: string
  jobRequirementId: string
  candidateId: string
  profileId: string
  score: number
  breakdown: {
    skill: number
    experience: number
    education: number
    career: number
  }
  matchedSkills: string[]
  missingSkills: string[]
  skillGap: string[]
  riskFlags: string[]
  reasoning?: string
  reasoningAt?: string
  rank?: number
  rankingVersion?: string
  matchVersion: string
  createdAt: string
}

export interface Evidence {
  id: string
  matchResultId: string
  evidenceType: string
  claim: string
  sourceType: string
  sourceId: string
  confidence: number
}

export interface Explanation {
  resultId: string
  explanation: string
  strengths: string[]
  risks: string[]
  evidenceIds: string[]
  generatedAt: string
  modelUsed?: string
}

export interface BatchJob {
  id: string
  tenantId: string
  jobRequirementId: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  totalCandidates: number
  processedCount: number
  matchedCount: number
  threshold: number
  maxResults: number
  rankingVersion: string
  errorMessage?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

// ─── Job Requirements ───

/**
 * AI 解析 JD → 结构化岗位要求（预览模式，不保存）
 * 调用后端 extractOnly 接口，返回结构化提取结果
 * 后端返回: {valid, errors, warnings, extracted}
 * extracted 字段: requiredSkills, preferredSkills, experienceMin/Max,
 *   educationMin, preferredMajors, industries, employmentType, remoteOption, weights
 */
export async function extractRequirement(jdText: string): Promise<ExtractedRequirement> {
  // 智能拆分：第一行作为 title，其余作为 description
  const lines = jdText.trim().split('\n').filter(l => l.trim())
  const title = lines[0]?.trim() || '未命名岗位'
  const description = lines.length > 1 ? lines.slice(1).join('\n').trim() : lines[0]?.trim() || ''

  const result = await request('/requirements/validate', {
    method: 'POST',
    body: {
      jobTitle: title,
      jobDescription: description,
      language: 'zh',
    },
  })

  const extracted = result.extracted || {}
  const mapLevel = (level: string | number | undefined): number => {
    if (typeof level === 'number') return level
    const map: Record<string, number> = { beginner: 1, intermediate: 2, proficient: 3, advanced: 3, expert: 4 }
    return map[level || ''] || 2
  }

  return {
    title,
    description,
    requiredSkills: (extracted.requiredSkills || []).map((s: any) =>
      typeof s === 'string' ? s : (s.name || s)
    ),
    preferredSkills: (extracted.preferredSkills || []).map((s: any) =>
      typeof s === 'string' ? s : (s.name || s)
    ),
    experienceMin: extracted.experienceMin,
    experienceMax: extracted.experienceMax,
    educationLevel: extracted.educationMin,
    salaryMin: undefined,
    salaryMax: undefined,
    location: undefined,
    departmentLevel: undefined,
    employmentType: extracted.employmentType,
    modelUsed: result.modelUsed || 'template',
  }
}

/**
 * 验证 JD（不保存）
 * 与 extractRequirement 使用同一个后端接口，返回原始 {valid, errors, warnings, extracted}
 */
export async function validateRequirement(jdText: string): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
  extracted?: any
}> {
  const lines = jdText.trim().split('\n').filter(l => l.trim())
  const title = lines[0]?.trim() || '未命名岗位'
  const description = lines.length > 1 ? lines.slice(1).join('\n').trim() : lines[0]?.trim() || ''

  return request('/requirements/validate', {
    method: 'POST',
    body: {
      jobTitle: title,
      jobDescription: description,
      language: 'zh',
    },
  })
}

/**
 * 创建岗位要求
 * 将前端字段名映射到后端字段名
 */
export async function createRequirement(data: Partial<JobRequirement> & { title?: string; description?: string; educationLevel?: string }): Promise<JobRequirement> {
  return request('/requirements', {
    method: 'POST',
    body: {
      jobTitle: data.jobTitle || data.title || '',
      jobDescription: data.jobDescription || data.description,
      requiredSkills: data.requiredSkills,
      preferredSkills: data.preferredSkills,
      experienceMin: data.experienceMin,
      experienceMax: data.experienceMax,
      educationMin: data.educationMin || data.educationLevel,
      preferredMajors: data.preferredMajors,
      industries: data.industries,
      employmentType: data.employmentType,
      location: data.location,
      remoteOption: data.remoteOption,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
      weights: data.weights,
      status: data.status,
      rawText: data.rawText,
    },
  })
}

/**
 * 获取岗位要求详情
 */
export async function getRequirement(id: string): Promise<JobRequirement> {
  return request(`/requirements/${id}`)
}

/**
 * 更新岗位要求
 */
export async function updateRequirement(id: string, data: Partial<JobRequirement>): Promise<JobRequirement> {
  return request(`/requirements/${id}`, {
    method: 'PUT',
    body: data,
  })
}

/**
 * 获取企业的岗位要求列表
 */
export async function listRequirements(): Promise<JobRequirement[]> {
  const res = await request('/requirements')
  // API 返回 { total, requirements }，需要解包
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.requirements)) return res.requirements
  return []
}

// ─── Job Posting (Enterprise) ───
// 对接 POST /api/enterprise/postings（企业岗位 CRUD）

/**
 * 创建企业岗位（JobPosting）
 * 后端自动从 JWT 解析 enterpriseId，禁止前端传入
 */
export async function createPosting(data: {
  title: string
  description?: string
  requirements?: string
  salary?: string
  location?: string
  skillRequirements?: string[]
  tags?: string[]
  industry?: string
  careerPath?: string
  status?: 'draft' | 'published' | 'paused' | 'closed'
}): Promise<any> {
  const token = getToken()
  const res = await fetch('/api/enterprise/postings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || `API Error: ${res.status}`)
  }

  return res.json()
}

// ─── Enterprise Candidates ───

/**
 * 获取企业候选人列表
 * 返回该企业所有岗位匹配的候选人（按匹配分降序）
 */
export async function listEnterpriseCandidates(): Promise<{
  success: boolean
  candidates: any[]
  total: number
}> {
  const token = getToken()
  const res = await fetch('/api/enterprise/candidates', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('auth_token')
        window.location.href = '/login'
      }
      throw new Error('未登录或登录已过期')
    }
    throw new Error(`API Error: ${res.status}`)
  }
  return res.json()
}

// ─── Job Posting Status ───

/**
 * 更新岗位状态
 * 支持: draft→published, published→paused, paused→published, published/paused→closed
 */
export async function updatePostingStatus(
  postingId: string,
  status: 'draft' | 'published' | 'paused' | 'closed'
): Promise<any> {
  const token = getToken()
  const res = await fetch(`/api/enterprise/postings/${postingId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ status }),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || `API Error: ${res.status}`)
  }

  return res.json()
}

// ─── Batch Matching ───

/**
 * 触发批量匹配
 */
export async function triggerBatchMatch(jobRequirementId: string, options?: {
  threshold?: number
  maxResults?: number
}): Promise<BatchJob> {
  return request('/batch', {
    method: 'POST',
    body: { jobRequirementId, ...options },
  })
}

/**
 * 查询批量匹配状态
 */
export async function getBatchStatus(batchId: string): Promise<BatchJob> {
  return request(`/batch/${batchId}`)
}

/**
 * 获取批量匹配结果（排名后）
 */
export async function getBatchResults(batchId: string): Promise<{
  batch: BatchJob
  results: MatchResult[]
}> {
  return request(`/batch/${batchId}/results`)
}

/**
 * 列出企业的批量匹配任务
 */
export async function listBatchJobs(): Promise<BatchJob[]> {
  const res = await request('/batch/list')
  // API 返回 { jobs: [...] }，需要解包
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.jobs)) return res.jobs
  return []
}

/**
 * 删除批量匹配任务
 */
export async function deleteBatchJob(batchId: string): Promise<void> {
  return request(`/batch/${batchId}`, { method: 'DELETE' })
}

// ─── Match Results ───

/**
 * 获取匹配结果详情
 */
export async function getMatchResult(id: string): Promise<MatchResult> {
  return request(`/results/${id}`)
}

/**
 * 获取岗位的所有匹配结果
 */
export async function getRequirementResults(requirementId: string): Promise<MatchResult[]> {
  return request(`/requirements/${requirementId}/results`)
}

/**
 * 获取证据链
 */
export async function getEvidenceChain(resultId: string): Promise<Evidence[]> {
  return request(`/evidence/${resultId}`)
}

// ─── Explanation ───

/**
 * 获取 AI 匹配解释
 */
export async function getExplanation(resultId: string): Promise<Explanation> {
  return request(`/explanation/${resultId}`)
}

/**
 * 获取模板匹配解释（无 LLM）
 */
export async function getTemplateExplanation(resultId: string): Promise<Explanation> {
  return request(`/explanation/${resultId}/template`)
}

// ─── Skills ───

/**
 * 获取技能词汇表
 */
export async function getSkillVocabulary(): Promise<{ skills: string[] }> {
  return request('/skills/vocabulary')
}

// ─── Talent Agent (Sprint-07B-2) ───

/**
 * 候选人深度分析
 */
export async function analyzeCandidate(candidateId: string): Promise<{
  success: boolean
  result: any
}> {
  const token = getToken()
  const res = await fetch('/api/enterprise/agents/talent/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ candidateId }),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

/**
 * 匹配分解释
 */
export async function explainMatch(matchId: string): Promise<{
  success: boolean
  result: any
}> {
  const token = getToken()
  const res = await fetch('/api/enterprise/agents/talent/explain', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ matchId }),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

/**
 * 候选人搜索推荐
 */
export async function searchTalent(jobId: string, limit?: number): Promise<{
  success: boolean
  result: any
}> {
  const token = getToken()
  const res = await fetch('/api/enterprise/agents/talent/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jobId, limit }),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

// ─── Interview Agent (Sprint-07B-3) ───

/**
 * 生成面试问题
 */
export async function generateInterviewQuestions(jobId: string, candidateId: string): Promise<{
  success: boolean
  result: any
}> {
  const token = getToken()
  const res = await fetch('/api/enterprise/agents/interview/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jobId, candidateId }),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

/**
 * 追问建议
 */
export async function suggestInterviewFollowUp(
  sessionId: string,
  lastQuestion: string,
  lastAnswer: string
): Promise<{
  success: boolean
  result: any
}> {
  const token = getToken()
  const res = await fetch('/api/enterprise/agents/interview/followup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ sessionId, lastQuestion, lastAnswer }),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

/**
 * 面试总结
 */
export async function summarizeInterview(sessionId: string): Promise<{
  success: boolean
  result: any
}> {
  const token = getToken()
  const res = await fetch('/api/enterprise/agents/interview/summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ sessionId }),
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

/**
 * Interview Agent 状态查询
 */
export async function getInterviewAgentStatus(): Promise<{
  success: boolean
  agent: any
  llmConfigured: boolean
  llmProvider: string | null
  llmModel: string | null
}> {
  const token = getToken()
  const res = await fetch('/api/enterprise/agents/interview/status', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

/**
 * Talent Agent 状态查询
 */
export async function getTalentAgentStatus(): Promise<{
  success: boolean
  agent: any
  llmConfigured: boolean
  llmProvider: string | null
  llmModel: string | null
}> {
  const token = getToken()
  const res = await fetch('/api/enterprise/agents/talent/status', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}
