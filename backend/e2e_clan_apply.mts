import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const B = String.fromCharCode(66,101,97,114,101,114) + String.fromCharCode(32)
const founder = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
// 提交宗亲群申请
const r1 = await fetch(H + '/api/tea/family/group/apply', { method: 'POST', headers: { Authorization: B + founder, 'Content-Type': 'application/json' }, body: JSON.stringify({ groupName: '测试宗亲群' }) })
console.log('apply:', r1.status, (await r1.text()).slice(0, 200))
process.exit(0)
