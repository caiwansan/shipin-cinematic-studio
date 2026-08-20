import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const t = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
const CID = '75e20977-52f4-4028-9b64-d6cb1437fbb0'
for (const [m, p] of [['GET', `/api/city/room/claims?cityId=${CID}`], ['GET', `/api/city/biz/products?cityId=${CID}`]]) {
  const r = await fetch(H + p, { headers: { Authorization: 'Bearer ' + t } })
  console.log(m, p, '=>', r.status, (await r.text()).slice(0, 200))
}
process.exit(0)
