// 中国行政区划 API
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function regionRoutes(app: FastifyInstance) {

  // GET /api/regions — 获取地区列表
  // query: parentCode (可选，不传返回省份；传省份代码返回市；传市代码返回区县)
  app.get('/api/regions', async (request: any, reply: any) => {
    try {
      const { parentCode } = request.query as { parentCode?: string }

      const where: any = parentCode ? { parentCode } : { level: 1 }
      let regions
      try {
        regions = await prisma.chinaRegion.findMany({
          where,
          orderBy: { code: 'asc' },
          select: { code: true, name: true, level: true },
        })
      } catch {
        // chinaRegion 表不存在，返回空数组
        return { success: true, data: [] }
      }

      return { success: true, data: regions }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // GET /api/regions/tree — 获取完整地区树（级联选择用）
  app.get('/api/regions/tree', async () => {
    try {
      let provinces
      try {
        provinces = await prisma.chinaRegion.findMany({
          where: { level: 1 },
          orderBy: { code: 'asc' },
        })
      } catch {
        return { success: true, data: [] }
      }

      const result = []
      for (const prov of provinces) {
        const cities = await prisma.chinaRegion.findMany({
          where: { parentCode: prov.code },
          orderBy: { code: 'asc' },
        })

        const cityList = []
        for (const city of cities) {
          const districts = await prisma.chinaRegion.findMany({
            where: { parentCode: city.code },
            orderBy: { code: 'asc' },
          })

          cityList.push({
            value: city.code,
            label: city.name,
            children: districts.map((d: any) => ({
              value: d.code, label: d.name,
            })),
          })
        }

        result.push({
          value: prov.code,
          label: prov.name,
          children: cityList,
        })
      }

      return { success: true, data: result }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // PUT /api/user/region — 设置/更新用户地区（仅一次，后续报错）
  app.put('/api/user/region', { preHandler: [app.authenticate] }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id
      const { provinceCode, provinceName, cityCode, cityName, districtCode, districtName } = request.body as any

      // 检查是否已经设置了地区
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { provinceCode: true, cityCode: true, districtCode: true },
      })

      if (user?.provinceCode || user?.cityCode || user?.districtCode) {
        return reply.status(400).send({ success: false, error: '地区已设置，不可修改' })
      }

      await prisma.user.update({
        where: { id: userId },
        data: { provinceCode, provinceName, cityCode, cityName, districtCode, districtName },
      })

      return { success: true, message: '地区已设置' }
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })
}
