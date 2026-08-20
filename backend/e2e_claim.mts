import 'dotenv/config'
import jwt from '@fastify/jwt'
import Fastify from 'fastify'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const token = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const A = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
async function call(method, path, body) {
  const r = await fetch(H + path, { method, headers: A, body: body ? JSON.stringify(body) : undefined })
  let txt = await r.text()
  console.log(method, path, '=>', r.status, txt.slice(0, 300))
}
// 1) 城市列表
await call('GET', '/api/city/list')
// 2) 建群申请列表(agent 创始应可查)
await call('GET', '/api/city/room/claims?cityId=nonexist')
console.log('done')
process.exit(0)
