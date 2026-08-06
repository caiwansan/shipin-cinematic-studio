/**
 * S3.3.2 Skill Orchestrator（Planner, Cloud Control Plane）— 生产级编排增强
 * 依据: S3.3.2 掌柜执行指令 Task 02-04 + S3 Final Archive F1-F7 + S3.3.2-PRE-AUDIT.md
 * Task 02 Execution Reliability:  per-step timeout / retry(maxAttempts+backoff) / plan deadline / 错误分类
 * Task 03 DAG Enhancement:        level 并行（独立 step 同层并发）+ 依赖失败 → SKIPPED(DEPENDENCY_FAILED)
 * Task 04 Audit Enhancement:      plan 级 + step 级明细（duration/failureReason/attempts/errorType/executionId），
 *                                 复用 KernelEvent，零新表
 * 宪法保持: Planner=Cloud / SkillPlan=纯内存 DAG / Hermes=原子执行者（生命周期零修改）/ KernelEvent=审计权威
 */
import type { SkillDefinition } from './skill-manifest-adapter.js'
import { prisma } from '../utils/index.js'

/** 组合状态机（掌柜冻结, 不改变） */
export type PlanStatus =
  | 'CREATED'
  | 'PLANNING'
  | 'RUNNING'
  | 'PARTIAL_COMPLETED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
export type FailurePolicy = 'STOP' | 'SKIP' | 'CONTINUE'

/** Task 02: Step 错误分类（transient 可重试 / deterministic 不重试） */
export type StepErrorType =
  | 'SKILL_NOT_FOUND'
  | 'AUTHORIZATION_DENIED'
  | 'POLICY_REJECTED'
  | 'HERMES_UNREACHABLE'
  | 'TIMEOUT'
  | 'HERMES_ERROR'
  | 'DEPENDENCY_FAILED'
  | 'DEADLINE_EXCEEDED'
  | 'UNKNOWN'

const RETRYABLE: StepErrorType[] = ['TIMEOUT', 'HERMES_UNREACHABLE', 'HERMES_ERROR', 'UNKNOWN']

export interface RetryConfig {
  maxAttempts: number
  backoffMs: number
}

export interface SkillPlanStep {
  stepId: string
  skillId: string
  tool: string
  input: any
  dependsOn: string[]
  status: StepStatus
  result: any
  error: string | null
  errorType: StepErrorType | null
  attempts: number
  durationMs: number
  /** Hermes 原子执行 executionId（step 级审计关联） */
  executionId: string | null
  /** per-step 覆盖 */
  timeoutMs?: number
  retry?: Partial<RetryConfig>
  /** 前序步骤输出映射（S3.4 Final Task 02） */
  inputMap?: Record<string, { from: string; path?: string }>
}

