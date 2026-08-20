import 'dotenv/config'
import Fastify from 'fastify'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
const app = Fastify()
await app.register(jwt, { secret: process.env.JWT_SECRET })
const prisma = new PrismaClient()
const H = `http://127.0.0.1:${process.env.PORT || 4002}`

const FOUNDER = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d'
const SELLER = '4e2f6062-956f-4d9e-96c2-2d266ec8efa8'
const CID = '75e20977-52f4-4028-9b64-d6cb1437fbb0'
const PROD = 'a8ef6154-0cd8-447e-9c66-905aa5d2b527' // 明前龙井 30工分

async function gongfen(uid: string): Promise<number> {
  const w: any = await prisma.$queryRawUnsafe('select gongfen from tea_wallet where uid=$1', uid)
  return w.length ? Number(w[0].gongfen) : 0
}
const TV: Record<string, number> = { '0ba5bf98-7005-4019-a431-6a0fb4b2d28d': 289, '4e2f6062-956f-4d9e-96c2-2d266ec8efa8': 60 }
const tok = (uid: string) => app.jwt.sign({ id: uid, email: '', tokenVersion: TV[uid] || 1 })
async function call(method: string, path: string, t: string, body?: any) {
  const r = await fetch(H + path, { method, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const txt = await r.text()
  console.log(method, path, '=>', r.status, txt.slice(0, 200))
  try { return { st: r.status, j: JSON.parse(txt) } } catch { return { st: r.status, j: null } }
}

const [fb, sb, eb] = await Promise.all([gongfen(FOUNDER), gongfen(SELLER), gongfen('PLATFORM_ESCROW')])
console.log('BEFORE: founder=', fb, 'seller=', sb, 'escrow=', eb)

const fTok = await tok(FOUNDER)
const sTok = await tok(SELLER)

// 1) 创始人买商品（卖家是4e2f6062，创始不是商家，可买）
const c1 = await call('POST', '/api/city/shop/order/create', fTok, { cityId: CID, productId: PROD })
if (c1.j?.success) {
  const code = c1.j.data.code
  console.log('银票核销码:', code)
  // 2) 商家核销
  const c2 = await call('POST', '/api/city/shop/order/redeem', sTok, { code })
  // 3) 查余额
  await new Promise(r => setTimeout(r, 500))
  const [fa, sa, ea] = await Promise.all([gongfen(FOUNDER), gongfen(SELLER), gongfen('PLATFORM_ESCROW')])
  console.log('AFTER: founder=', fa, 'seller=', sa, 'escrow=', ea)
  console.log('diff: founder', fa - fb, 'seller', sa - sb, 'escrow', ea - eb)
}
process.exit(0)
