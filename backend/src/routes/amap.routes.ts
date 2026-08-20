// amap.routes.ts — 高德地图 Web服务代理（key 已配 IP 白名单 + 签名校验）
// 供昆仑茶馆本地版网关转发：/api/local/amap/* → 本接口 → restapi.amap.com
// 签名：参数按字典序拼接 + 私钥 → md5（高德 Web服务 签名规则）
import { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'

import { prisma } from '../utils/index.js'

const AMAP_HOST = 'restapi.amap.com'
// 高德密钥从后台配置读取（昆仑茶馆管理 → API 密钥配置），不再硬编码
let AMAP_KEY = ''
let AMAP_SECRET = ''
async function loadAmapConfig() {
  try {
    const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } })
    const v: any = row?.value || {}
    AMAP_KEY = v.amapWebKey || ''
    AMAP_SECRET = v.amapWebSecret || ''
  } catch (e) { /* 保留上次值 */ }
}

function amapUrl(path: string, params: Record<string, string>): string {
  const all: Record<string, string> = { key: AMAP_KEY, output: 'JSON', ...params }
  const sorted = Object.keys(all).sort()
  const raw = sorted.map((k) => `${k}=${all[k]}`).join('&')
  const sig = crypto.createHash('md5').update(raw + AMAP_SECRET).digest('hex')
  const qs = new URLSearchParams(all)
  qs.set('sig', sig)
  return `https://${AMAP_HOST}${path}?${qs.toString()}`
}

export default async function amapRoutes(fastify: FastifyInstance) {
  await loadAmapConfig()
  // GET /api/v1/amap/search?keywords=&city= — 地点搜索（POI）
  fastify.get('/api/v1/amap/search', async (request: any, reply: any) => {
    try {
      const keywords = String(request.query?.keywords || '').trim()
      if (!keywords) return reply.code(400).send({ success: false, message: 'keywords 必填' })
      const params: Record<string, string> = { keywords, offset: '20' }
      if (request.query?.city) {
        params.city = String(request.query.city).trim()
        params.citylimit = 'true'
      }
      const res = await fetch(amapUrl('/v3/place/text', params))
      const j: any = await res.json()
      if (String(j.status) !== '1') return reply.code(502).send({ success: false, message: j.info || '搜索失败' })
      const pois = (j.pois || []).map((poi: any) => {
        const [lng, lat] = String(poi.location || '').split(',').map(Number)
        return { name: poi.name || '', address: poi.address || '', lng, lat, type: poi.type || '' }
      })
      return { success: true, data: pois }
    } catch (e: any) {
      return reply.code(502).send({ success: false, message: e.message })
    }
  })

  // GET /api/v1/amap/geocode?address= — 地址转经纬度
  fastify.get('/api/v1/amap/geocode', async (request: any, reply: any) => {
    try {
      const address = String(request.query?.address || '').trim()
      if (!address) return reply.code(400).send({ success: false, message: 'address 必填' })
      const res = await fetch(amapUrl('/v3/geocode/geo', { address }))
      const j: any = await res.json()
      if (String(j.status) !== '1') return reply.code(502).send({ success: false, message: j.info || '编码失败' })
      const g = (j.geocodes || [])[0]
      const [lng, lat] = String(g?.location || '').split(',').map(Number)
      return { success: true, data: { lng, lat, formatted: g?.formatted_address || '', level: g?.level || '' } }
    } catch (e: any) {
      return reply.code(502).send({ success: false, message: e.message })
    }
  })

  // GET /api/v1/amap/regeo?location=lng,lat — 逆地理编码（坐标→地址）
  fastify.get('/api/v1/amap/regeo', async (request: any, reply: any) => {
    try {
      const location = String(request.query?.location || '').trim()
      if (!location || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(location)) {
        return reply.code(400).send({ success: false, message: 'location 格式应为 lng,lat' })
      }
      const res = await fetch(amapUrl('/v3/geocode/regeo', { location, extensions: 'base', radius: '200' }))
      const j: any = await res.json()
      if (String(j.status) !== '1') return reply.code(502).send({ success: false, message: j.info || '逆编码失败' })
      const r = j.regeocode || {}
      const c = r.addressComponent || {}
      const area = [c.province, c.city, c.district].filter(Boolean).join('')
      const name = (r.pois && r.pois[0] && r.pois[0].name) || r.formatted_address || area || '我的位置'
      const address = r.formatted_address || area || ''
      return { success: true, data: { name, address, formatted: r.formatted_address || '', province: c.province || '', city: c.city || '', district: c.district || '', adcode: c.adcode || '' } }
    } catch (e: any) {
      return reply.code(502).send({ success: false, message: e.message })
    }
  })
}
