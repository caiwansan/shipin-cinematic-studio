// 中国行政区划 API
// Data source: backend/data/regions/pca-code.json (唯一权威来源)
// 格式: { "86": {"110000":"北京市"}, "110000": {"110100":"市辖区"}, "110100": {"110101":"东城区", ...} }
import { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'

// 缓存 pca 数据
let pcaData: Record<string, Record<string, string>> | null = null

function loadPCAData(): Record<string, Record<string, string>> {
  if (pcaData) return pcaData
  const dataPath = path.resolve(process.cwd(), 'data/regions/pca-code.json')
  if (fs.existsSync(dataPath)) {
    try {
      pcaData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
      return pcaData!
    } catch (e) {
      console.error('[regions] Failed to load pca-code.json:', e)
    }
  }
  console.error('[regions] pca-code.json not found at', dataPath)
  pcaData = { '86': {} }
  return pcaData!
}

/** 根据父 code 获取子区域列表 */
function getChildren(parentCode: string): Array<{ code: string; name: string; level: number }> {
  const data = loadPCAData()
  const children = data[parentCode]
  if (!children) return []
  return Object.entries(children).map(([code, name]) => ({ code, name, level: 0 }))
}

// 需要 prisma（留给 PUT /api/user/region 用）
import { prisma } from '../utils/index.js'

export default async function regionRoutes(app: FastifyInstance) {

  // GET /api/regions — 获取地区列表
  // query: parentCode (可选，不传返回省份；传省份代码返回市；传市代码返回区县)
  app.get('/api/regions', async (request: any, reply: any) => {
    try {
      const { parentCode } = request.query as { parentCode?: string }
      const regions = parentCode ? getChildren(parentCode) : getChildren('86')
      return { success: true, data: regions }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // GET /api/regions/tree — 获取完整地区树（级联选择用）
  app.get('/api/regions/tree', async () => {
    try {
      const provinces = getChildren('86')
      const result = []
      for (const prov of provinces) {
        const cities = getChildren(prov.code)
        const cityList = []
        for (const city of cities) {
          const districts = getChildren(city.code)
          cityList.push({
            value: city.code,
            label: city.name,
            children: districts.map(d => ({ value: d.code, label: d.name })),
          })
        }
        result.push({ value: prov.code, label: prov.name, children: cityList })
      }
      return { success: true, data: result }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // GET /api/user/region — 获取当前用户地区信息
  app.get('/api/user/region', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { provinceCode: true, provinceName: true, cityCode: true, cityName: true, districtCode: true, districtName: true },
      })
      if (!user || (!user.provinceCode && !user.cityCode && !user.districtCode)) {
        return { success: true, data: { hasRegion: false } }
      }
      return {
        success: true,
        data: {
          hasRegion: true,
          provinceCode: user.provinceCode,
          provinceName: user.provinceName,
          cityCode: user.cityCode,
          cityName: user.cityName,
          districtCode: user.districtCode,
          districtName: user.districtName,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // PUT /api/user/region — 设置/更新用户地区（幂等，可重复更新）
  app.put('/api/user/region', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id
      const { provinceCode, provinceName, cityCode, cityName, districtCode, districtName } = request.body as any

      // 验证必填字段
      if (!provinceCode || !cityCode || !districtCode) {
        return reply.status(400).send({ success: false, error: '请提供完整的地区信息（省/市/区县）' })
      }

      await prisma.user.update({
        where: { id: userId },
        data: { provinceCode, provinceName, cityCode, cityName, districtCode, districtName },
      })
      return { success: true, message: '地区已更新' }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })
}
