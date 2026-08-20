import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const B = String.fromCharCode(66,101,97,114,101,114) + String.fromCharCode(32)
// admin token: 同 JWT_SECRET, isAdmin:true
const t = app.jwt.sign({ id: 'admin-e2e', userId: 'admin-e2e', username: 'admin', email: '', role: 'admin', isAdmin: true })
async function req(path, opts={}) {
  const r = await fetch(H + path, { ...opts, headers: { Authorization: B + t, 'Content-Type': 'application/json', ...(opts.headers||{}) } })
  return { status: r.status, body: await r.json().catch(()=>null) }
}
// 1) GET 当前配置
let g = await req('/api/admin/tea-translate')
console.log('GET status', g.status, 'body', JSON.stringify(g.body))
// 2) test 端点 (无key → 应提示填key; 有假key → 调用真实URL会失败但路由可达)
let t1 = await req('/api/admin/tea-translate/test', { method:'POST', body: JSON.stringify({ provider:'deepseek', model:'deepseek-chat', baseUrl:'https://api.deepseek.com/v1', apiKey:'sk-invalid-test' }) })
console.log('TEST deepseek-invalid status', t1.status, 'msg', t1.body?.message, 'ok', t1.body?.success)
process.exit(0)
