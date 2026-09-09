// tea-amap.routes.ts — 高德地图(定位/静态图) 后端代理
// 复用 route_config 中 amapWebKey; 让 native 发"位置"消息 + 展示静态地图, key 不暴露。
// 2026-08-24: 支持 Web 服务签名校验（key 配置了数字签名时自动带 sig 参数）
import { FastifyInstance, FastifyReply } from 'fastify'
import crypto from 'node:crypto'
import { prisma } from '../utils/index.js'

async function amapCfg(): Promise<{ key: string; sec: string }> {
  const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } })
  const v: any = row?.value || {}
  return {
    key: v.amapWebKey || v.amapKey || '',
    sec: v.amapWebSecret || '',
  }
}

// 高德 Web 服务签名规则：参数按字典序拼接（原始值不 URL 编码）+ 私钥 → md5
function amapUrl(path: string, params: Record<string, string>, key: string, sec: string): string {
  const all: Record<string, string> = { key, output: 'JSON', ...params }
  if (sec) {
    const sorted = Object.keys(all).sort()
    const raw = sorted.map((k) => `${k}=${all[k]}`).join('&')
    all.sig = crypto.createHash('md5').update(raw + sec).digest('hex')
  }
  const qs = new URLSearchParams(all)
  return `https://restapi.amap.com${path}?${qs.toString()}`
}

export default async function teaAmapRoutes(fastify: FastifyInstance) {

  // 地理编码: 地址 → 经纬度(高德 v3 geocode)
  fastify.get('/api/tea/amap/geocode', { preHandler: [fastify.authenticate] }, async (req: any, reply: FastifyReply) => {
    const addr = String((req.query as any)?.addr || '').trim()
    if (!addr) return reply.status(400).send({ success: false, error: 'addr 必填' })
    const { key, sec } = await amapCfg()
    if (!key) return reply.status(400).send({ success: false, error: '未配置高德key' })
    const gj: any = await (await fetch(amapUrl('/v3/geocode/geo', { address: addr }, key, sec))).json()
    const g = (gj.geocodes || [])[0]
    if (!g || !g.location) return reply.status(404).send({ success: false, error: '未找到该地址' })
    const [lng, lat] = String(g.location).split(',')
    return { success: true, data: { lat: Number(lat), lng: Number(lng), addr: g.formatted_address || addr, adcode: g.adcode || '' } }
  })

  // 静态地图: 按经纬度生成静态图(代理高德静态图API, 返回PNG)
  fastify.get('/api/tea/amap/staticmap', async (req: any, reply: FastifyReply) => {
    const lng = String((req.query as any)?.lng || ''); const lat = String((req.query as any)?.lat || '')
    const addr = String((req.query as any)?.addr || '').trim()
    const w = Number((req.query as any)?.w) || 560; const h = Number((req.query as any)?.h) || 200
    if (!lng || !lat) return reply.status(400).send({ success: false, error: 'lng/lat 必填' })
    const { key, sec } = await amapCfg()
    if (!key) return reply.status(400).send({ success: false, error: '未配置高德key' })
    const markers = `mid,,0,${lng},${lat}` // 中间定位标记
    const labels = addr ? encodeURIComponent(addr) : ''
    const resp = await fetch(amapUrl('/v3/staticmap', { location: `${lng},${lat}`, zoom: '16', size: `${w}*${h}`, markers, labels }, key, sec))
    const buf = Buffer.from(await resp.arrayBuffer())
    reply.header('content-type', resp.headers.get('content-type') || 'image/png')
    reply.header('cache-control', 'public, max-age=86400')
    return reply.send(buf)
  })
}
