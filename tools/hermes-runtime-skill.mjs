// ═══════════════════════════════════════════════════════════════
// Hermes Skill Runtime (mock) — S3.2.3 首次 Skill 真执行路径（提交固化）
// 链路: Skill Authorization → runtimePolicy → Sub-Agent → Tool Sandbox → Result → Cloud Audit
// 原则:
//  - 只执行 policy.allowedTools 内的工具（SE3 Tool Policy 强制）
//  - 越权工具 → POLICY_REJECTED（含 H-D 禁止集: payment/identity.modify/registry.write/native.exec）
//  - 完成后自动上报 Cloud Audit（KernelEvent, SE5）
//  - 仅 mock 工具（resume.parse / profile.extract / mock-calc），无真实业务、无真实 AI
// 运行: node tools/hermes-runtime-skill.mjs（127.0.0.1:9457）
// ═══════════════════════════════════════════════════════════════
import { createServer } from 'http'
import { randomUUID } from 'crypto'

const RUNTIME_ID = 'hermes-skill-001'
const PORT = 9457
const AUDIT_URL = process.env.KUNLUN_AUDIT_URL || 'http://127.0.0.1:4002/api/audit/hermes-execution'

// ── Tool Sandbox（仅 mock，安全执行，无 eval）──
const TOOL_REGISTRY = {
  'resume.parse': (input = {}) => ({
    ok: true,
    result: {
      applicant: 'Mock Applicant',
      summary: 'resume parsed (mock)',
      sections: ['experience', 'education', 'skills'],
      inputHint: input,
    },
  }),
  'profile.extract': (input = {}) => ({
    ok: true,
    result: {
      profile: { skills: ['video-editing', 'copywriting'], yearsExperience: 5 },
      inputHint: input,
    },
  }),
  'mock-calc': (input = {}) => {
    const { a, b, op } = input
    if (op === 'add') return { ok: true, result: { value: Number(a) + Number(b) } }
    if (op === 'mul') return { ok: true, result: { value: Number(a) * Number(b) } }
    return { ok: false, error: 'UNSUPPORTED_OP' }
  },
}

const H_D_DENIED = ['payment.*', 'identity.modify', 'registry.write', 'native.exec']

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
    req.on('end', () => {
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

      // ── 执行（mock 沙箱）──
      const out = TOOL_REGISTRY[tool](inv.input || {})
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
