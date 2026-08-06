// ═══════════════════════════════════════════════════════════════
// Hermes Skill Runtime Reference Implementation — S3.3.1 起官方定位（S3 Final Archive T1 冻结更名）
// 链路: Skill Authorization → runtimePolicy → Sub-Agent → Tool Sandbox → Result → Cloud Audit
// 原则:
//  - 只执行 policy.allowedTools 内的工具（SE3 Tool Policy 强制）
//  - 越权工具 → POLICY_REJECTED（含 H-D 禁止集: payment/identity.modify/registry.write/native.exec）
//  - 完成后自动上报 Cloud Audit（KernelEvent, SE5）
//  - 仅 mock 工具（resume.parse / profile.extract / candidate.score / interview.evaluate / mock-calc）
// 运行: node tools/hermes-runtime-skill.mjs（127.0.0.1:9457）
// ═══════════════════════════════════════════════════════════════
import { createServer } from 'http'
import { randomUUID } from 'crypto'
import { readFileSync } from 'node:fs'

const RUNTIME_ID = 'hermes-skill-001'
const PORT = 9457
const AUDIT_URL = process.env.KUNLUN_AUDIT_URL || 'http://127.0.0.1:4002/api/audit/hermes-execution'
const BACKEND_URL = process.env.KUNLUN_BACKEND_URL || 'http://127.0.0.1:4002'

