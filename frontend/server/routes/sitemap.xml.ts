// /sitemap.xml — 动态生成（静态页面 + 社区帖子）
export default defineEventHandler(async (event) => {
  const res = event.node.res
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=600') // 10 min cache

  const backend = process.env.BACKEND_URL || 'http://127.0.0.1:4002'
  const baseUrl = 'https://aigc.fushtn.com'

  const staticUrls = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/about', priority: '0.8', changefreq: 'monthly' },
    { loc: '/pricing', priority: '0.8', changefreq: 'monthly' },
    { loc: '/community', priority: '0.9', changefreq: 'daily' },
  ]

  let postUrls: Array<{ loc: string; lastmod?: string; priority: string; changefreq: string }> = []

  try {
    const res2 = await fetch(`${backend}/api/community/posts?page=1&pageSize=500`, {
      headers: { accept: 'application/json' },
    })
    if (res2.ok) {
      const data = await res2.json()
      postUrls = (data.posts || []).map((p: any) => ({
        loc: `/community/post/${p.id}`,
        lastmod: p.updatedAt || p.createdAt || new Date().toISOString(),
        priority: '0.6',
        changefreq: 'weekly',
      }))
    }
  } catch {
    // fallback: static urls only
  }

  const allUrls = [...staticUrls, ...postUrls]
  const urlEntries = allUrls
    .map(
      (u) => `  <url>\n    <loc>${baseUrl}${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`
})
