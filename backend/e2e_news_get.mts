import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const B = String.fromCharCode(66,101,97,114,101,114) + String.fromCharCode(32)
const t = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
const url = H + '/api/tea/news?industry=' + encodeURIComponent('人工智能/科技')
console.log('URL:', url)
const r = await fetch(url, { headers: { Authorization: B + t } })
const txt = await r.text()
console.log('status', r.status)
console.log(txt.slice(0, 500))
process.exit(0)
