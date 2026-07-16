import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

const DEFAULT_CONFIG: Record<string, string> = {
  site_name: '昆仑镜',
  site_title: '昆仑镜 – AI 短剧创作平台',
  site_description: '用 AI 从剧本到成片，一站式短剧创作平台',
  site_keywords: '昆仑镜, AI, 短剧, 创作平台',
  icp_beian: '',
  icp_license: '',
  icp_company: '',
  icp_business: '',
  icp_copyright: '',
  site_domain: 'aigc.fushtn.com',
  og_image: '',
}

// 公开配置（前端读取，无需登录）
async function getPublicConfig() {
  try {
    const rows = await prisma.siteConfig.findMany({
      where: { key: { in: Object.keys(DEFAULT_CONFIG) } }
    })
    const config: Record<string, string> = { ...DEFAULT_CONFIG }
    for (const row of rows) {
      config[row.key] = row.value
    }
    return config
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export default async function siteConfigRoutes(fastify: FastifyInstance) {

  // GET /api/system/config — 公开读取站点配置（给前端 SEO 用）
  fastify.get('/api/system/config', async (_request, _reply) => {
    const config = await getPublicConfig()
    return config
  })

  // GET /api/admin/system/config — 管理员读取全部配置
  fastify.get('/api/admin/system/config', async (_request, _reply) => {
    try {
      const rows = await prisma.siteConfig.findMany()
      const config: Record<string, string> = { ...DEFAULT_CONFIG }
      for (const row of rows) {
        config[row.key] = row.value
      }
      return config
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  })

  // PUT /api/admin/system/config — 管理员更新配置
  fastify.put('/api/admin/system/config', async (request, _reply) => {
    const body = request.body as Record<string, string>
    const allowed = Object.keys(DEFAULT_CONFIG)

    try {
      for (const key of allowed) {
        if (body[key] !== undefined) {
          await prisma.siteConfig.upsert({
            where: { key },
            update: { value: String(body[key]) },
            create: { key, value: String(body[key]) },
          })
        }
      }
    } catch { /* 表不存在时静默 */ }

    return { success: true }
  })
}
