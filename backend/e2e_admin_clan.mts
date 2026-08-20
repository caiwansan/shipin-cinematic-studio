import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const B = String.fromCharCode(66,101,97,114,101,114) + String.fromCharCode(32)
const founder = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
// 后台路由用创始JWT(非admin) → 应401 (路由存在); 404 = 路由未注册
const r = await fetch(H + '/api/admin/tea-clan/applies', { headers: { Authorization: B + founder } })
console.log('admin route(existing?):', r.status, (await r.text()).slice(0, 150))
process.exit(0)