// 内部 token: 优先进程 env, 回退读 backend/.env（与后端同一秘密源, 不入 git）
function resolveInternalToken() {
  if (process.env.KUNLUN_INTERNAL_TOKEN) return process.env.KUNLUN_INTERNAL_TOKEN
  try {
    const envFile = readFileSync('/root/shipin-cinematic-studio/backend/.env', 'utf-8')
    const m = envFile.match(/^KUNLUN_INTERNAL_TOKEN=(.+)$/m)
    return m ? m[1].trim().replace(/["']/g, '') : ''
  } catch {
    return ''
  }
}
const INTERNAL_TOKEN = resolveInternalToken()

// ── Tool Sandbox（安全执行, 无 eval; resume.parse 为真实后端解析, 零 LLM）──
const TOOL_REGISTRY = {
  // S3.4.1-BLOCKED Task 01: 真实简历解析（后端确定性 Agent）
  'resume.parse': async (input = {}) => {
    const res = await fetch(`${BACKEND_URL}/api/internal/skill-tools/resume-parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify({ text: input.text, filePath: input.filePath }),
    }).catch(() => null)
    if (!res) return { ok: false, error: 'RESUME_PARSE_BACKEND_UNREACHABLE' }
    const body = await res.json().catch(() => ({}))
    if (body.code !== 0) return { ok: false, error: body.error || 'RESUME_PARSE_FAILED' }
    return { ok: true, result: body.data }
  },
  'profile.extract': (input = {}) => ({
    ok: true,
    result: {
      profile: { skills: ['video-editing', 'copywriting'], yearsExperience: 5 },
      inputHint: input,
    },
  }),
  // S3.4.2-B: 真实候选评分（经后端内部路由 → Unified AI Gateway, CS2）
  'candidate.score': async (input = {}) => {
    const res = await fetch(`${BACKEND_URL}/api/internal/skill-tools/candidate-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify({ resumeProfile: input.resumeProfile, jobRequirement: input.jobRequirement, tenantUserId: input.tenantUserId }),
    }).catch(() => null)
    if (!res) return { ok: false, error: 'SCORE_BACKEND_UNREACHABLE' }
    const body = await res.json().catch(() => ({}))
    if (body.code !== 0 || body.data?.error) {
      return { ok: false, error: body.data?.error || body.error || 'SCORE_FAILED' }
    }
    return { ok: true, result: body.data }
  },
  // S3.4.2-C: 真实面试评估（经后端内部路由 → Unified AI Gateway, CS2 同模式）
  'interview.evaluate': async (input = {}) => {
    const res = await fetch(`${BACKEND_URL}/api/internal/skill-tools/interview-evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify({ resume: input.resume, interviewTranscript: input.interviewTranscript, interviewRecord: input.interviewRecord, jobRequirement: input.jobRequirement, tenantUserId: input.tenantUserId }),
    }).catch(() => null)
    if (!res) return { ok: false, error: 'INTERVIEW_BACKEND_UNREACHABLE' }
    const body = await res.json().catch(() => ({}))
    if (body.code !== 0 || body.data?.error) {
      return { ok: false, error: body.data?.error || body.error || 'INTERVIEW_FAILED' }
    }
    return { ok: true, result: body.data }
  },
  // S5.1: 短剧导演 3 薄工具（经后端内部路由 → Unified AI Gateway; 禁 narrativeGateway 直连）
  'script.analysis': async (input = {}) => {
    const res = await fetch(`${BACKEND_URL}/api/internal/skill-tools/script-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify({ scriptText: input.scriptText, tenantUserId: input.tenantUserId }),
    }).catch(() => null)
    if (!res) return { ok: false, error: 'SCRIPT_ANALYSIS_BACKEND_UNREACHABLE' }
    const body = await res.json().catch(() => ({}))
    if (body.code !== 0 || body.data?.error) {
      return { ok: false, error: body.data?.error || body.error || 'SCRIPT_ANALYSIS_FAILED' }
    }
    return { ok: true, result: body.data }
  },
  'storyboard.plan': async (input = {}) => {
    const res = await fetch(`${BACKEND_URL}/api/internal/skill-tools/storyboard-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify({ sceneText: input.sceneText, shots: input.shots, tenantUserId: input.tenantUserId }),
    }).catch(() => null)
    if (!res) return { ok: false, error: 'STORYBOARD_BACKEND_UNREACHABLE' }
    const body = await res.json().catch(() => ({}))
    if (body.code !== 0 || body.data?.error) {
      return { ok: false, error: body.data?.error || body.error || 'STORYBOARD_FAILED' }
    }
    return { ok: true, result: body.data }
  },
  'prompt.optimize': async (input = {}) => {
    const res = await fetch(`${BACKEND_URL}/api/internal/skill-tools/prompt-optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': INTERNAL_TOKEN },
      body: JSON.stringify({ shotDescription: input.shotDescription, style: input.style, model: input.model, tenantUserId: input.tenantUserId }),
    }).catch(() => null)
    if (!res) return { ok: false, error: 'PROMPT_OPTIMIZE_BACKEND_UNREACHABLE' }
    const body = await res.json().catch(() => ({}))
    if (body.code !== 0 || body.data?.error) {
      return { ok: false, error: body.data?.error || body.error || 'PROMPT_OPTIMIZE_FAILED' }
    }
    return { ok: true, result: body.data }
  },
  'mock-calc': (input = {}) => {
    const { a, b, op } = input
    if (op === 'add') return { ok: true, result: { value: Number(a) + Number(b) } }
    if (op === 'mul') return { ok: true, result: { value: Number(a) * Number(b) } }
    return { ok: false, error: 'UNSUPPORTED_OP' }
  },
  // ── S3.3.2 测试工具（Test Harness 专用, 无真实业务）──
  // mock.flaky: 同一 (invocationId:runId) 首次调用 transient 失败, 之后成功（SC7 retry 验证）
  'mock.flaky': (input = {}, ctx = {}) => {
    const key = `${ctx.invocationId || 'inv'}:${input.runId || 'run'}`
    if (flakySeen.has(key)) {
      return { ok: true, result: { flaky: false, note: 'succeeded after retry' } }
    }
    flakySeen.add(key)
    return { ok: false, error: 'TRANSIENT_FAILURE' }
  },
  // mock.slow: 延迟 input.sleepMs 后成功（SC8 timeout 验证）
  'mock.slow': async (input = {}) => {
    const sleepMs = Math.min(Number(input.sleepMs) || 0, 20000)
    await new Promise((r) => setTimeout(r, sleepMs))
    return { ok: true, result: { sleptMs: sleepMs } }
  },
}

