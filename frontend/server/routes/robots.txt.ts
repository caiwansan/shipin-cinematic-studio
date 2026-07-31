// /robots.txt — 动态代理到后端 SystemConfig（Sprint-ADMIN-IA-REALITY-03 T01）
// nginx location / → @nuxt(3000) → 此端点 → 后端 4002 /robots.txt
export default defineEventHandler(async (event) => {
  const res = event.node.res
  const setText = (text: string, type = 'text/plain; charset=utf-8') => {
    res.setHeader('Content-Type', type)
    res.setHeader('Cache-Control', 'no-cache')
    return text
  }
  const backend = process.env.BACKEND_URL || 'http://127.0.0.1:4002'
  try {
    const upstream = await fetch(`${backend}/robots.txt`, { headers: { accept: 'text/plain' } })
    if (!upstream.ok) throw new Error(`backend ${upstream.status}`)
    return setText(await upstream.text())
  } catch {
    // fallback: 基础 robots，禁止后台索引
    return setText('User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /workspace/\nDisallow: /profile/\nDisallow: /enterprise/\n')
  }
})
