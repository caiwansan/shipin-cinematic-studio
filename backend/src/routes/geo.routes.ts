// geo.routes.ts — IP 属地（ip2region 离线库，城市级；微信同款"IP属地"）
// 数据表 ip_locations 运行时创建（不动 prisma schema，避免 prisma generate 迁移窗口期）
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { getClientIp } from '../utils/session.js'

let ip2: any = null
let ip2Promise: Promise<any> | null = null
function loadIp2(): Promise<any> {
  if (!ip2Promise) {
    ip2Promise = (async () => {
      try {
        const mod: any = await import('ip2region')
        const Ctor = mod?.default?.default || mod?.default || mod
        ip2 = new Ctor()
        console.log('[geo] ip2region 就绪')
      } catch (e: any) {
        console.warn('[geo] ip2region 加载失败:', e?.message)
        ip2 = null
      }
      return ip2
    })()
  }
  return ip2Promise
}

let tableReady = false
async function ensureTable() {
  if (tableReady) return
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ip_locations (
    user_id TEXT PRIMARY KEY,
    ip TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    province TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`)
  tableReady = true
}

function cityLabel(r: any): string {
  if (!r) return ''
  const c = r.city && r.city !== '0' ? r.city : ''
  const p = r.province && r.province !== '0' ? r.province : ''
  if (c && c !== p) return c // 河南郑州 → 郑州
  return p || '' // 直辖市 → 北京
}

export default async function geoRoutes(fastify: FastifyInstance) {
  // GET /api/v1/geo/ip — 当前用户 IP 属地（顺便刷新记录）
  fastify.get('/api/v1/geo/ip', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    try {
      await ensureTable()
      await loadIp2()
      const ip = getClientIp(request) || 'unknown'
      const r = ip2 ? ip2.search(ip) : null
      const province = r?.province && r.province !== '0' ? r.province : ''
      const city = r?.city && r.city !== '0' ? r.city : ''
      const uid = String(request.user?.id || '')
      if (uid) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO ip_locations (user_id, ip, country, province, city, updated_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (user_id) DO UPDATE SET ip=$2, country=$3, province=$4, city=$5, updated_at=now()`,
          uid, ip, r?.country || '', province, city,
        )
      }
      return { success: true, data: { ip, province, city, label: cityLabel(r) } }
    } catch (e: any) {
      return reply.code(500).send({ success: false, message: e.message })
    }
  })

  // GET /api/v1/geo/batch?userIds=a,b,c — 批量查属地（24h 内有效）
  fastify.get('/api/v1/geo/batch', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    try {
      await ensureTable()
      const ids = String(request.query?.userIds || '').split(',').map((s: string) => s.trim()).filter(Boolean)
      const out: Record<string, { province: string; city: string; label: string }> = {}
      if (ids.length) {
        const rows: any[] = await prisma.$queryRawUnsafe(
          `SELECT user_id, province, city FROM ip_locations WHERE user_id = ANY($1) AND updated_at > now() - interval '24 hours'`,
          ids,
        )
        for (const row of rows) {
          out[String(row.user_id)] = { province: row.province || '', city: row.city || '', label: cityLabel(row) }
        }
      }
      return { success: true, data: out }
    } catch (e: any) {
      return reply.code(500).send({ success: false, message: e.message })
    }
  })
}
