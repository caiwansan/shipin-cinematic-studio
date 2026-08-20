import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const t = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
try {
  const r = await fetch(H + '/api/city/shop/orders', { headers: { Authorization: 'Bearer ' + t } })
  const txt = await r.text()
  console.log('status', r.status)
  console.log('body', txt.slice(0, 1200))
} catch (e) { console.log('fetch err', e.message) }
process.exit(0)