export interface SkillPlan {
  planId: string
  employeeDefinitionId: string | null
  skillSet: string[]
  fallback: { onFailure: FailurePolicy }
  status: PlanStatus
  steps: SkillPlanStep[]
  failureReason: string | null
  timeoutMs: number
  deadlineMs: number
  retry: RetryConfig
  maxParallel: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface PlanStepInput {
  stepId?: string
  skillId: string
  tool: string
  input?: any
  dependsOn?: string[]
  timeoutMs?: number
  retry?: Partial<RetryConfig>
  /** S3.4 Final Task 02: 前序步骤输出 → 本步骤输入映射（仅限 dependsOn 依赖, 真实数据流） */
  inputMap?: Record<string, { from: string; path?: string }>
}

export interface ExecutePlanOptions {
  employeeDefinitionId?: string | null
  steps: PlanStepInput[]
  fallback?: FailurePolicy
  timeoutMs?: number
  deadlineMs?: number
  retry?: Partial<RetryConfig>
  maxParallel?: number
  /** S4.1: 租户身份（BYOK 路由）; S4.2: 商业执行需经 Entitlement Gate */
  tenantUserId?: string | null
}

const HERMES_SKILL_RUNTIME_URL = process.env.HERMES_SKILL_RUNTIME_URL || 'http://127.0.0.1:9457'
const AUDIT_URL = process.env.KUNLUN_AUDIT_URL || 'http://127.0.0.1:4002/api/audit/hermes-execution'
const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_DEADLINE_MS = 60000
const DEFAULT_RETRY: RetryConfig = { maxAttempts: 2, backoffMs: 200 }
const DEFAULT_MAX_PARALLEL = 8

/** Kahn 拓扑排序（纯函数）; 有环 → null */
export function topoSortSteps(steps: { stepId: string; dependsOn: string[] }[]): string[] | null {
  const ids = new Set(steps.map((s) => s.stepId))
  const indeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const s of steps) {
    indeg.set(s.stepId, 0)
    adj.set(s.stepId, [])
  }
  for (const s of steps) {
    for (const dep of s.dependsOn) {
      if (!ids.has(dep) || dep === s.stepId) return null
      indeg.set(s.stepId, (indeg.get(s.stepId) || 0) + 1)
      adj.get(dep)!.push(s.stepId)
    }
  }
  const queue = steps.filter((s) => indeg.get(s.stepId) === 0).map((s) => s.stepId)
  const order: string[] = []
  while (queue.length) {
    const cur = queue.shift()!
    order.push(cur)
    for (const next of adj.get(cur) || []) {
      const d = indeg.get(next)! - 1
      indeg.set(next, d)
      if (d === 0) queue.push(next)
    }
  }
  return order.length === steps.length ? order : null
}

/** Task 03: 按拓扑序分层（同层 step 相互独立, 可并行） */
export function buildLevels(steps: { stepId: string; dependsOn: string[] }[], order: string[]): string[][] {
  const byId = new Map(steps.map((s) => [s.stepId, s]))
  const indeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const s of steps) {
    indeg.set(s.stepId, s.dependsOn.length)
    adj.set(s.stepId, [])
  }
  for (const s of steps) {
    for (const dep of s.dependsOn) adj.get(dep)!.push(s.stepId)
  }
  const levels: string[][] = []
  const remaining = new Set(order)
  while (remaining.size) {
    const level = order.filter((id) => remaining.has(id) && indeg.get(id) === 0)
    if (!level.length) break // 防御: 环已由 topoSort 拒绝
    levels.push(level)
    for (const id of level) {
      remaining.delete(id)
      for (const next of adj.get(id) || []) indeg.set(next, indeg.get(next)! - 1)
    }
  }
  return levels
}

/** 组合状态合成（纯函数, Q4 冻结语义） */
export function composePlanStatus(steps: { status: StepStatus }[], onFailure: FailurePolicy): PlanStatus {
  const finished = steps.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED')
  const failed = steps.some((s) => s.status === 'FAILED')
  if (finished && !failed) return 'COMPLETED'
  if (failed) {
    if (onFailure === 'STOP') return 'FAILED'
    return 'PARTIAL_COMPLETED'
  }
  return 'RUNNING'
}

