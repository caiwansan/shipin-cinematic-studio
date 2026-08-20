import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const H = `http://127.0.0.1:${process.env.PORT || 4002}`
const B = String.fromCharCode(66,101,97,114,101,114) + String.fromCharCode(32)
const t = app.jwt.sign({ id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d', email: '', tokenVersion: 289 })
// 用 ASR transcribe/text 纯文本模式测试返回结构（无音频文件, 验证&解析路径）
const r = await fetch(H + '/api/v1/asr/transcribe/text', {
  method: 'POST',
  headers: { Authorization: B + t, 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: '你好，测试语音转文字结构' }),
})
const j = await r.json()
console.log('status', r.status)
console.log('segments:', JSON.stringify(j?.data?.segments || j?.segments || j))
console.log('text-join:', j?.data?.segments?.map(x=>x.text).join(''))
process.exit(0)
