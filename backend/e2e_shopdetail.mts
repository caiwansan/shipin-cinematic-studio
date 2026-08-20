import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const B = String.fromCharCode(66,101,97,114,101,114) + String.fromCharCode(32)
const t = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
// 1) 拿所有商家第一个的 id
const sall = await fetch(H + '/api/city/biz/shops/all', { headers: { Authorization: B + t } })
const sj = await sall.json()
const first = (sj.data?.shops||[])[0]
console.log('first shop:', first ? JSON.stringify({id:first.id, shopName:first.shopName}) : 'none')
if (!first) process.exit(0)
// 2) 公开店铺详情
const r = await fetch(H + '/api/city/biz/shop/' + first.id + '/public', { headers: { Authorization: B + t } })
const j = await r.json()
console.log('detail status', r.status, 'success', j.success)
const d = j.data
if (d) {
  console.log('shop:', JSON.stringify({name: d.shop?.shopName, city: d.shop?.cityName, addr: d.shop?.address, heat: d.shop?.heat, good: d.shop?.good, bad: d.shop?.bad}))
  console.log('products:', (d.products||[]).length, (d.products||[]).slice(0,2).map(p=>JSON.stringify({name:p.name,price:p.priceTea,stock:p.stock})))
}
process.exit(0)