const H_D_DENIED = ['payment.*', 'identity.modify', 'registry.write', 'native.exec']
// S3.3.2: mock.flaky 首次失败记忆（Test Harness）
const flakySeen = new Set()

function policyDenied(tool, allowedTools) {
  if (!Array.isArray(allowedTools) || allowedTools.length === 0) return true
  if (!allowedTools.includes(tool)) return true
  return H_D_DENIED.some((d) => (d.endsWith('.*') ? tool.startsWith(d.slice(0, -1)) : tool === d))
}

function subAgentStates() {
  return ['CREATED', 'INITIALIZING', 'READY', 'RUNNING', 'COMPLETED']
}

function audit(ev) {
  fetch(AUDIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ev),
  }).catch((e) => console.error('[hermes-skill] audit failed:', e.message))
}

const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const url = new URL(req.url, 'http://127.0.0.1')

  // GET /health — Hermes Runtime Discovery（H0/H1）
  if (req.method === 'GET' && url.pathname === '/health') {
    res.end(JSON.stringify({
      runtimeId: RUNTIME_ID,
      status: 'ready',
      version: '0.1.0-skill',
      ownedBy: 'HERMES_CONTROLLER',
      capabilities: Object.keys(TOOL_REGISTRY),
      policy: { boundary: 'H-D', deniedTools: H_D_DENIED },
    }))
    return
  }

  // POST /invocations — Skill 执行（SE1/SE3/SE4/SE5）
  if (req.method === 'POST' && url.pathname === '/invocations') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', async () => {
      let inv
      try { inv = JSON.parse(body) } catch { inv = null }
      if (!inv || !inv.invocationId || !inv.skillId || !Array.isArray(inv.policy?.allowedTools)) {
        res.statusCode = 400
        res.end(JSON.stringify({ status: 'REJECTED', reason: 'INVALID_INVOCATION' }))
        return
      }
      const allowedTools = inv.policy.allowedTools
      const tool = inv.tool || (allowedTools[0] || '')
      const executionId = 'exec-' + randomUUID().slice(0, 8)
      const agentId = inv.agentDefinitionId ? 'sub-agent-' + inv.agentDefinitionId : 'sub-agent-mock'

      // ── Sub-Agent 状态机 ──
      const states = subAgentStates()

      // ── Tool Policy 强制（SE3）──
      if (!TOOL_REGISTRY[tool] || policyDenied(tool, allowedTools)) {
        const rejected = { status: 'POLICY_REJECTED', executionId, runtimeId: RUNTIME_ID, agentId, tool, reason: 'TOOL_NOT_ALLOWED' }
        audit({ executionId, runtimeId: RUNTIME_ID, agentId, definitionId: inv.agentDefinitionId || null, status: 'policy_rejected', toolCalls: [{ tool, allowed: false }], result: null })
        res.statusCode = 403
        res.end(JSON.stringify(rejected))
        return
      }

      // ── 执行（mock 沙箱, 支持 async 工具）──
      const out = await TOOL_REGISTRY[tool](inv.input || {}, { invocationId: inv.invocationId })
      const completed = {
        status: 'COMPLETED',
        executionId,
        runtimeId: RUNTIME_ID,
        agentId,
        skillId: inv.skillId,
        subAgentStates: states,
        toolCalls: [{ tool, allowed: true }],
        result: out,
      }
      // ── Cloud Audit（SE5）──
      audit({
        executionId,
        runtimeId: RUNTIME_ID,
        agentId,
        definitionId: inv.agentDefinitionId || null,
        skillId: inv.skillId,
        status: out.ok ? 'completed' : 'failed',
        toolCalls: [{ tool, allowed: true }],
        result: out,
      })
      res.end(JSON.stringify(completed))
    })
    return
  }

  res.statusCode = 404
  res.end(JSON.stringify({ error: 'NOT_FOUND' }))
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[hermes-skill-runtime] listening on 127.0.0.1:${PORT} (${RUNTIME_ID})`)
})
