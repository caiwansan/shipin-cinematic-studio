import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

/**
 * 平台系统配置路由（Sprint-ADMIN-IA-REALITY-03 T01）
 *
 * 存储：SystemConfig 表（key/value/group/updatedBy/updatedAt）
 * 分组：
 *   site   — 基础信息（系统名称/Logo/favicon/域名/ICP/网站介绍）
 *   seo    — SEO 设置（标题/关键词/描述/Meta模板/robots/sitemap/搜索引擎验证）
 *
 * 公开端点：/api/system/config（官网/前台 SEO 用）
 * 管理端点：/api/admin/system/config（requireAdmin）
 * 动态端点：/robots.txt /sitemap.xml（nginx 走 @nuxt → 由 nuxt 代理到后端）
 */

export const SYSTEM_CONFIG_DEFAULTS: Record<string, { group: string; value: string }> = {
  // ── site 基础信息 ──
  site_name: { group: 'site', value: '昆仑镜' },
  site_title: { group: 'site', value: '昆仑镜 – AI 短剧创作平台' },
  site_description: { group: 'site', value: '用 AI 从剧本到成片，一站式短剧创作平台' },
  site_keywords: { group: 'site', value: '昆仑镜, AI, 短剧, 创作平台' },
  site_logo: { group: 'site', value: '/logo.png' },
  site_favicon: { group: 'site', value: '/favicon.ico' },
  site_domain: { group: 'site', value: 'aigc.fushtn.com' },
  site_intro: { group: 'site', value: '' },
  icp_beian: { group: 'site', value: '' },
  icp_license: { group: 'site', value: '' },
  icp_company: { group: 'site', value: '' },
  icp_business: { group: 'site', value: '' },
  icp_copyright: { group: 'site', value: '' },
  og_image: { group: 'site', value: '' },
  // ── 财务/钻石兑换 ──
  // 钻石兑换比例：1 元 = N 钻石（掌柜 2026-08-06 定调 1:10，后台可改）
  diamond_exchange_rate: { group: 'site', value: '10' },
  // ── 社区发帖 ──
  // 每日发帖上限（篇/人/天）与发帖奖励（钻石/篇，审核通过时发放）
  // 掌柜 2026-08-07 定调：每日限发 20 篇，每篇奖励 2 钻石（后台可改）
  community_daily_post_limit: { group: 'site', value: '20' },
  community_post_reward_diamonds: { group: 'site', value: '2' },
  // ── seo 设置 ──
  seo_title: { group: 'seo', value: '昆仑镜 – AI 短剧创作平台' },
  seo_keywords: { group: 'seo', value: '昆仑镜, AI, 短剧, 创作平台' },
  seo_description: { group: 'seo', value: '用 AI 从剧本到成片，一站式短剧创作平台' },
  seo_robots: { group: 'seo', value: 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /workspace/\nDisallow: /profile/\nDisallow: /enterprise/' },
  seo_sitemap_urls: { group: 'seo', value: '/\n/about\n/pricing' },
  seo_verify_baidu: { group: 'seo', value: '' },
  seo_verify_google: { group: 'seo', value: '' },
}

// key → group 白名单（防止写入未知 key）
const KEY_GROUPS: Record<string, string> = Object.fromEntries(
  Object.entries(SYSTEM_CONFIG_DEFAULTS).map(([k, v]) => [k, v.group])
)

export async function getSystemConfig(group?: string): Promise<Record<string, string>> {
  const rows = await prisma.systemConfig.findMany(
    group ? { where: { group } } : undefined
  )
  const config: Record<string, string> = {}
  // 先填默认值
  for (const [key, meta] of Object.entries(SYSTEM_CONFIG_DEFAULTS)) {
    if (!group || meta.group === group) config[key] = meta.value
  }
  // DB 值覆盖
  for (const row of rows) {
    if (KEY_GROUPS[row.key]) config[row.key] = row.value
  }
  return config
}

export async function saveSystemConfig(body: Record<string, string>, updatedBy?: string): Promise<void> {
  for (const [key, rawValue] of Object.entries(body)) {
    if (!KEY_GROUPS[key]) continue // 白名单过滤
    let value = String(rawValue ?? '')
    // 钻石兑换比例：强制 1~10000 的正整数（防 0/负数/非数字）
    if (key === 'diamond_exchange_rate') {
      const n = Math.floor(Number(value))
      value = String(Number.isFinite(n) ? Math.min(Math.max(n, 1), 10000) : 10)
    }
    // 社区发帖配置：强制 1~1000 的正整数（防 0/负数/非数字）
    if (key === 'community_daily_post_limit' || key === 'community_post_reward_diamonds') {
      const n = Math.floor(Number(value))
      value = String(Number.isFinite(n) ? Math.min(Math.max(n, 1), 1000) : (key === 'community_daily_post_limit' ? 20 : 2))
    }
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value, group: KEY_GROUPS[key], updatedBy },
      create: { key, value, group: KEY_GROUPS[key], updatedBy },
    })
  }
}

