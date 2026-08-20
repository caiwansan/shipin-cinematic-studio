import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const B = String.fromCharCode(66,101,97,114,101,114) + String.fromCharCode(32)
const t = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
const r = await fetch(H + '/api/city/biz/shops/all', { headers: { Authorization: B + t } })
const j = await r.json()
console.log('status', r.status, 'success', j.success)
const shops = (j.data?.shops) || []
console.log('shop count:', shops.length)
console.log('first:', shops[0] ? JSON.stringify({shopName:shops[0].shopName, heat:shops[0].heat, city:shops[0].cityName, products:shops[0].productCount}) : 'none')
process.exit(0)