/** SkillPlan 校验（纯函数）— 能力绑定（F1）+ DAG 合法性 */
export function validatePlan(input: {
  steps: PlanStepInput[]
  employeeSkillSet: string[] | null
}): { ok: boolean; errors: string[]; orderedStepIds: string[] | null } {
  const errors: string[] = []
  if (!input.steps.length) errors.push('EMPTY_STEPS')
  const seen = new Set<string>()
  for (const s of input.steps) {
    const stepId = s.stepId || s.skillId + ':' + s.tool
    if (seen.has(stepId)) errors.push(`DUPLICATE_STEP:${stepId}`)
    seen.add(stepId)
    if (!s.skillId || !s.tool) errors.push(`INVALID_STEP:${stepId}`)
    if (input.employeeSkillSet && !input.employeeSkillSet.includes(s.skillId)) {
      errors.push(`SKILL_NOT_BOUND:${s.skillId}（不在员工能力集内, F1）`)
    }
    if (s.inputMap) {
      const deps = new Set(s.dependsOn || [])
      for (const field of Object.keys(s.inputMap)) {
        const from = s.inputMap[field].from
        if (!deps.has(from)) {
          errors.push(`INPUT_MAP_NOT_DEPENDENCY:${s.stepId || s.skillId}:${field}→${from}（数据源必须是 dependsOn 依赖）`)
        }
      }
    }
  }
  const norm = input.steps.map((s) => ({ stepId: s.stepId || s.skillId + ':' + s.tool, dependsOn: s.dependsOn || [] }))
  const orderedStepIds = topoSortSteps(norm)
  if (orderedStepIds === null) errors.push('DAG_CYCLE_OR_BAD_DEPENDENCY')
  return { ok: errors.length === 0, errors, orderedStepIds }
}

/** 创建 SkillPlan（纯内存对象, OC-0.2 — 零入库） */
export function createSkillPlan(input: {
  employeeDefinitionId: string | null
  skillSet: string[]
  fallback: FailurePolicy
  steps: PlanStepInput[]
  timeoutMs: number
  deadlineMs: number
  retry: RetryConfig
  maxParallel: number
}): SkillPlan {
  return {
    planId: 'plan-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    employeeDefinitionId: input.employeeDefinitionId,
    skillSet: input.skillSet,
    fallback: { onFailure: input.fallback },
    status: 'CREATED',
    steps: input.steps.map((s) => ({
      stepId: s.stepId || s.skillId + ':' + s.tool,
      skillId: s.skillId,
      tool: s.tool,
      input: s.input ?? {},
      dependsOn: s.dependsOn || [],
      status: 'PENDING' as StepStatus,
      result: null,
      error: null,
      errorType: null,
      attempts: 0,
      durationMs: 0,
      executionId: null,
      timeoutMs: s.timeoutMs,
      retry: s.retry,
      inputMap: s.inputMap,
    })),
    failureReason: null,
    timeoutMs: input.timeoutMs,
    deadlineMs: input.deadlineMs,
    retry: input.retry,
    maxParallel: input.maxParallel,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  }
}

/** 员工 Skill Set 视图（OC1: 多 Skill 绑定视图; F1: 能力来自 AgentDefinition.capabilities） */
export async function getEmployeeSkillSet(employeeCode: string): Promise<{
  code: string
  name: string
  capabilities: string[]
  skills: SkillDefinition[]
} | null> {
  const { prisma } = await import('../utils/index.js')
  const { listSkills } = await import('./skill-manifest-adapter.js')
  const emp = await prisma.agentDefinition.findUnique({ where: { code: employeeCode } }).catch(() => null)
  if (!emp) return null
  const caps = (() => {
    try { return JSON.parse(emp.capabilities) } catch { return [] }
  })()
  const capsArr = Array.isArray(caps) ? caps : [caps]
  const all = await listSkills()
  // 自排除: 员工自身定义不作为其 Skill Set 成员
  const skills = all.filter((s) => s.id !== employeeCode && s.capabilities.some((c) => capsArr.includes(c)))
  return { code: emp.code, name: emp.name, capabilities: capsArr, skills }
}

