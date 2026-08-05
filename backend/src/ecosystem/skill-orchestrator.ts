/**
 * S3.3.1 Skill Orchestrator（Planner, Cloud Control Plane）— 多 Skill 编排意图层
 * 依据: KUNLUN-S3.3-SKILL-COMPOSITION-DESIGN-GATE.md（掌柜 APPROVED）+ S3 Final Archive F1-F7
 * S3.3 宪法（掌柜冻结）:
 *   Planner = Cloud（本模块在云服务层，非 Hermes 运行时 — OC-0.1）
 *   SkillPlan = Runtime DAG（纯内存对象，不入库 — OC-0.2）
 *   Hermes = Atomic Executor（每次调用单 Skill 原子执行 — OC3）
 *   Skill = Authorized Capability（每 Skill 独立授权 — OC2/OC-0.3）
 *   KernelEvent = Audit Authority（planId/steps/status 入审计，不建表）
 * 状态机（掌柜冻结）: CREATED → PLANNING → RUNNING → PARTIAL_COMPLETED | COMPLETED | FAILED | CANCELLED
 */
import type { SkillDefinition } from './skill-manifest-adapter.js'

/** 组合状态机（Q4 冻结） */
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

export interface SkillPlanStep {
  stepId: string
  skillId: string
  tool: string
  input: any
  dependsOn: string[]
  status: StepStatus
  result: any
  error: string | null
}

export interface SkillPlan {
  planId: string
  employeeDefinitionId: string | null
  skillSet: string[]
  fallback: { onFailure: FailurePolicy }
  status: PlanStatus
  steps: SkillPlanStep[]
  createdAt: string
}

export interface PlanStepInput {
  stepId?: string
  skillId: string
  tool: string
  input?: any
  dependsOn?: string[]
}

const HERMES_SKILL_RUNTIME_URL = process.env.HERMES_SKILL_RUNTIME_URL || 'http://127.0.0.1:9457'
const AUDIT_URL = process.env.KUNLUN_AUDIT_URL || 'http://127.0.0.1:4002/api/audit/hermes-execution'

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
      if (!ids.has(dep)) return null // 依赖不存在
      if (dep === s.stepId) return null // 自环
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
  return order.length === steps.length ? order : null // 有环
}

/** 组合状态合成（纯函数）— Q4 冻结语义 */
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
}): SkillPlan {
  return {
    planId: 'plan-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    employeeDefinitionId: input.employeeDefinitionId,
    skillSet: input.skillSet,
    fallback: { onFailure: input.fallback },
    status: 'CREATED',
    createdAt: new Date().toISOString(),
    steps: input.steps.map((s) => ({
      stepId: s.stepId || s.skillId + ':' + s.tool,
      skillId: s.skillId,
      tool: s.tool,
      input: s.input ?? {},
      dependsOn: s.dependsOn || [],
      status: 'PENDING' as StepStatus,
      result: null,
      error: null,
    })),
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

/** 单步执行（Hermes 原子调用, OC3; 每 Skill 独立授权, OC2/OC-0.3） */
async function runStep(step: SkillPlanStep, agentDefinitionId: string | null): Promise<{ ok: boolean; result?: any; error?: string }> {
  const { prepareSkillExecution } = await import('./skill-execution-adapter.js')
  const intent = await prepareSkillExecution({ skillId: step.skillId, agentDefinitionId: agentDefinitionId ?? step.skillId })
  if (!intent) return { ok: false, error: 'SKILL_NOT_FOUND' }
  if (!intent.allowed || !intent.runtimePolicy) {
    return { ok: false, error: `${intent.authorizationState}:${intent.reason}` }
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
    signal: AbortSignal.timeout(10000),
  }).catch((e: any) => null)
  if (!res) return { ok: false, error: 'HERMES_UNREACHABLE' }
  const body = await res.json().catch(() => ({}))
  if (body.status === 'POLICY_REJECTED') return { ok: false, error: `POLICY_REJECTED:${body.tool}` }
  if (body.status !== 'COMPLETED') return { ok: false, error: body.status || 'HERMES_ERROR' }
  return { ok: true, result: body.result }
}

/** 执行 SkillPlan（编排层）: 生成 → 逐段授权+执行 → 聚合状态 → Cloud Audit → 返回（意图即弃, Q3） */
export async function executeSkillPlan(input: {
  employeeDefinitionId?: string | null
  steps: PlanStepInput[]
  fallback?: FailurePolicy
}): Promise<{ plan: SkillPlan; errors: string[] }> {
  const onFailure: FailurePolicy = input.fallback || 'STOP'
  const employeeDefinitionId = input.employeeDefinitionId ?? null

  // 员工能力集（F1: 绑定校验）
  let employeeSkillSet: string[] | null = null
  if (employeeDefinitionId) {
    const emp = await getEmployeeSkillSet(employeeDefinitionId)
    if (!emp) return { plan: null as any, errors: [`EMPLOYEE_NOT_FOUND:${employeeDefinitionId}`] }
    employeeSkillSet = emp.skills.map((s) => s.id)
  }

  // 校验 + 拓扑序
  const v = validatePlan({ steps: input.steps, employeeSkillSet })
  if (!v.ok) return { plan: null as any, errors: v.errors }

  const plan = createSkillPlan({
    employeeDefinitionId,
    skillSet: employeeSkillSet ?? Array.from(new Set(input.steps.map((s) => s.skillId))),
    fallback: onFailure,
    steps: input.steps,
  })
  plan.status = 'PLANNING'

  // 按拓扑序执行
  plan.status = 'RUNNING'
  for (const stepId of v.orderedStepIds!) {
    const step = plan.steps.find((s) => s.stepId === stepId)!
    if ((plan.status as PlanStatus) === 'FAILED' || (plan.status as PlanStatus) === 'CANCELLED') {
      step.status = 'SKIPPED'
      continue
    }
    step.status = 'RUNNING'
    const out = await runStep(step, employeeDefinitionId)
    if (out.ok) {
      step.status = 'COMPLETED'
      step.result = out.result
    } else {
      step.status = 'FAILED'
      step.error = out.error || 'UNKNOWN'
      if (onFailure === 'STOP') {
        plan.status = 'FAILED'
        for (const other of plan.steps) if (other.status === 'PENDING') other.status = 'SKIPPED'
        break
      }
    }
  }
  if (plan.status === 'RUNNING') plan.status = composePlanStatus(plan.steps, onFailure)

  // Cloud Audit（KernelEvent, 唯一权威; planId/steps/status 入审计, 不建表）
  await fetch(AUDIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executionId: plan.planId,
      runtimeId: 'skill-orchestrator',
      agentId: employeeDefinitionId || 'plan',
      definitionId: employeeDefinitionId || null,
      status: plan.status.toLowerCase(),
      toolCalls: plan.steps.map((s) => ({ stepId: s.stepId, skillId: s.skillId, tool: s.tool, status: s.status })),
      result: { skillSet: plan.skillSet, fallback: onFailure },
    }),
  }).catch(() => {})

  return { plan, errors: [] }
}
