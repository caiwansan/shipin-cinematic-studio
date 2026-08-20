import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { randomUUID } from 'crypto'

export default async function teaMediaRoutes(fastify: any) {
  // 通用媒体上传（图片/视频/文件）→ /uploads/tea/
  fastify.post('/api/tea/media/upload', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    let data: any
    try { data = await request.file() } catch (e: any) { return reply.status(400).send({ error: '无文件数据' }) }
    if (!data) return reply.status(400).send({ error: '无文件' })
    const safeExt = (path.extname(data.filename || '').toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|mp4|webm|mov|mp3|wav|ogg|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|txt|md)$/) || [])[0] || '.bin'
    const name = randomUUID() + safeExt
    const dir = path.join(process.cwd(), 'public/uploads/tea')
    try { fs.mkdirSync(dir, { recursive: true }) } catch (e) {}
    try {
      await pipeline(data.file, fs.createWriteStream(path.join(dir, name)))
    } catch (e: any) { return reply.status(500).send({ error: '写入失败' }) }
    const url = 'https://aigc.fushtn.com/uploads/tea/' + name
    return { success: true, data: { url, name } }
  })

  // 删除媒体文件（群图片/文件 7 天 TTL 自动销毁）
  fastify.post('/api/tea/media/delete', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { url } = (request.body as any) || {}
    const u = String(url || '')
    const m = u.match(/\/uploads\/tea\/([a-f0-9-]+\.\w+)$/)
    if (!m) return reply.status(400).send({ error: 'url 不合法' })
    const file = path.join(process.cwd(), 'public/uploads/tea', m[1])
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file)
      return { success: true, data: { deleted: true } }
    } catch (e: any) { return reply.status(500).send({ error: e.message }) }
  })
}