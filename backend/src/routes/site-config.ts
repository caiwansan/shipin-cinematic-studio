import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

// 公开配置（前端读取，无需登录）
async function getPublicConfig() {
  const rows = await prisma.siteConfig.findMany({
    where: { key: { in: ['site_name', 'site_title', 'site_description', 'site_keywords', 'icp_beian', 'icp_license', 'icp_company', 'icp_business', 'icp_copyright', 'site_domain', 'og_image'] } }
  })
  const config: Record<string, string> = {}
  for (const row of rows) {
    config[row.key] = row.value
  }
  return config
}

export default async function siteConfigRoutes(fastify: FastifyInstance) {

  // GET /api/system/config — 公开读取站点配置（给前端 SEO 用）
  fastify.get('/api/system/config', async (_request, _reply) => {
    const config = await getPublicConfig()
    return config
  })

  // GET /api/admin/system/config — 管理员读取全部配置
  fastify.get('/api/admin/system/config', async (_request, _reply) => {
    const rows = await prisma.siteConfig.findMany()
    const config: Record<string, string> = {}
    for (const row of rows) {
      config[row.key] = row.value
    }
    return config
  })

  // PUT /api/admin/system/config — 管理员更新配置
  fastify.put('/api/admin/system/config', async (request, _reply) => {
    const body = request.body as Record<string, string>
    const allowed = ['site_name', 'site_title', 'site_description', 'site_keywords', 'icp_beian', 'icp_license', 'icp_company', 'icp_business', 'icp_copyright', 'site_domain', 'og_image']

    for (const key of allowed) {
      if (body[key] !== undefined) {
        await prisma.siteConfig.upsert({
          where: { key },
          update: { value: String(body[key]) },
          create: { key, value: String(body[key]) },
        })
      }
    }

    return { success: true }
  })
}
