// /sitemap.xml — 透传后端全量 sitemap（静态页 + 社区已通过帖子，take 500）
// 说明：后端 site-config.ts 已生成完整 sitemap（含 lastmod/priority），此处直接代理，
// 避免 Nitro 侧重复实现导致上限漂移（曾因 pageSize=50 导致 100+ 帖子收录不全）。
export default defineEventHandler(async (event) => {
  const res = event.node.res
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=600') // 10 min cache

  const backend = process.env.BACKEND_URL || 'http://127.0.0.1:4002'

  try {
    const upstream = await fetch(`${backend}/sitemap.xml`, {
      headers: { accept: 'application/xml' },
    })
    if (upstream.ok) {
      const body = await upstream.text()
      return body
    }
  } catch {
    // fall through to fallback
  }

  // Fallback：后端不可用时输出静态页最小 sitemap
  const baseUrl = 'https://aigc.fushtn.com'
  const staticUrls = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/about', priority: '0.8', changefreq: 'monthly' },
    { loc: '/pricing', priority: '0.8', changefreq: 'monthly' },
    { loc: '/community', priority: '0.9', changefreq: 'daily' },
  ]
  const entries = staticUrls
    .map((u) => `  <url>\n    <loc>${baseUrl}${u.loc}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
})
