/**
 * resume.routes.ts — 简历分析 API
 *
 * Phase 2-P1: AI 招聘筛选官
 * - 简历解析（文本 → 结构化信息）
 * - 简历质量评分
 * - 简历岗位匹配
 * - 企业人才库
 */

import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { createResumeStorage } from '../services/resume-storage'
import { ResumeParserAgent } from '../agents/job/resume-parser-agent'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

const prisma = new PrismaClient()
const resumeStorage = createResumeStorage()

// ─── 错误类型定义（Gate 10: 错误分类） ───
const ResumeErrorCode = {
  FILE_CORRUPTED: 'FILE_CORRUPTED',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  PARSE_FAILED: 'PARSE_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
} as const

export async function resumeRoutes(fastify: FastifyInstance) {

  // 503: Resume ↔ ResumeProfile 关系尚未完成同步
  fastify.addHook('onRequest', async (_request, reply) => {
    return reply.status(503).send({ error: 'Resume module is under maintenance', module: 'resume-center', status: 'maintenance' })
  })

  // ─── 简历上传（新增 — Slice A） ───
  // 使用 @fastify/multipart 处理 multipart/form-data

  fastify.post('/api/enterprise/resume/upload', async (request, reply) => {
    try {
      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let fileName = ''
      let fileType = ''
      let workspaceId = ''
      let fileSize = 0

      // 解析 multipart 数据
      for await (const part of parts) {
        if (part.type === 'file') {
          fileBuffer = await part.toBuffer()
          fileName = part.filename || 'resume.pdf'
          fileType = part.mimetype || 'application/pdf'
          fileSize = fileBuffer.length
        } else if (part.type === 'field') {
          if (part.fieldname === 'workspaceId') {
            workspaceId = part.value as string
          }
        }
      }

      // ─── 参数校验 ───
      if (!workspaceId) {
        return reply.status(400).send({
          error: 'workspaceId is required',
          code: 'MISSING_WORKSPACE_ID',
        })
      }

      if (!fileBuffer) {
        return reply.status(400).send({
          error: 'No file uploaded',
          code: 'NO_FILE',
        })
      }

      // ─── 文件大小校验（10MB） ───
      const MAX_FILE_SIZE = 10 * 1024 * 1024
      if (fileSize > MAX_FILE_SIZE) {
        return reply.status(400).send({
          error: 'File too large. Maximum size is 10MB.',
          code: ResumeErrorCode.FILE_TOO_LARGE,
        })
      }

      // ─── 文件类型校验（仅 PDF） ───
      const ALLOWED_TYPES = ['application/pdf']
      if (!ALLOWED_TYPES.includes(fileType)) {
        return reply.status(400).send({
          error: 'Unsupported file type. Only PDF is allowed.',
          code: ResumeErrorCode.UNSUPPORTED_FORMAT,
        })
      }

      // ─── 计算 SHA-256 fileHash ───
      const fileHash = createHash('sha256').update(fileBuffer).digest('hex')

      // ─── 重复文件检测（幂等性） ───
      const existingResume = await prisma.resume.findFirst({
        where: {
          workspaceId,
          fileHash,
        },
      })

      if (existingResume) {
        // 返回已有记录，不重复创建
        const result: any = {
          success: true,
          fileId: existingResume.id,
          fileName: existingResume.fileName,
          status: existingResume.status,
          duplicate: true,
          message: 'File already exists',
        }

        // ─── Slice C: 重复文件也检查 Pipeline 记录 ───
        try {
          const workspaceForCheck = await prisma.enterpriseJobWorkspace.findUnique({
            where: { id: workspaceId },
          })
          if (workspaceForCheck) {
            const existingPipelineForDup = await prisma.recruitmentPipeline.findFirst({
              where: {
                workspaceId,
                resumeId: existingResume.id,
              },
            })

            if (!existingPipelineForDup) {
              // 查找或创建默认 JobPosting
              let defaultJobForDup = await prisma.jobPosting.findFirst({
                where: { enterpriseId: workspaceForCheck.enterpriseId },
                orderBy: { createdAt: 'asc' },
              })
              if (!defaultJobForDup) {
                defaultJobForDup = await prisma.jobPosting.create({
                  data: {
                    enterpriseId: workspaceForCheck.enterpriseId,
                    title: 'AI 招聘筛选官',
                    description: '自动从简历创建的候选人',
                    location: '',
                    salary: '',
                    skillRequirements: [],
                    requirements: '',
                    status: 'active',
                  },
                })
              }

              const pipelineForDup = await prisma.recruitmentPipeline.create({
                data: {
                  workspaceId,
                  jobId: defaultJobForDup.id,
                  resumeId: existingResume.id,
                  candidateName: existingResume.candidateName || '未知',
                  stage: 'discovered',
                  autoCreated: true,
                },
              })

              await prisma.pipelineEvent.create({
                data: {
                  pipelineId: pipelineForDup.id,
                  type: 'stage_change',
                  fromStage: null,
                  toStage: 'discovered',
                  actor: 'system',
                  metadata: {
                    autoCreated: true,
                    source: 'resume_duplicate',
                    resumeId: existingResume.id,
                  },
                },
              })

              result.pipelineCreated = true
            }
          }
        } catch (dupPipelineError: any) {
          console.error('[Slice C] Duplicate pipeline creation failed:', dupPipelineError.message)
        }

        return result
      }

      // ─── 生成 fileId 和文件路径 ───
      const fileId = randomUUID()
      const relativePath = `${workspaceId}/${fileId}.pdf`

      // ─── 保存文件到存储（Storage Adapter 抽象层） ───
      let fullPath: string
      try {
        fullPath = await resumeStorage.save(fileBuffer, relativePath)
      } catch (storageError: any) {
        return reply.status(500).send({
          error: 'File storage failed',
          code: ResumeErrorCode.STORAGE_ERROR,
          detail: storageError.message,
        })
      }

      // ─── 创建 Resume 记录（含审计字段） ───
      const resume = await prisma.resume.create({
        data: {
          workspaceId,
          candidateName: fileName.replace(/\.pdf$/i, ''),
          fileName,
          fileUrl: fullPath,
          fileType,
          fileSize,
          fileHash,
          status: 'uploaded',
          parserType: 'regex',
          // 审计字段
          parseError: null,
          parseDurationMs: null,
          modelName: null,
        },
      })

      // ─── Slice B: 自动触发简历解析 ───
      // 同步提取文本 + 解析（Beta 阶段简化处理）
      try {
        const { extractTextFromPdfFile } = await import('../services/pdf-text-extractor')
        const { ResumeParserAgent } = await import('../agents/job/resume-parser-agent')

        const startTime = Date.now()
        const agent = new ResumeParserAgent()

        // 提取 PDF 文本
        const pdfResult = await extractTextFromPdfFile(fullPath)
        const parseDurationMs = Date.now() - startTime

        // 解析简历文本
        const parsed = agent.parseResume({
          text: pdfResult.text,
          fileName: resume.fileName,
        })

        // 质量评分
        const quality = agent.evaluateQuality(parsed)

        // 更新 Resume 状态
        await prisma.resume.update({
          where: { id: resume.id },
          data: {
            status: 'parsed',
            parseDurationMs,
          },
        })

        // 创建 ResumeProfile（解析结果）
        await prisma.resumeProfile.create({
          data: {
            resumeId: resume.id,
            name: parsed.name || resume.candidateName || '未知',
            email: parsed.email,
            phone: parsed.phone,
            education: parsed.education,
            major: parsed.major,
            skills: parsed.skills,
            experience: parsed.experience,
            experienceYears: parsed.experienceYears,
            city: parsed.city,
            salaryMin: parsed.salaryMin,
            salaryMax: parsed.salaryMax,
            careerGoal: parsed.careerGoal,
            projects: parsed.projects,
            qualityScore: quality.score,
            strengths: quality.strengths,
            weaknesses: quality.weaknesses,
            suggestions: quality.suggestions,
            rawText: pdfResult.text.slice(0, 2000),
          },
        })

        // ─── Slice C: 自动创建 Pipeline 记录 ───
        // 解析成功后，自动将候选人加入 Pipeline
        try {
          // 获取 workspace 以找到 enterpriseId
          const workspace = await prisma.enterpriseJobWorkspace.findUnique({
            where: { id: workspaceId },
          })
          if (!workspace) return // 安全检查

          // 查找或创建默认 JobPosting
          let defaultJob = await prisma.jobPosting.findFirst({
            where: { enterpriseId: workspace.enterpriseId },
            orderBy: { createdAt: 'asc' },
          })

          if (!defaultJob) {
            // 创建默认岗位
            defaultJob = await prisma.jobPosting.create({
              data: {
                enterpriseId: workspace.enterpriseId,
                title: 'AI 招聘筛选官',
                description: '自动从简历创建的候选人',
                location: '',
                salary: '',
                skillRequirements: [],
                requirements: '',
                status: 'active',
              },
            })
          }

          // 检查是否已有 Pipeline 记录（避免重复创建）
          const existingPipeline = await prisma.recruitmentPipeline.findFirst({
            where: {
              workspaceId,
              resumeId: resume.id,
            },
          })

          if (!existingPipeline) {
            const pipeline = await prisma.recruitmentPipeline.create({
              data: {
                workspaceId,
                jobId: defaultJob.id,
                resumeId: resume.id,
                candidateName: parsed.name || resume.candidateName || '未知',
                stage: 'discovered',
                autoCreated: true,
              },
            })

            // 创建 PipelineEvent 记录
            await prisma.pipelineEvent.create({
              data: {
                pipelineId: pipeline.id,
                type: 'stage_change',
                fromStage: null,
                toStage: 'discovered',
                actor: 'system',
                metadata: {
                  autoCreated: true,
                  source: 'resume_parse',
                  resumeId: resume.id,
                  qualityScore: quality.score,
                },
              },
            })
          }
        } catch (pipelineError: any) {
          // Pipeline 创建失败不影响上传成功
          console.error('[Slice C] Pipeline creation failed:', pipelineError.message)
        }

        // ─── 返回响应（含解析结果） ───
        return {
          success: true,
          fileId: resume.id,
          fileName: resume.fileName,
          status: 'parsed',
          duplicate: false,
          fileHash,
          createdAt: resume.createdAt,
          parsed: {
            name: parsed.name,
            email: parsed.email,
            phone: parsed.phone,
            education: parsed.education,
            major: parsed.major,
            skills: parsed.skills,
            experienceYears: parsed.experienceYears,
            city: parsed.city,
          },
          quality: {
            score: quality.score,
            strengths: quality.strengths.slice(0, 3),
            weaknesses: quality.weaknesses.slice(0, 3),
          },
          parseDurationMs,
          pageCount: pdfResult.pageCount,
        }
      } catch (parseError: any) {
        // 解析失败不影响上传成功，记录错误
        await prisma.resume.update({
          where: { id: resume.id },
          data: {
            status: 'parse_failed',
            parseError: parseError.message.slice(0, 500),
          },
        })

        return {
          success: true,
          fileId: resume.id,
          fileName: resume.fileName,
          status: 'uploaded',
          duplicate: false,
          fileHash,
          createdAt: resume.createdAt,
          parseError: parseError.message,
        }
      }
    } catch (e: any) {
      return reply.status(500).send({
        error: 'Upload failed',
        code: ResumeErrorCode.STORAGE_ERROR,
        detail: e.message,
      })
    }
  })

  // ─── Slice B: 手动触发简历解析 ───
  fastify.post('/api/enterprise/resume/parse/:fileId', async (request, reply) => {
    const { fileId } = request.params as { fileId: string }

    if (!fileId) {
      return reply.status(400).send({ error: 'fileId is required' })
    }

    try {
      // 查找 Resume 记录
      const resume = await prisma.resume.findUnique({
        where: { id: fileId },
      })

      if (!resume) {
        return reply.status(404).send({ error: 'Resume not found' })
      }

      if (resume.status === 'parsed') {
        return { success: true, message: 'Already parsed', status: 'parsed' }
      }

      // 检查文件是否存在
      const fileExists = await resumeStorage.exists(resume.fileUrl.replace(/.*\/([^/]+\.pdf)$/, ''))
      if (!fileExists) {
        return reply.status(404).send({ error: 'PDF file not found in storage' })
      }

      const { extractTextFromPdfFile } = await import('../services/pdf-text-extractor')
      const { ResumeParserAgent } = await import('../agents/job/resume-parser-agent')

      const startTime = Date.now()
      const agent = new ResumeParserAgent()

      // 提取 PDF 文本
      const pdfResult = await extractTextFromPdfFile(resume.fileUrl)
      const parseDurationMs = Date.now() - startTime

      // 解析简历文本
      const parsed = agent.parseResume({
        text: pdfResult.text,
        fileName: resume.fileName,
      })

      // 质量评分
      const quality = agent.evaluateQuality(parsed)

      // 更新 Resume 状态
      await prisma.resume.update({
        where: { id: fileId },
        data: {
          status: 'parsed',
          parseDurationMs,
        },
      })

      // 检查是否已有 ResumeProfile
      const existingProfile = await prisma.resumeProfile.findUnique({
        where: { resumeId: fileId },
      })

      if (existingProfile) {
        // 更新已有 Profile
        await prisma.resumeProfile.update({
          where: { resumeId: fileId },
          data: {
            name: parsed.name || resume.candidateName || '未知',
            email: parsed.email,
            phone: parsed.phone,
            education: parsed.education,
            major: parsed.major,
            skills: parsed.skills,
            experience: parsed.experience,
            experienceYears: parsed.experienceYears,
            city: parsed.city,
            salaryMin: parsed.salaryMin,
            salaryMax: parsed.salaryMax,
            careerGoal: parsed.careerGoal,
            projects: parsed.projects,
            qualityScore: quality.score,
            strengths: quality.strengths,
            weaknesses: quality.weaknesses,
            suggestions: quality.suggestions,
            rawText: pdfResult.text.slice(0, 2000),
          },
        })
      } else {
        // 创建新 Profile
        await prisma.resumeProfile.create({
          data: {
            resumeId: fileId,
            name: parsed.name || resume.candidateName || '未知',
            email: parsed.email,
            phone: parsed.phone,
            education: parsed.education,
            major: parsed.major,
            skills: parsed.skills,
            experience: parsed.experience,
            experienceYears: parsed.experienceYears,
            city: parsed.city,
            salaryMin: parsed.salaryMin,
            salaryMax: parsed.salaryMax,
            careerGoal: parsed.careerGoal,
            projects: parsed.projects,
            qualityScore: quality.score,
            strengths: quality.strengths,
            weaknesses: quality.weaknesses,
            suggestions: quality.suggestions,
            rawText: pdfResult.text.slice(0, 2000),
          },
        })
      }

      // ─── Slice C: 自动创建 Pipeline 记录 ───
      try {
        // 获取 workspace 以找到 enterpriseId
        const workspaceForPipeline = await prisma.enterpriseJobWorkspace.findUnique({
          where: { id: resume.workspaceId },
        })
        if (!workspaceForPipeline) return // 安全检查

        let defaultJob = await prisma.jobPosting.findFirst({
          where: { enterpriseId: workspaceForPipeline.enterpriseId },
          orderBy: { createdAt: 'asc' },
        })

        if (!defaultJob) {
          defaultJob = await prisma.jobPosting.create({
            data: {
              enterpriseId: workspaceForPipeline.enterpriseId,
              title: 'AI 招聘筛选官',
              description: '自动从简历创建的候选人',
              location: '',
              salary: '',
              skillRequirements: [],
              requirements: '',
              status: 'active',
            },
          })
        }

        const existingPipeline = await prisma.recruitmentPipeline.findFirst({
          where: {
            workspaceId: resume.workspaceId,
            resumeId: fileId,
          },
        })

        if (!existingPipeline) {
          const pipeline = await prisma.recruitmentPipeline.create({
            data: {
              workspaceId: resume.workspaceId,
              jobId: defaultJob.id,
              resumeId: fileId,
              candidateName: parsed.name || resume.candidateName || '未知',
              stage: 'discovered',
              autoCreated: true,
            },
          })

          await prisma.pipelineEvent.create({
            data: {
              pipelineId: pipeline.id,
              type: 'stage_change',
              fromStage: null,
              toStage: 'discovered',
              actor: 'system',
              metadata: {
                autoCreated: true,
                source: 'resume_parse',
                resumeId: fileId,
                qualityScore: quality.score,
              },
            },
          })
        }
      } catch (pipelineError: any) {
        console.error('[Slice C] Pipeline creation failed:', pipelineError.message)
      }

      return {
        success: true,
        fileId: resume.id,
        fileName: resume.fileName,
        status: 'parsed',
        parsed: {
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
          education: parsed.education,
          major: parsed.major,
          skills: parsed.skills,
          experienceYears: parsed.experienceYears,
          city: parsed.city,
        },
        quality: {
          score: quality.score,
          strengths: quality.strengths,
          weaknesses: quality.weaknesses,
          suggestions: quality.suggestions,
        },
        parseDurationMs,
        pageCount: pdfResult.pageCount,
      }
    } catch (e: any) {
      // 更新失败状态
      await prisma.resume.update({
        where: { id: fileId },
        data: {
          status: 'parse_failed',
          parseError: e.message.slice(0, 500),
        },
      }).catch(() => {}) // 忽略更新失败

      return reply.status(500).send({
        error: 'Parse failed',
        code: ResumeErrorCode.PARSE_FAILED,
        detail: e.message,
      })
    }
  })

  // ─── 简历状态查询（新增 — Slice A） ───

  fastify.get('/api/enterprise/resume/status/:fileId', async (request, reply) => {
    const { fileId } = request.params as { fileId: string }

    try {
      const resume = await prisma.resume.findUnique({
        where: { id: fileId },
        include: {
          profile: {
            select: {
              name: true,
              skills: true,
              experienceYears: true,
              qualityScore: true,
            },
          },
        },
      })

      if (!resume) {
        return reply.status(404).send({ error: 'Resume not found' })
      }

      return {
        fileId: resume.id,
        fileName: resume.fileName,
        status: resume.status,
        progress: resume.status === 'parsed' ? 100 : resume.status === 'parsing' ? 50 : 0,
        resumeId: resume.id,
        candidateName: resume.profile?.name || resume.candidateName,
        skills: resume.profile?.skills || [],
        qualityScore: resume.profile?.qualityScore || 0,
        parserType: resume.parserType,
        parseError: resume.parseError,
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
      }
    } catch (e: any) {
      return reply.status(500).send({ error: 'Failed to get status', detail: e.message })
    }
  })

  // ─── 简历解析 ───

  fastify.post('/api/enterprise/resume/parse', async (request, reply) => {
    const body = request.body as {
      workspaceId: string
      text: string
      fileName?: string
      candidateName?: string
    }

    if (!body.workspaceId || !body.text) {
      return reply.status(400).send({ error: 'workspaceId 和 text 都是必填' })
    }

    try {
      const agent = new ResumeParserAgent()

      // 解析简历
      const parsed = agent.parseResume({
        text: body.text,
        fileName: body.fileName,
      })

      // 质量评分
      const quality = agent.evaluateQuality(parsed)

      // 保存到数据库
      const resume = await prisma.resume.create({
        data: {
          workspaceId: body.workspaceId,
          candidateName: body.candidateName || parsed.name || '未知候选人',
          fileName: body.fileName || 'resume.txt',
          fileUrl: '',
          fileType: 'text',
          fileSize: body.text.length,
          status: 'analyzed',
        },
      })

      const profile = await prisma.resumeProfile.create({
        data: {
          resumeId: resume.id,
          name: parsed.name || body.candidateName || '未知',
          email: parsed.email,
          phone: parsed.phone,
          education: parsed.education,
          major: parsed.major,
          skills: parsed.skills,
          experience: parsed.experience,
          experienceYears: parsed.experienceYears,
          city: parsed.city,
          salaryMin: parsed.salaryMin,
          salaryMax: parsed.salaryMax,
          careerGoal: parsed.careerGoal,
          projects: parsed.projects,
          qualityScore: quality.score,
          strengths: quality.strengths,
          weaknesses: quality.weaknesses,
          suggestions: quality.suggestions,
          rawText: body.text.slice(0, 2000),
        },
      })

      return {
        success: true,
        resume: {
          id: resume.id,
          candidateName: profile.name,
          qualityScore: quality.score,
        },
        profile: {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          education: profile.education,
          skills: profile.skills,
          experienceYears: profile.experienceYears,
          city: profile.city,
          careerGoal: profile.careerGoal,
        },
        quality: {
          score: quality.score,
          strengths: quality.strengths,
          weaknesses: quality.weaknesses,
          suggestions: quality.suggestions,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '解析失败', detail: e.message })
    }
  })

  // ─── 简历与岗位匹配 ───

  fastify.post('/api/enterprise/resume/match', async (request, reply) => {
    const body = request.body as {
      resumeId: string
      jobId: string
    }

    if (!body.resumeId || !body.jobId) {
      return reply.status(400).send({ error: 'resumeId 和 jobId 都是必填' })
    }

    try {
      // 获取简历
      const profile = await prisma.resumeProfile.findFirst({
        where: { resumeId: body.resumeId },
      })

      if (!profile) {
        return reply.status(404).send({ error: '简历不存在' })
      }

      // 获取岗位
      const job = await prisma.jobPosting.findUnique({
        where: { id: body.jobId },
      })

      if (!job) {
        return reply.status(404).send({ error: '岗位不存在' })
      }

      // 执行匹配
      const agent = new ResumeParserAgent()
      const result = agent.matchWithJob({
        resume: {
          name: profile.name,
          email: profile.email || '',
          phone: profile.phone || '',
          education: profile.education || '',
          major: profile.major || '',
          skills: profile.skills,
          experience: profile.experience || '',
          experienceYears: profile.experienceYears,
          city: profile.city || '',
          salaryMin: profile.salaryMin || 0,
          salaryMax: profile.salaryMax || 0,
          careerGoal: profile.careerGoal || '',
          projects: profile.projects || '',
        },
        jobSkills: job.skillRequirements || [],
        jobSalary: job.salary || '',
        jobLocation: job.location || '',
        jobRequirements: job.requirements?.split(/[,，、\n]/) || [],
      })

      return {
        success: true,
        match: {
          resumeId: body.resumeId,
          resumeName: profile.name,
          jobTitle: job.title,
          jobSalary: job.salary,
          matchScore: result.matchScore,
          matchBreakdown: result.matchBreakdown,
          reasons: result.reasons,
          risks: result.risks,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '匹配失败', detail: e.message })
    }
  })

  // ─── 获取简历列表 ───

  fastify.get('/api/enterprise/resumes', async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId?: string }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required' })
    }

    try {
      const resumes = await prisma.resume.findMany({
        where: { workspaceId },
        include: {
          profile: {
            select: {
              name: true,
              qualityScore: true,
              skills: true,
              education: true,
              experienceYears: true,
              city: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      return {
        resumes: resumes.map(r => ({
          id: r.id,
          candidateName: r.candidateName,
          fileName: r.fileName,
          status: r.status,
          qualityScore: r.profile?.qualityScore || 0,
          skills: r.profile?.skills || [],
          education: r.profile?.education || '',
          experienceYears: r.profile?.experienceYears || 0,
          city: r.profile?.city || '',
          createdAt: r.createdAt,
        })),
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取简历列表失败', detail: e.message })
    }
  })

  // ─── 获取简历详情 ───

  fastify.get('/api/enterprise/resume/:resumeId', async (request, reply) => {
    const { resumeId } = request.params as { resumeId: string }

    try {
      const resume = await prisma.resume.findUnique({
        where: { id: resumeId },
        include: { profile: true },
      })

      if (!resume) {
        return reply.status(404).send({ error: '简历不存在' })
      }

      return {
        resume: {
          id: resume.id,
          candidateName: resume.candidateName,
          fileName: resume.fileName,
          status: resume.status,
          createdAt: resume.createdAt,
          profile: resume.profile,
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取简历详情失败', detail: e.message })
    }
  })

  // ─── 删除简历（Sprint-01）───
  fastify.delete('/api/enterprise/resume/:resumeId', async (request, reply) => {
    const { resumeId } = request.params as { resumeId: string }

    try {
      const resume = await prisma.resume.findUnique({
        where: { id: resumeId },
        include: { profile: true },
      })

      if (!resume) {
        return reply.status(404).send({ error: '简历不存在' })
      }

      // 查找关联的 Pipeline 记录
      const relatedPipelines = await prisma.recruitmentPipeline.findMany({
        where: { resumeId },
        select: { id: true },
      })

      // 删除关联的 PipelineEvent 和 Pipeline
      if (relatedPipelines.length > 0) {
        const pipelineIds = relatedPipelines.map(p => p.id)
        await prisma.pipelineEvent.deleteMany({
          where: { pipelineId: { in: pipelineIds } },
        })
        await prisma.recruitmentPipeline.deleteMany({
          where: { resumeId },
        })
      }

      // 删除 ResumeProfile
      if (resume.profile) {
        await prisma.resumeProfile.delete({
          where: { resumeId },
        })
      }

      // 删除文件
      try {
        await resumeStorage.delete(resume.fileUrl)
      } catch (fileError: any) {
        console.warn('[Sprint-01] File delete failed:', fileError.message)
      }

      // 删除 Resume 记录
      await prisma.resume.delete({
        where: { id: resumeId },
      })

      return {
        success: true,
        message: '简历已删除',
        deletedPipelines: relatedPipelines.length,
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '删除失败', detail: e.message })
    }
  })

  // ─── 获取招聘流程列表 ───

  fastify.get('/api/enterprise/pipeline', async (request, reply) => {
    const { workspaceId, jobId, stage } = request.query as {
      workspaceId?: string
      jobId?: string
      stage?: string
    }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required' })
    }

    try {
      const pipelines = await prisma.recruitmentPipeline.findMany({
        where: {
          workspaceId,
          ...(jobId ? { jobId } : {}),
          ...(stage ? { stage } : {}),
        },
        include: {
          job: { select: { title: true, salary: true } },
        },
        orderBy: { lastActivityAt: 'desc' },
        take: 50,
      })

      return {
        pipelines: pipelines.map(p => ({
          id: p.id,
          jobId: p.jobId,
          jobTitle: p.job?.title || '',
          jobSalary: p.job?.salary || '',
          candidateName: p.candidateName,
          stage: p.stage,
          screeningScore: p.screeningScore,
          interviewCount: p.interviewCount,
          lastActivityAt: p.lastActivityAt,
        })),
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取流程列表失败', detail: e.message })
    }
  })

  // ─── 更新招聘流程 ───

  fastify.post('/api/enterprise/pipeline/update', async (request, reply) => {
    const body = request.body as {
      pipelineId: string
      stage?: string
      screeningScore?: number
      screeningNote?: string
    }

    if (!body.pipelineId) {
      return reply.status(400).send({ error: 'pipelineId 是必填' })
    }

    try {
      const data: any = { updatedAt: new Date(), lastActivityAt: new Date() }
      if (body.stage) data.stage = body.stage
      if (body.screeningScore !== undefined) data.screeningScore = body.screeningScore
      if (body.screeningNote) data.screeningNote = body.screeningNote

      await prisma.recruitmentPipeline.update({
        where: { id: body.pipelineId },
        data,
      })

      return { success: true, message: '更新成功' }
    } catch (e: any) {
      return reply.status(500).send({ error: '更新失败', detail: e.message })
    }
  })

  // ─── 创建招聘流程 ───

  fastify.post('/api/enterprise/pipeline/create', async (request, reply) => {
    const body = request.body as {
      workspaceId: string
      jobId: string
      candidateName: string
      resumeId?: string
      stage?: string
    }

    if (!body.workspaceId || !body.jobId || !body.candidateName) {
      return reply.status(400).send({ error: 'workspaceId, jobId, candidateName 都是必填' })
    }

    try {
      const pipeline = await prisma.recruitmentPipeline.create({
        data: {
          workspaceId: body.workspaceId,
          jobId: body.jobId,
          candidateName: body.candidateName,
          resumeId: body.resumeId,
          stage: body.stage || 'discovered',
        },
      })

      return { success: true, pipeline: { id: pipeline.id, stage: pipeline.stage } }
    } catch (e: any) {
      return reply.status(500).send({ error: '创建失败', detail: e.message })
    }
  })

  // ─── 获取企业人才池统计 ───

  fastify.get('/api/enterprise/talent-pool/stats', async (request, reply) => {
    const { workspaceId } = request.query as { workspaceId?: string }

    if (!workspaceId) {
      return reply.status(400).send({ error: 'workspaceId is required' })
    }

    try {
      const totalResumes = await prisma.resume.count({ where: { workspaceId } })
      const totalCandidates = await prisma.recruitmentPipeline.count({ where: { workspaceId } })

      const stageStats = await prisma.recruitmentPipeline.groupBy({
        by: ['stage'],
        where: { workspaceId },
        _count: { stage: true },
      })

      const avgQuality = await prisma.resumeProfile.aggregate({
        _avg: { qualityScore: true },
      })

      return {
        stats: {
          totalResumes,
          totalCandidates,
          avgQualityScore: Math.round(avgQuality._avg.qualityScore || 0),
          stageDistribution: stageStats.map(s => ({
            stage: s.stage,
            count: s._count.stage,
          })),
        },
      }
    } catch (e: any) {
      return reply.status(500).send({ error: '获取统计失败', detail: e.message })
    }
  })
}
