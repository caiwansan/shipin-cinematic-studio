/**
 * proxy-image.ts — 图片代理，解决火山 TOS CORS 问题
 *
 * GET /api/proxy/image?url=<encoded-url>
 * 从火山 TOS 下载图片流并返回（附带 CORS header）
 */

import { FastifyInstance } from 'fastify'
import * as https from 'https'
import * as http from 'http'
import { URL } from 'url'

export default async function proxyImageRoutes(app: FastifyInstance) {
  app.get('/api/proxy/image', async (request, reply) => {
    const { url } = request.query as any
    if (!url) {
      return reply.status(400).send({ error: '缺少 url 参数' })
    }

    // 只允许代理火山 TOS 图片
    const decodedUrl = decodeURIComponent(url)
    let parsedUrl: URL
    try {
      parsedUrl = new URL(decodedUrl)
    } catch {
      return reply.status(400).send({ error: '无效的 URL' })
    }

    // SSRF 防护：精确域名匹配，禁止内网
    const ALLOWED_HOSTS = ['tos-cn-beijing.volces.com', 'volces.com']
    if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
      return reply.status(403).send({ error: '只允许代理火山 TOS 图片' })
    }
    if (parsedUrl.hostname === '127.0.0.1' || parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '0.0.0.0') {
      return reply.status(403).send({ error: '禁止代理内网地址' })
    }

    try {
      const client = parsedUrl.protocol === 'https:' ? https : http

      const response = await new Promise<{ statusCode: number; headers: any; data: Buffer }>((resolve, reject) => {
        client.get(decodedUrl, { timeout: 15000 }, (res) => {
          const chunks: Buffer[] = []
          res.on('data', (chunk: Buffer) => chunks.push(chunk))
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode || 200,
              headers: res.headers,
              data: Buffer.concat(chunks),
            })
          })
          res.on('error', reject)
        }).on('error', reject).on('timeout', function(this: any) { this.destroy(); reject(new Error('timeout')) })
      })

      if (response.statusCode !== 200) {
        return reply.status(response.statusCode).send({ error: '代理请求失败' })
      }

      // 设置 CORS 和缓存
      reply
        .header('Access-Control-Allow-Origin', '*')
        .header('Cache-Control', 'public, max-age=86400')
        .header('Content-Type', response.headers['content-type'] || 'image/jpeg')
        .header('Content-Length', response.data.length)
        .send(response.data)
    } catch (err: any) {
      console.error('[proxy-image] 代理失败:', err.message)
      return reply.status(502).send({ error: '代理请求失败: ' + err.message })
    }
  })
}
