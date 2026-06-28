/**
 * director.route.ts — Sprint 1 纯规则驱动 Director Runtime API
 *
 * POST /api/director/plan             — 文本 → Shot Graph
 * POST /api/director/plan-from-spec   — NarrativeSpec → Shot Graph（占位）
 * GET  /api/director/playground       — 简易测试页面
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { generateShotPlan, validateShotGraph } from './index.js'

interface PlanFromTextBody {
  text?: string
  narrative?: string
}

export async function registerDirectorRoutes(app: FastifyInstance) {
  /**
   * POST /api/director/plan
   * 纯文本 → Shot Plan（Sprint 1 规则驱动）
   */
  app.post('/api/director/plan', async (req: FastifyRequest<{ Body: PlanFromTextBody }>, reply: FastifyReply) => {
    const narrative = req.body?.narrative || req.body?.text || ''

    if (!narrative || narrative.trim().length < 4) {
      return reply.status(400).send({
        success: false,
        error: 'narrative/text 太短，至少 4 个字符',
      })
    }

    const start = Date.now()
    const shotGraph = generateShotPlan(narrative)
    const validationIssues = validateShotGraph(shotGraph)
    const latency = Date.now() - start

    return reply.send({
      success: true,
      data: {
        shotGraph,
        validationIssues,
        latencyMs: latency,
      },
    })
  })

  /**
   * POST /api/director/plan-from-spec
   * NarrativeSpec → Shot Plan（Sprint 2+ 占位）
   */
  app.post('/api/director/plan-from-spec', async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      success: false,
      error: 'plan-from-spec 将在 Sprint 2 实现',
    })
  })

  /**
   * GET /api/director/playground
   * 简易调试页面
   */
  app.get('/api/director/playground', async (_request: FastifyRequest, reply: FastifyReply) => {
    const html = getPlaygroundHtml()
    reply.type('text/html; charset=utf-8')
    return reply.send(html)
  })
}

function getPlaygroundHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>昆仑镜 · Director Playground (Sprint 1)</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a1a; color: #e0e0f0; min-height: 100vh; display: flex; justify-content: center; padding: 40px 20px; }
    .container { max-width: 800px; width: 100%; }
    h1 { font-size: 24px; font-weight: 600; color: #a78bfa; margin-bottom: 8px; }
    .subtitle { color: #7a7a9a; font-size: 14px; margin-bottom: 24px; }
    textarea { width: 100%; height: 120px; background: #1a1a3a; border: 1px solid #2a2a5a; border-radius: 8px; color: #e0e0f0; padding: 12px; font-size: 14px; resize: vertical; }
    textarea:focus { outline: none; border-color: #7c3aed; }
    .btn { background: #7c3aed; color: white; border: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; cursor: pointer; margin-top: 12px; }
    .btn:hover { background: #6d28d9; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .result { margin-top: 24px; }
    .shot { background: #1a1a3a; border: 1px solid #2a2a5a; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .shot-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .shot-id { font-weight: 600; color: #a78bfa; }
    .shot-type { background: #2a2a5a; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #a78bfa; }
    .shot-detail { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; }
    .shot-detail .label { color: #7a7a9a; }
    .shot-detail .value { color: #e0e0f0; }
    .meta { color: #7a7a9a; font-size: 13px; margin-bottom: 16px; }
    .issues { margin-top: 12px; }
    .issue { color: #f59e0b; font-size: 12px; padding: 4px 8px; }
    .examples { margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
    .example-tag { background: #1a1a3a; border: 1px solid #2a2a5a; border-radius: 4px; padding: 4px 10px; font-size: 12px; color: #7a7a9a; cursor: pointer; }
    .example-tag:hover { border-color: #7c3aed; color: #a78bfa; }
    .badge { background: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: #6ee7b7; }
    .latency { color: #7a7a9a; font-size: 12px; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 Director Playground</h1>
    <p class="subtitle">昆仑镜 · Director Runtime Sprint 1 — Narrative → Shot Graph（纯规则驱动）</p>

    <textarea id="input" placeholder="输入剧情描述…">上古神尊与深渊魔神在九重天展开大战</textarea>
    <div class="examples">
      <span class="example-tag" onclick="fill('上古神尊与深渊魔神在九重天展开大战')">⚔️ 大战</span>
      <span class="example-tag" onclick="fill('青玄宗掌门与魔教护法在断魂崖对峙谈判')">💬 对话</span>
      <span class="example-tag" onclick="fill('白衣剑客在万妖山中追杀逃窜的蛇妖')">🏃 追逐</span>
      <span class="example-tag" onclick="fill('23名青玄宗弟子布下天罡诛妖阵')">🔮 阵法</span>
      <span class="example-tag" onclick="fill('少年踏上前往北境极寒之地的征途')">🗺️ 征途</span>
    </div>
    <button class="btn" id="goBtn" onclick="generate()">🎬 生成镜头方案</button>

    <div id="result" class="result"></div>
  </div>

  <script>
    function fill(text) { document.getElementById('input').value = text; generate(); }
    async function generate() {
      const narrative = document.getElementById('input').value.trim()
      if (!narrative) return
      const goBtn = document.getElementById('goBtn')
      goBtn.disabled = true; goBtn.textContent = '⏳ 生成中…'
      document.getElementById('result').innerHTML = ''
      try {
        const res = await fetch('/api/director/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ narrative, text: narrative })
        })
        const json = await res.json()
        if (!json.success) { document.getElementById('result').innerHTML = '<div class="shot" style="color:#ef4444">' + json.error + '</div>'; return }
        const d = json.data
        const intentName = d.shotGraph.meta?.narrativeSummary || ''
        let html = '<div class="meta">' + (intentName ? '剧情：<span class="badge">' + intentName.slice(0,40) + '</span> · ' : '') + d.shotGraph.shots.length + ' 个镜头 · ' + d.latencyMs + 'ms</div>'
        d.shotGraph.shots.forEach(function(shot) {
          html += '<div class="shot"><div class="shot-header"><span class="shot-id">#' + shot.id + '</span><span class="shot-type">' + shot.shotType + '</span></div><div class="shot-detail"><div><span class="label">主体：</span><span class="value">' + (shot.subject||[]).join(', ') + '</span></div><div><span class="label">环境：</span><span class="value">' + (shot.environment||'') + '</span></div><div style="grid-column:1/-1"><span class="label">动作：</span><span class="value">' + (shot.action||'') + '</span></div><div><span class="label">时长：</span><span class="value">' + (shot.duration||0) + 's</span></div></div></div>'
        })
        if (d.validationIssues && d.validationIssues.length) {
          html += '<div class="issues">' + d.validationIssues.map(function(i) { return '<div class="issue">⚠️ [' + i.rule + '] ' + i.message + '</div>' }).join('') + '</div>'
        }
        html += '<div class="latency">响应时间：' + d.latencyMs + 'ms</div>'
        document.getElementById('result').innerHTML = html
      } catch (err) {
        document.getElementById('result').innerHTML = '<div class="shot" style="color:#ef4444">请求失败：' + err.message + '</div>'
      } finally {
        goBtn.disabled = false; goBtn.textContent = '🎬 生成镜头方案'
      }
    }
    window.onload = function() { generate() }
  </script>
</body>
</html>`
}
