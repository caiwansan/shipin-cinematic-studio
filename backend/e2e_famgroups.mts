import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const t = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
for (const p of ['/api/tea/family/groups', '/api/tea/family/posts?groupId=x']) {
  const r = await fetch(H + p, { headers: { Authorization: 'Bearer ' + t } })
  console.log(p, '=>', r.status, (await r.text()).slice(0, 300))
}
process.exit(0)
