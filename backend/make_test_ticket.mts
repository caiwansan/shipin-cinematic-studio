import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const FOUNDER = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d' // 买家(创始, 也是城市agent)
const CID = '75e20977-52f4-4028-9b64-d6cb1437fbb0'
const PROD2 = '2a0ad3b8-0644-473e-afac-88ccf96776fc' // 滇红工夫 20工分
const t = app.jwt.sign({ id: FOUNDER, email: '', tokenVersion: 289 })
const r = await fetch(H + '/api/city/shop/order/create', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ cityId: CID, productId: PROD2 }) })
console.log('create:', r.status, (await r.text()).slice(0, 300))
process.exit(0)
