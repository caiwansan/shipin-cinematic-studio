#!/usr/bin/env node
// 昆仑镜社区批量发帖+审核脚本
// 用法: node publish.js <articles.json> [间隔秒]
import fs from 'fs'

const BASE = 'https://aigc.fushtn.com'
const USER_TOKEN = fs.readFileSync('/tmp/klj-user.token', 'utf8').trim()
const ADMIN_TOKEN = fs.readFileSync('/tmp/klj-admin.token', 'utf8').trim()
const interval = parseInt(process.argv[3] || '25', 10)

const articles = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const ok = [], fail = []
let n = 0

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function post(a) {
  const r = await fetch(`${BASE}/api/community/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${USER_TOKEN}` },
    body: JSON.stringify({ title: a.title, content: a.content, category: a.category, tags: a.tags, summary: a.summary })
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`发帖失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`)
  return d.post.id
}

async function approve(id) {
  const r = await fetch(`${BASE}/api/community/admin/posts/${id}/approve`, {
    method: 'PATCH',
    headers: { 'x-admin-token': ADMIN_TOKEN }
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`审核失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`)
}

for (const a of articles) {
  n++
  const t0 = Date.now()
  try {
    const id = await post(a)
    await approve(id)
    ok.push({ id, title: a.title })
    console.log(`✅ [${n}/${articles.length}] ${a.title} (${Date.now() - t0}ms)`)
  } catch (e) {
    fail.push({ title: a.title, error: e.message })
    console.log(`❌ [${n}/${articles.length}] ${a.title} -> ${e.message}`)
  }
  if (n < articles.length) await sleep(interval * 1000)
}

fs.writeFileSync(process.argv[2].replace('.json', '.result.json'), JSON.stringify({ ok, fail }, null, 2))
console.log(`\n完成: 成功 ${ok.length} / 失败 ${fail.length}`)
if (fail.length) console.log('失败清单:', JSON.stringify(fail, null, 2).slice(0, 2000))
