/**
 * routes/hdz/upload.ts — 小说文档上传路由
 *
 * POST /api/hdz/upload/:projectId
 * multipart/form-data: file（必填，仅支持 .txt / .docx）
 *
 * 流程：
 *   1. 接收文件 → 临时保存
 *   2. documentParser → 解析章节
 *   3. 批量创建 HdzChapter
 *   4. 更新 project title（如果当前为空）
 *   5. 返回导入统计
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { prisma } from '../../utils/index.js'
import { parseDocumentFile } from '../../services/hdz/document-parser.service.js'

// 临时上传目录
const UPLOAD_DIR = path.resolve(process.cwd(), 'tmp', 'hdz-uploads')

export default async function hdzUploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // POST /api/hdz/upload/:projectId — 上传文档
  app.post('/api/hdz/upload/:projectId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any
    const { projectId } = request.params as any

    // 1. 验证项目所有权
    const project = await prisma.hdzProject.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 2. 接收文件
    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ success: false, error: '请上传文件' })
    }

    // 验证文件类型
    const filename = data.filename
    const ext = path.extname(filename).toLowerCase()
    if (ext !== '.txt' && ext !== '.docx') {
      return reply.status(400).send({ success: false, error: '仅支持 .txt 和 .docx 文件' })
    }

    // 3. 保存临时文件（用 pump 确保流完全写完）
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const tmpId = randomUUID()
    const tmpPath = path.join(UPLOAD_DIR, `${tmpId}${ext}`)
    const { pipeline } = await import('node:stream/promises')
    const writeStream = fs.createWriteStream(tmpPath)

    try {
      await pipeline(data.file, writeStream)
    } catch (err: any) {
      fs.unlink(tmpPath, () => {})
      return reply.status(400).send({ success: false, error: `文件写入失败: ${err.message}` })
    }

    // 4. 解析文档
    let parsed: { title: string; chapters: { title: string | null; content: string }[] }
    try {
      parsed = await parseDocumentFile(tmpPath, filename)
    } catch (err: any) {
      // 清理临时文件
      fs.unlink(tmpPath, () => {})
      return reply.status(400).send({ success: false, error: `文档解析失败: ${err.message}` })
    }

    // 5. 检查章节数
    if (parsed.chapters.length === 0) {
      fs.unlink(tmpPath, () => {})
      return reply.status(400).send({ success: false, error: '文档中未识别到有效章节内容' })
    }

    // 6. 获取已有的最大 chapterNo
    const lastChapter = await prisma.hdzChapter.findFirst({
      where: { projectId },
      orderBy: { chapterNo: 'desc' },
      select: { chapterNo: true },
    })
    let nextNo = (lastChapter?.chapterNo ?? 0) + 1

    // 7. 批量创建章节
    const createdChapters = []
    for (const ch of parsed.chapters) {
      const content = ch.content
      const wordCount = content.replace(/\s/g, '').length
      const created = await prisma.hdzChapter.create({
        data: {
          projectId,
          chapterNo: nextNo++,
          title: ch.title || `第 ${nextNo - 1} 章`,
          content,
          wordCount,
          status: 'draft',
        },
      })
      createdChapters.push(created)
    }

    // 8. 如果项目还没有标题，用文档标题填充
    if (!project.title || project.title === '未命名项目') {
      await prisma.hdzProject.update({
        where: { id: projectId },
        data: {
          title: parsed.title,
          // 如果 status 还是新建，改为 active
          status: project.status === 'draft' ? 'active' : undefined,
        },
      })
    }

    // 9. 清理临时文件
    fs.unlink(tmpPath, () => {})

    return {
      success: true,
      data: {
        projectTitle: parsed.title,
        chapterCount: createdChapters.length,
        totalWords: createdChapters.reduce((sum, c) => sum + (c.wordCount ?? 0), 0),
        chapters: createdChapters.map(c => ({
          id: c.id,
          chapterNo: c.chapterNo,
          title: c.title,
          wordCount: c.wordCount,
        })),
      },
    }
  })
}
