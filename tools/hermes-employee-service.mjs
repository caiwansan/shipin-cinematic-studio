// Hermes Employee Service —— AI 员工 → Hermes 子代理执行桥（服务器）
// 用法: node hermes-employee-service.mjs  (监听 0.0.0.0:9458)
// POST /run { agent, task, system, model, apiKey, baseUrl, maxTurns, enabledToolsets, jsonMode }
// 鉴权: x-hermes-token 头（与本地版约定，见 HERMES_ACCESS_TOKEN）
import { createServer } from 'http'
import { execFile } from 'child_process'

const PORT = process.env.HERMES_SVC_PORT || 9458
const ACCESS_TOKEN = process.env.HERMES_ACCESS_TOKEN || 'sw-hermes-2026-smartws'
const AGENT_DIR = '/root/.hermes/hermes-agent'
const PY = AGENT_DIR + '/venv/bin/python'

// 并发队列：Hermes 会话串行执行（避免资源竞争/模型限流）
let queue = Promise.resolve()

function runAgent(payload) {
  const args = [
    'run_agent.py',
    '--query', String(payload.task || '').slice(0, 6000),
    '--max_turns', String(payload.maxTurns || 8),
  ]
  if (payload.model) args.push('--model', String(payload.model))
  if (payload.apiKey) args.push('--api_key', String(payload.apiKey))
  if (payload.baseUrl) args.push('--base_url', String(payload.baseUrl))
  if (payload.enabledToolsets) args.push('--enabled_toolsets', String(payload.enabledToolsets))
  return new Promise((resolve) => {
    const t0 = Date.now()
    execFile(PY, args, { cwd: AGENT_DIR, timeout: (payload.timeoutMs || 300000), maxBuffer: 20 * 1024 * 1024, env: { ...process.env, HERMES_QUIET: '1' } },
      (err, stdout, stderr) => {
        const out = (stdout || '') + (stderr || '')
        // 提取 FINAL RESPONSE
        const fm = out.match(/🎯 FINAL RESPONSE:\s*[\s\S]*?------------------------------\s*([\s\S]*?)\s*👋 Agent execution/)
          || out.match(/FINAL RESPONSE:\s*([\s\S]{10,})/)
        const final = fm ? fm[1].trim() : ''
        const completed = /Completed: True/.test(out)
        resolve({
          ok: completed || !!final,
          completed,
          output: final || out.slice(-2000),
          elapsedMs: Date.now() - t0,
          error: err ? err.message : '',
        })
      })
  })
}

const server = createServer(async (req, res) => {
  // 鉴权
  const token = req.headers['x-hermes-token'] || ''
  if (token !== ACCESS_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: false, error: 'UNAUTHORIZED' }))
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: true, service: 'hermes-employee', running: true }))
  }
  if (req.method !== 'POST' || req.url !== '/run') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ ok: false, error: 'NOT_FOUND' }))
  }
  let body = ''
  req.on('data', d => body += d)
  req.on('end', () => {
    let payload = {}
    try { payload = JSON.parse(body || '{}') } catch {}
    // 注入 system 到 task 开头
    if (payload.system) payload.task = String(payload.system) + '\n\n' + (payload.task || '')
    queue = queue.then(() => runAgent(payload)).catch(e => ({ ok: false, error: e.message }))
    queue.then((r) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: r.ok, output: r.output, elapsedMs: r.elapsedMs, error: r.error, agent: payload.agent || 'general' }))
    })
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[hermes-employee] listening :${PORT}`)
})
