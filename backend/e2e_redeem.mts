import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const SELLER = '4e2f6062-956f-4d9e-96c2-2d266ec8efa8' // 商家(昆仑茶庄)
const st = app.jwt.sign({ id: SELLER, email: '', tokenVersion: 60 })
async function call(method, path, t, body) {
  const r = await fetch(H + path, { method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const txt = await r.text()
  console.log(method, path, JSON.stringify(body||{}), '=>', r.status, txt.slice(0, 200))
  try { return JSON.parse(txt) } catch { return null }
}
// 1) 商家核销已核销的值 (D21F4BC0 -> 应报已核销)
await call('POST', '/api/city/shop/order/redeem', st, { code: 'D21F4BC0' })
// 2) 商家核销不存在的码
await call('POST', '/api/city/shop/order/redeem', st, { code: 'ZZZZZZZZ' })
// 3) 直接查表: 现有所有 order code
import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const rows = await p.$queryRawUnsafe('select code, status, seller_uid from city_biz_order order by id desc limit 10')
console.log('orders:', JSON.stringify(rows.map(r => ({ code: r.code, status: r.status, seller: (r.seller_uid || '').slice(0,8) })), null, 0))
process.exit(0)
