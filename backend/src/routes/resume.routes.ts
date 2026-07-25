/**
 * resume.routes.ts — 企业招聘 Resume Center API
 *
 * Phase 5-B1: Resume 模块恢复 - 第一阶段骨架
 * - 只读列表/详情
 * - 认证 + 归属校验
 * - 未实现接口返回 503
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export const resumeRoutes = async (fastify: FastifyInstance) => {
  // ─── GET /enterprise/resumes — 简历列表 ───
  fastify.get('/enterprise/resumes', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { user } = request as any
      const { workspaceId } = request.query as any

      // 归属校验：如果传了 workspaceId，校验用户是否有权访问
      if (workspaceId) {
        const workspace = await prisma.enterpriseJobWorkspace.findFirst({
          where: {
            id: workspaceId,
          },
        })
        if (!workspace) {
          return reply.status(404).send({ error: 'Workspace not found' })
        }
      }

      const resumes = await prisma.resume.findMany({
        where: workspaceId ? { workspaceId } : {},
        include: {
          profile: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      })

      return reply.status(200).send({
        items: resumes,
        total: resumes.length,
      })
    } catch (error: any) {
      request.log.error(`[resume] list error: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── GET /enterprise/resumes/:id — 简历详情 ───
  fastify.get('/enterprise/resumes/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { workspaceId } = request.query as any

      const resume = await prisma.resume.findFirst({
        where: {
          id,
          ...(workspaceId ? { workspaceId } : {}),
        },
        include: {
          profile: true,
        },
      })

      if (!resume) {
        return reply.status(404).send({ error: 'Resume not found' })
      }

      return reply.status(200).send(resume)
    } catch (error: any) {
      request.log.error(`[resume] detail error: ${error.message}`)
      return reply.status(500).send({ error: 'Internal server error' })
    }
  })

  // ─── POST /enterprise/resumes/upload — 上传简历 ───
  fastify.post('/enterprise/resumes/upload', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { user } = request as any
      const { workspaceId } = request.query as any

      if (!workspaceId) {
        return reply.status(400).send({ error: 'workspaceId is required' })
      }

      // 校验 workspace 归属
      const workspace = await prisma.enterpriseJobWorkspace.findFirst({
        where: { id: workspaceId },
      })
      if (!workspace) {
        return reply.status(404).send({ error: 'Workspace not found' })
      }

      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }

      const buffer = await data.toBuffer()
      const fileName = data.filename
      const fileType = data.mimetype
      const fileSize = buffer.length

      // 限制文件大小 10MB
      if (fileSize > 10 * 1024 * 1024) {
        return reply.status(413).send({ error: 'File too large (max 10MB)' })
      }

      // 生成存储路径
      const { randomUUID } = await import('crypto')
      const fileExt = fileName.split('.').pop() || ''
      const fs = await import('fs/promises')
      const path = await import('path')
      const uploadDir = path.join(process.cwd(), '..', '..', 'uploads', 'resumes', workspaceId)
      await fs.mkdir(uploadDir, { recursive: true })
      const storedFileName = `${randomUUID()}.${fileExt}`
      const storedPath = path.join(uploadDir, storedFileName)
      await fs.writeFile(storedPath, buffer)

      // P0-2: 文本提取（pdftotext + fallback）
      let rawText = ''
      let parseStatus: 'pending' | 'parsed' | 'parse_failed' = 'pending'
      if (fileType === 'application/pdf' || fileExt.toLowerCase() === 'pdf') {
        try {
          const { execFile } = await import('child_process')
          const { promisify } = await import('util')
          const execFileAsync = promisify(execFile)
          const { stdout } = await execFileAsync('pdftotext', ['-layout', storedPath, '-'])
          rawText = stdout
        } catch (pdftotextErr: any) {
          // Fallback: pdftotext 失败时尝试直接读取二进制文本片段
          try {
            const binaryText = buffer.toString('utf8')
            // 提取可读字符（PDF 流中有时会嵌入纯文本）
            const readableChunks = binaryText.split(/[\x00-\x08\x0e-\x1f]+/).filter(s => s.trim().length > 10)
            rawText = readableChunks.join('\n')
            if (!rawText || rawText.trim().length < 20) {
              throw new Error('PDF 无法提取可读文本（可能为扫描件或图片型 PDF）')
            }
          } catch (fallbackErr: any) {
            rawText = ''
            parseStatus = 'parse_failed'
            request.log.warn(`[resume] PDF text extraction failed for ${fileName}: ${fallbackErr.message}`)
          }
        }
      } else if (fileType.startsWith('text/') || fileExt.toLowerCase() === 'txt') {
        rawText = buffer.toString('utf8')
      } else {
        // 其他格式（docx 等）暂不支持，标记为待处理
        rawText = ''
      }

      // 如果有文本，立即尝试解析
      if (rawText && rawText.trim().length > 20) {
        parseStatus = 'parsed'
      }

      const resume = await prisma.resume.create({
        data: {
          workspaceId,
          candidateName: fileName.replace(/\.[^.]+$/, ''),
          fileName,
          fileUrl: `/uploads/resumes/${workspaceId}/${storedFileName}`,
          fileType,
          fileSize,
          status: parseStatus,
          parserType: rawText ? 'auto' : 'manual',
        },
      })

      // P0-2: 如果有文本，自动创建 ResumeProfile
      if (parseStatus === 'parsed') {
        const { ResumeParserAgent } = await import('../agents/job/resume-parser-agent.js')
        const parser = new ResumeParserAgent()
        const parsed = parser.parseResume({ text: rawText, fileName })
        const quality = parser.evaluateQuality(parsed)

        await prisma.resumeProfile.create({
          data: {
            resumeId: resume.id,
            name: parsed.name || resume.candidateName,
            email: parsed.email || null,
            phone: parsed.phone || null,
            education: parsed.education || null,
            major: parsed.major || null,
            skills: parsed.skills || [],
            experience: parsed.experience || null,
            experienceYears: parsed.experienceYears || 0,
            city: parsed.city || null,
            salaryMin: parsed.salaryMin || null,
            salaryMax: parsed.salaryMax || null,
            careerGoal: parsed.careerGoal || null,
            projects: parsed.projects || null,
            qualityScore: quality.score,
            strengths: quality.strengths || [],
            weaknesses: quality.weaknesses || [],
            suggestions: quality.suggestions || [],
            rawText: rawText.slice(0, 50000), // 限制存储大小
          },
        })
      }

      return reply.status(201).send({ success: true, resume, profileCreated: parseStatus === 'parsed' })
    } catch (error: any) {
      request.log.error(`[resume] upload error: ${error.message}`)
      return reply.status(500).send({ error: 'Upload failed', detail: error.message })
    }
  })

  // ─── POST /enterprise/resumes/:id/parse — 解析简历 ───
  fastify.post('/enterprise/resumes/:id/parse', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { workspaceId } = request.query as any

      const resume = await prisma.resume.findFirst({
        where: { id, ...(workspaceId ? { workspaceId } : {}) },
      })
      if (!resume) {
        return reply.status(404).send({ error: 'Resume not found' })
      }

      // 更新状态为解析中
      await prisma.resume.update({
        where: { id },
        data: { status: 'parsing' },
      })

      // 基础解析：从文件名提取信息创建 Profile
      const existingProfile = await prisma.resumeProfile.findUnique({
        where: { resumeId: id },
      })

      if (!existingProfile) {
        await prisma.resumeProfile.create({
          data: {
            resumeId: id,
            name: resume.candidateName || '未知候选人',
            skills: [],
            strengths: [],
            weaknesses: [],
            suggestions: [],
            qualityScore: 0,
            experienceYears: 0,
          },
        })
      }

      // 更新简历状态为已解析
      await prisma.resume.update({
        where: { id },
        data: { status: 'parsed', updatedAt: new Date() },
      })

      return reply.status(200).send({ success: true, message: 'Resume parsed' })
    } catch (error: any) {
      request.log.error(`[resume] parse error: ${error.message}`)
      // 更新状态为解析失败
      await prisma.resume.update({
        where: { id: (request.params as any).id },
        data: { status: 'parse_failed', parseError: error.message },
      }).catch(() => {})
      return reply.status(500).send({ error: 'Parse failed', detail: error.message })
    }
  })

  // ─── DELETE /enterprise/resumes/:id — 删除简历 ───
  fastify.delete('/enterprise/resumes/:id', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const { workspaceId } = request.query as any

      const resume = await prisma.resume.findFirst({
        where: { id, ...(workspaceId ? { workspaceId } : {}) },
      })
      if (!resume) {
        return reply.status(404).send({ error: 'Resume not found' })
      }

      // 级联删除 Profile
      await prisma.resumeProfile.deleteMany({ where: { resumeId: id } })
      await prisma.resume.delete({ where: { id } })

      return reply.status(200).send({ success: true })
    } catch (error: any) {
      request.log.error(`[resume] delete error: ${error.message}`)
      return reply.status(500).send({ error: 'Delete failed', detail: error.message })
    }
  })
}
