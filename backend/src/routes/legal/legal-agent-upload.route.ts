/**
 * routes/legal/legal-agent-upload.route.ts
 *
 * AI 法律顾问文件上传（不依赖具体案件）
 */

import type { FastifyInstance } from 'fastify'
import * as fs from 'fs'
import * as path from 'path'
import { randomUUID } from 'crypto'

export default async function legalAgentUploadRoutes(app: FastifyInstance) {
  // POST /api/legal/agent/upload — 上传文件（图片/文档）
  app.post('/api/legal/agent/upload', async (request, reply) => {
    try {
      // Fastify 的 multipart 通过 @fastify/multipart 插件
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ success: false, error: '未找到上传文件' })
      }

      const buffer = await data.toBuffer()
      const originalName = data.filename || 'upload'
      const mimeType = data.mimetype || 'application/octet-stream'

      // 检查文件大小（10MB 限制）
      const MAX_SIZE = 10 * 1024 * 1024
      if (buffer.length > MAX_SIZE) {
        return reply.status(413).send({ success: false, error: '文件过大，最大支持 10MB' })
      }

      // 只允许图片和文档
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
      const baseType = mimeType.split('/')[0]
      if (!allowedMimes.includes(mimeType) && baseType !== 'image') {
        return reply.status(400).send({ success: false, error: `不支持的文件类型：${mimeType}` })
      }

      // 先尝试 COS 上传
      let url = ''
      try {
        const { default: cosService } = await import('../../services/cos.service.js')
        const result = await cosService.uploadBuffer(buffer, originalName, '__legal_adviser__')
        url = result.cosUrl
      } catch {
        // COS 失败，存本地
        const localDir = '/root/shipin-cinematic-studio/backend/public/uploads/legal-agent'
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true })
        const ext = originalName.split('.').pop() || 'bin'
        const localName = `${randomUUID()}.${ext}`
        const localPath = path.join(localDir, localName)
        fs.writeFileSync(localPath, buffer)
        url = `/uploads/legal-agent/${localName}`
      }

      // 对于图片，返回 base64 预览供 AI 分析
      let base64 = ''
      if (mimeType.startsWith('image/')) {
        base64 = `data:${mimeType};base64,${buffer.toString('base64').slice(0, 500)}...`
      }

      return {
        success: true,
        data: {
          url,
          mimeType,
          fileName: originalName,
          size: buffer.length,
          isImage: mimeType.startsWith('image/'),
        },
      }
    } catch (err: any) {
      console.error('[LegalAgentUpload] 上传失败:', err.message)
      return reply.status(500).send({ success: false, error: `上传失败：${err.message}` })
    }
  })

  // 提供静态文件访问
  app.get('/uploads/legal-agent/:filename', async (request, reply) => {
    const { filename } = request.params as any
    const filePath = path.join('/root/shipin-cinematic-studio/backend/public/uploads/legal-agent', filename)
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ success: false, error: '文件不存在' })
    }
    const content = fs.readFileSync(filePath)
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf',
      txt: 'text/plain', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }
    reply.type(mimeMap[ext || ''] || 'application/octet-stream')
    return reply.send(content)
  })
}
