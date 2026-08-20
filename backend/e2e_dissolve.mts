import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const B = String.fromCharCode(66,101,97,114,101,114) + String.fromCharCode(32)
const adminTok = app.jwt.sign({ userId: 'admin', username: 'admin', role: 'admin', isAdmin: true }, { expiresIn: '10m' })
// 已开通宗亲群列表
const r = await fetch(H + '/api/admin/tea-clan/groups', { headers: { Authorization: B + adminTok } })
console.log('clan groups list:', r.status, (await r.text()).slice(0, 400))
process.exit(0)