export default async function siteConfigRoutes(fastify: FastifyInstance) {

  // GET /api/system/config — 公开读取站点配置（给前端 SEO 用）
  fastify.get('/api/system/config', async (_request, _reply) => {
    try {
      return await getSystemConfig()
    } catch {
      return Object.fromEntries(
        Object.entries(SYSTEM_CONFIG_DEFAULTS).map(([k, v]) => [k, v.value])
      )
    }
  })

  // GET /api/admin/system/config — 管理员读取全部配置（需登录）
  fastify.get('/api/admin/system/config', { preHandler: requireAdmin }, async () => {
    return getSystemConfig()
  })

  // PUT /api/admin/system/config — 管理员更新配置（需登录）
  fastify.put('/api/admin/system/config', { preHandler: requireAdmin }, async (request, _reply) => {
    const body = request.body as Record<string, string>
    const { extractAdmin } = await import('../middleware/require-admin.js')
    const admin = extractAdmin(request)
    const updatedBy = admin?.username || 'admin'
    await saveSystemConfig(body, updatedBy)
    return { success: true, config: await getSystemConfig() }
  })

  // GET /robots.txt — 动态生成（SE0 设置里配置 robots 内容）
  fastify.get('/robots.txt', async (_request, reply) => {
    const config = await getSystemConfig('seo')
    const domain = (await getSystemConfig('site')).site_domain || 'aigc.fushtn.com'
    const robots = config.seo_robots || SYSTEM_CONFIG_DEFAULTS.seo_robots.value
    const sitemapLine = `Sitemap: https://${domain}/sitemap.xml`
    const body = robots.includes('Sitemap:') ? robots : `${robots}\n\n${sitemapLine}`
    return reply.type('text/plain; charset=utf-8').send(body)
  })

  // GET /sitemap.xml — 动态生成（静态页 + 社区已通过帖子）
  fastify.get('/sitemap.xml', async (_request, reply) => {
    const site = await getSystemConfig('site')
    const seo = await getSystemConfig('seo')
    const domain = site.site_domain || 'aigc.fushtn.com'
    const urls = (seo.seo_sitemap_urls || '/').split('\n').map(s => s.trim()).filter(Boolean)
    const lastmod = new Date().toISOString().slice(0, 10)

    // SEO-REVIEW-01: 注入社区已通过帖子（未审核/被驳回/已删除一律不进 sitemap）
    const posts = await prisma.communityPost.findMany({
      where: { status: 'approved' },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    })

    const staticUrls = urls.map(u => `  <url><loc>https://${domain}${u.startsWith('/') ? u : '/' + u}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`).join('\n')
    const postUrls = posts.map(p => {
      const d = p.updatedAt instanceof Date ? p.updatedAt.toISOString().slice(0, 10) : lastmod
      return `  <url><loc>https://${domain}/community/post/${p.id}</loc><lastmod>${d}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
    }).join('\n')

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}${postUrls ? '\n' + postUrls : ''}
</urlset>`
    return reply.type('application/xml; charset=utf-8').send(body)
  })
}