/** Task 02: 单步执行（Hermes 原子调用, OC3; 每 Skill 独立授权, OC2; timeout+retry+错误分类） */
async function runStep(
  step: SkillPlanStep,
  agentDefinitionId: string | null,
  planCfg: { timeoutMs: number; retry: RetryConfig },
): Promise<{ ok: boolean; result?: any; error?: string; errorType: StepErrorType; attempts: number; executionId: string | null; durationMs: number }> {
  const timeoutMs = step.timeoutMs ?? planCfg.timeoutMs
  const retry: RetryConfig = { ...planCfg.retry, ...(step.retry || {}) }
  let lastError = 'UNKNOWN'
  let lastType: StepErrorType = 'UNKNOWN'
  let lastExecutionId: string | null = null
  let attempts = 0
  const totalStarted = Date.now()

  for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
    attempts = attempt
    const { prepareSkillExecution } = await import('./skill-execution-adapter.js')
    const intent = await prepareSkillExecution({ skillId: step.skillId, agentDefinitionId: agentDefinitionId ?? step.skillId })
    if (!intent) {
      lastType = 'SKILL_NOT_FOUND'
      lastError = 'SKILL_NOT_FOUND'
      break // deterministic, 不重试
    }
    if (!intent.allowed || !intent.runtimePolicy) {
      lastType = 'AUTHORIZATION_DENIED'
      lastError = `${intent.authorizationState}:${intent.reason}`
      break // deterministic, 不重试
    }

    const res = await fetch(`${HERMES_SKILL_RUNTIME_URL}/invocations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invocationId: 'step-' + step.stepId,
        skillId: step.skillId,
        agentDefinitionId,
        tool: step.tool,
        input: step.input,
        policy: intent.runtimePolicy,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    }).catch((e: any) => (e?.name === 'AbortError' || e?.name === 'TimeoutError' ? ({ aborted: true } as const) : null))
    if (!res) {
      lastType = 'HERMES_UNREACHABLE'
      lastError = 'HERMES_UNREACHABLE'
      // transient, 可重试
    } else if ('aborted' in res) {
      lastType = 'TIMEOUT'
      lastError = 'TIMEOUT'
    } else {
      const body = await res.json().catch(() => ({}))
      if (body.status === 'POLICY_REJECTED') {
        lastType = 'POLICY_REJECTED'
        lastError = `POLICY_REJECTED:${body.tool}`
        break // deterministic, 不重试
      }
      if (body.status !== 'COMPLETED') {
        lastType = 'HERMES_ERROR'
        lastError = body.status || 'HERMES_ERROR'
      } else if (body.result && body.result.ok === false) {
        // 工具级失败（如 mock.flaky 的 transient 失败）
        lastType = 'HERMES_ERROR'
        lastError = body.result.error || 'TOOL_FAILED'
      } else {
        return {
          ok: true,
          result: body.result,
          errorType: 'UNKNOWN',
          attempts,
          executionId: body.executionId ?? null,
          durationMs: Date.now() - totalStarted,
        }
      }
      lastExecutionId = body.executionId ?? lastExecutionId
    }
    if (attempt < retry.maxAttempts && RETRYABLE.includes(lastType)) {
      await new Promise((r) => setTimeout(r, retry.backoffMs * attempt))
    } else {
      break
    }
  }
  return { ok: false, error: lastError, errorType: lastType, attempts, executionId: lastExecutionId, durationMs: Date.now() - totalStarted }
}

/**
 * S3.4 Final Task 02: 前序步骤输出 → 本步骤输入解析（纯函数, 真实数据流）
 * results: Map<stepId, step>; path 为点路径（如 'result.profile'）
 * 只合并 inputMap 声明字段; 未找到源字段则保持原输入
 */
export function resolveStepInput(step: SkillPlanStep, results: Map<string, any>): any {
  const input = { ...(step.input || {}) }
  if (!step.inputMap) return input
  for (const [field, spec] of Object.entries(step.inputMap)) {
    const src = results.get(spec.from)
    if (!src) continue
    let value: any = src
    if (spec.path) {
      value = spec.path.split('.').reduce((acc: any, k: string) => (acc == null ? acc : acc[k]), src)
    }
    if (value !== undefined) input[field] = value
  }
  return input
}

/** Task 03: 并行执行一个 level（同层独立 step 并发, 受 maxParallel 限制） */
async function runLevel(
  level: string[],
  plan: SkillPlan,
  agentDefinitionId: string | null,
): Promise<void> {
  for (let i = 0; i < level.length; i += plan.maxParallel) {
    const chunk = level.slice(i, i + plan.maxParallel)
    // 构建已完成步骤结果表（供 inputMap 数据流解析）
    const resultsMap = new Map<string, any>()
    for (const s of plan.steps) {
      if (s.status === 'COMPLETED') resultsMap.set(s.stepId, s)
    }
    await Promise.all(
      chunk.map(async (stepId) => {
        const step = plan.steps.find((s) => s.stepId === stepId)!
        // 依赖失败处理: 依赖 FAILED/SKIPPED → 本 step SKIPPED
        const depStatuses = step.dependsOn.map((d) => plan.steps.find((s) => s.stepId === d)?.status)
        if (depStatuses.some((st) => st === 'FAILED' || st === 'SKIPPED')) {
          step.status = 'SKIPPED'
          step.errorType = 'DEPENDENCY_FAILED'
          step.error = 'DEPENDENCY_FAILED'
          return
        }
        step.status = 'RUNNING'
        // 真实数据流: 前序输出合并进本步输入（inputMap）
        const mergedInput = resolveStepInput(step, resultsMap)
        const out = await runStep({ ...step, input: mergedInput }, agentDefinitionId, { timeoutMs: plan.timeoutMs, retry: plan.retry })
        step.attempts = out.attempts
        step.executionId = out.executionId
        step.durationMs = out.durationMs
        if (out.ok) {
          step.status = 'COMPLETED'
          step.result = out.result
        } else {
          step.status = 'FAILED'
          step.error = out.error ?? null
          step.errorType = out.errorType
        }
      }),
    )
  }
}

/**
 * S4.2 Task 02/03: 企业 Entitlement 校验（Cloud 侧, 执行入口 Gate）
 * 语义: 企业购买员工 = EnterpriseEntitlement.capabilityCodes 含员工 code（License 最小语义）
 * 禁止: Skill/Desktop 判断授权（授权判定只在 Cloud 执行入口）
 */
export async function checkEmployeeEntitlement(
  tenantUserId: string,
  employeeCode: string,
): Promise<{ allowed: boolean; reason: string }> {
  const { getOrganizationIdForUser } = await import('../services/enterprise/organization/identity-bootstrap.service.js')
  const orgId = await getOrganizationIdForUser(tenantUserId).catch(() => null)
  if (!orgId) return { allowed: false, reason: 'NO_ORGANIZATION' }
  const ent = await prisma.enterpriseEntitlement
    .findFirst({ where: { organizationId: orgId, status: 'active' }, orderBy: { createdAt: 'desc' } })
    .catch(() => null)
  if (!ent) return { allowed: false, reason: 'NO_ENTITLEMENT' }
  const denied = parseJsonArr(ent.capabilityDeniedCodes)
  if (denied.includes(employeeCode)) return { allowed: false, reason: `EMPLOYEE_DENIED:${employeeCode}` }
  const codes = parseJsonArr(ent.capabilityCodes)
  if (!codes.length || !codes.includes(employeeCode)) return { allowed: false, reason: `EMPLOYEE_NOT_ENTITLED:${employeeCode}` }
  return { allowed: true, reason: 'OK' }
}

function parseJsonArr(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string')
  try {
    const p = JSON.parse(raw)
    return Array.isArray(p) ? p.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * S4.2 Task 05: Usage Meter（复用 InvocationLog + KernelEvent, 零新统计体系）
 * 回答: 谁调用 / 什么能力 / 执行次数 / 结果是否成功
 */
export async function getEmployeeUsageMeter(
  tenantUserId: string,
  employeeCode: string,
): Promise<{
  employeeCode: string
  executions: number
  successful: number
  failed: number
  skills: Record<string, number>
  byCaller: Record<string, number>
  recent: { at: string; tool: string; status: string }[]
}> {
  const events = await prisma.kernelEvent
    .findMany({ where: { eventType: 'hermes.execution' }, orderBy: { createdAt: 'desc' }, take: 500 })
    .catch(() => [])
  const mine = (events as any[]).filter((e) => {
    const p = e.payload || {}
    return p.definitionId === employeeCode || (p.agentId || '').includes(employeeCode)
  })
  const executions = mine.length
  const successful = mine.filter((e) => e.payload?.status === 'completed').length
  const failed = executions - successful
  const skills: Record<string, number> = {}
  for (const e of mine) {
    for (const tc of e.payload?.toolCalls || []) {
      if (tc?.tool) skills[tc.tool] = (skills[tc.tool] || 0) + 1
    }
  }
  const byCaller: Record<string, number> = {}
  const logs = await prisma.invocationLog
    .findMany({ where: { userId: tenantUserId }, orderBy: { createdAt: 'desc' }, take: 100 })
    .catch(() => [])
  for (const l of logs as any[]) {
    const key = l.provider || 'unknown'
    byCaller[key] = (byCaller[key] || 0) + 1
  }
  const recent = mine.slice(0, 10).map((e) => ({
    at: e.createdAt ? new Date(e.createdAt).toISOString() : '',
    tool: (e.payload?.toolCalls?.[0]?.tool) || '',
    status: e.payload?.status || '',
  }))
  return { employeeCode, executions, successful, failed, skills, byCaller, recent }
}

/** 执行 SkillPlan（编排层）: 生成 → 分层并行执行 → 聚合状态 → Cloud Audit → 返回（意图即弃, Q3） */
export async function executeSkillPlan(input: ExecutePlanOptions): Promise<{ plan: SkillPlan; errors: string[] }> {
  const onFailure: FailurePolicy = input.fallback || 'STOP'
  const employeeDefinitionId = input.employeeDefinitionId ?? null
  const timeoutMs = input.timeoutMs || DEFAULT_TIMEOUT_MS
  const deadlineMs = input.deadlineMs || DEFAULT_DEADLINE_MS
  const retry: RetryConfig = { ...DEFAULT_RETRY, ...(input.retry || {}) }
  const maxParallel = input.maxParallel || DEFAULT_MAX_PARALLEL

  // 员工能力集（F1: 绑定校验）
  let employeeSkillSet: string[] | null = null
  if (employeeDefinitionId) {
    const emp = await getEmployeeSkillSet(employeeDefinitionId)
    if (!emp) return { plan: null as any, errors: [`EMPLOYEE_NOT_FOUND:${employeeDefinitionId}`] }
    employeeSkillSet = emp.skills.map((s) => s.id)
  }

  // 校验 + 拓扑序 + 分层
  const v = validatePlan({ steps: input.steps, employeeSkillSet })
  if (!v.ok) return { plan: null as any, errors: v.errors }

  // S4.2 Task 03: Entitlement Gate（Cloud 执行入口; 仅企业身份的执行路径）
  // 无 tenantUserId / 无 employeeDefinitionId = 非商业路径（dev/内部, 行为保持）
  if (employeeDefinitionId && input.tenantUserId) {
    const ent = await checkEmployeeEntitlement(input.tenantUserId, employeeDefinitionId)
    if (!ent.allowed) {
      return { plan: null as any, errors: [`ENTITLEMENT_DENIED:${ent.reason}`] }
    }
    // S4.4 P0: 执行身份统一 = 入口解析身份（JWT）; 防 step input 身份注入
    // 客户端不可经 step.input.tenantUserId 伪造租户（BYOK 路由/InvocationLog 归属随此身份）
    for (const s of input.steps) {
      if (s.input && typeof s.input === 'object') {
        ;(s.input as any).tenantUserId = input.tenantUserId
      }
    }
  }

  const plan = createSkillPlan({
    employeeDefinitionId,
    skillSet: employeeSkillSet ?? Array.from(new Set(input.steps.map((s) => s.skillId))),
    fallback: onFailure,
    steps: input.steps,
    timeoutMs,
    deadlineMs,
    retry,
    maxParallel,
  })
  plan.status = 'PLANNING'
  plan.startedAt = new Date().toISOString()
  const planStart = Date.now()
  const levels = buildLevels(
    input.steps.map((s) => ({ stepId: s.stepId || s.skillId + ':' + s.tool, dependsOn: s.dependsOn || [] })),
    v.orderedStepIds!,
  )

  // 分层执行（同层并行, 层间顺序 = DAG 依赖）
  plan.status = 'RUNNING'
  let deadlineHit = false
  for (const level of levels) {
    if ((plan.status as PlanStatus) === 'FAILED' || (plan.status as PlanStatus) === 'CANCELLED') {
      for (const s of plan.steps) if (s.status === 'PENDING') { s.status = 'SKIPPED'; s.errorType = 'DEADLINE_EXCEEDED' }
      break
    }
    if (Date.now() - planStart > deadlineMs) {
      deadlineHit = true
      plan.status = 'FAILED'
      plan.failureReason = 'DEADLINE_EXCEEDED'
      for (const s of plan.steps) if (s.status === 'PENDING') { s.status = 'SKIPPED'; s.errorType = 'DEADLINE_EXCEEDED'; s.error = 'DEADLINE_EXCEEDED' }
      break
    }
    await runLevel(level, plan, employeeDefinitionId)
    if (Date.now() - planStart > deadlineMs) {
      deadlineHit = true
      plan.status = 'FAILED'
      plan.failureReason = 'DEADLINE_EXCEEDED'
    }
    // STOP 策略: 层内出现失败 → 终止
    if (onFailure === 'STOP' && level.some((id) => plan.steps.find((s) => s.stepId === id)?.status === 'FAILED')) {
      const failedStep = plan.steps.find((s) => s.status === 'FAILED')
      plan.status = 'FAILED'
      plan.failureReason = failedStep ? `${failedStep.errorType}:${failedStep.error}` : 'STEP_FAILED'
      for (const s of plan.steps) if (s.status === 'PENDING') { s.status = 'SKIPPED'; s.error = 'PLAN_ABORTED' }
      break
    }
  }
  if (plan.status === 'RUNNING') {
    plan.status = composePlanStatus(plan.steps, onFailure)
    if (plan.status === 'PARTIAL_COMPLETED' || plan.status === 'FAILED') {
      const failedStep = plan.steps.find((s) => s.status === 'FAILED')
      plan.failureReason = failedStep ? `${failedStep.errorType}:${failedStep.error}` : null
    }
  }
  if (deadlineHit) plan.failureReason = 'DEADLINE_EXCEEDED'
  plan.completedAt = new Date().toISOString()
  const planDurationMs = Date.now() - planStart

  // Task 04: Cloud Audit 增强（KernelEvent, 唯一权威; 零新表）
  await fetch(AUDIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executionId: plan.planId,
      runtimeId: 'skill-orchestrator',
      agentId: employeeDefinitionId || 'plan',
      definitionId: employeeDefinitionId || null,
      status: plan.status.toLowerCase(),
      toolCalls: plan.steps.map((s) => ({
        stepId: s.stepId,
        skillId: s.skillId,
        tool: s.tool,
        status: s.status,
        errorType: s.errorType,
        failureReason: s.error,
        attempts: s.attempts,
        durationMs: s.durationMs,
        executionId: s.executionId,
      })),
      result: {
        skillSet: plan.skillSet,
        fallback: onFailure,
        timeoutMs,
        deadlineMs,
        retry,
        maxParallel,
        planDurationMs,
        failureReason: plan.failureReason,
      },
    }),
  }).catch(() => {})

  return { plan, errors: [] }
}
