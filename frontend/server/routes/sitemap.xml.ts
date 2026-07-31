// /sitemap.xml — 动态代理到后端 SystemConfig（Sprint-ADMIN-IA-REALITY-03 T01）
export default defineEventHandler(async (event) => {
  const res = event.node.res
  const setXml = (text: string) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    return text
  }
  const backend = process.env.BACKEND_URL || 'http://127.0.0.1:4002'
  try {
    const upstream = await fetch(`${backend}/sitemap.xml`, { headers: { accept: 'application/xml' } })
    if (!upstream.ok) throw new Error(`backend ${upstream.status}`)
    return setXml(await upstream.text())
  } catch {
    return setXml('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n')
  }
})
