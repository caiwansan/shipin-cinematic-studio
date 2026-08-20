import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const B = String.fromCharCode(66,101,97,114,101,114) + String.fromCharCode(32)
const t = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
async function api(path, opts={}) {
  const r = await fetch(H+path, { ...opts, headers: { Authorization: B+t, ...(opts.headers||{}) } })
  const j = await r.json().catch(()=>({}))
  return { status: r.status, j }
}
// 1) GET 空缓存
const g = await api('/api/tea/news?industry=' + encodeURIComponent('人工智能/科技'))
console.log('1.GET:', g.status, 'industries:', (g.j.data?.industries||[]).length, 'news:', g.j.data?.news?.length, 'brief:', g.j.data?.brief ? 'yes' : 'no')
// 2) POST fetch 采集(会尝试RSS + 若有Key出简报)
console.log('2.POST fetch (采集中，可能较慢)...')
const f = await api('/api/tea/news/fetch', { method:'POST', body: JSON.stringify({ industry: '人工智能/科技' }), headers:{'content-type':'application/json'} })
console.log('2.POST:', f.status, JSON.stringify(f.j?.data)?.slice(0, 300))
process.exit(0)
