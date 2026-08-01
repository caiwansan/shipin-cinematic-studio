import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { cosService } from '../services/cos-service.js'
import { verifyProjectOwner } from '../services/director/project-ownership.service.js'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
/**
 * Workbench Project API — v2 工作台项目记录
 * 
 * POST /api/v2/workbench/project          — 创建项目（含剧本）
 * GET  /api/v2/workbench/projects          — 项目列表
 * GET  /api/v2/workbench/project/:id       — 全量加载（+ 所有关联数据）
 * PUT  /api/v2/workbench/project/:id       — 更新项目（剧本/名称等）
 * POST /api/v2/workbench/project/:id/save-image  — 下载图片到 COS 并回写
 * POST /api/v2/workbench/project/:id/save-video  — 下载视频到 COS 并回写
 * DELETE /api/v2/workbench/project/:id     — 删除项目（保留已生成的图片/视频）
 */

export default async function (app: FastifyInstance) {

  // ─── 创建项目 ───
  app.post('/api/v2/workbench/project', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const user = (request as any).user
      const userId = user?.id || 'default'
      const body = request.body as any
      
      if (!body.projectName?.trim()) {
        return reply.status(400).send({ success: false, error: '项目名称不能为空' })
      }

      const project = await prisma.project.create({
        data: {
          name: body.projectName.trim(),
          description: body.projectDesc || '',
          userId,
          status: 'draft',
          script: body.script || '',
          executionResults: {
            rawScript: body.script || '',
            projectName: body.projectName.trim(),
            projectDesc: body.projectDesc || '',
            title: body.projectName.trim(),
          },
        },
      })

      // ⭐ 初始化 pipeline stages（确保新项目创建就注册所有 stage）
      // ⚠️ SSOT: key 必须与 shared/pipeline-definition.ts 一致（宪法规定）
      const stageKeys = ['script-analysis', 'character-design', 'scene-design', 'storyboard', 'video-generation', 'music-generation', 'final-render', 'voice-generation']
      const now = new Date()
      await prisma.pipelineStage.createMany({
        data: stageKeys.map(stageKey => ({
          projectId: project.id,
          stageKey,
          status: 'pending',
          inputData: {},
          outputData: {},
          runtimeVersion: '0.4',
          createdAt: now,
          updatedAt: now,
        })),
        skipDuplicates: true,
      })

      reply.send({ success: true, data: project })
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
            console.error('[workbench-project] GET /:id 错误:', err.message, err.stack?.slice(0, 500))
    }
  })

  // ─── 项目列表 ───
  app.get('/api/v2/workbench/projects', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const user = (request as any).user
      const userId = user?.id || 'default'

      const projects = await prisma.project.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          script: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          executionResults: true,
        },
      })

      reply.send({ success: true, data: projects })
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 全量加载项目 ───
  app.get('/api/v2/workbench/project/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const rawId = (request.params as any).id
      const id = rawId.split(':')[0]  // Strip Nuxt array index artifact (:1)

      // ⭐ Phase 6 安全隔离: 归属校验
      const ownerCheck = await verifyProjectOwner(id, (request as any).user?.id)
      if (!ownerCheck.ok) {
        return reply.status(ownerCheck.status).send({ success: false, error: ownerCheck.error })
      }

      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          aiCharacterSpecs: { orderBy: { sortOrder: 'asc' } },
          aiSceneSpecs: { orderBy: { sortOrder: 'asc' } },
          aiVideoSegments: { orderBy: { sortOrder: 'asc' } },
          aiFrameDesigns: { orderBy: { sortOrder: 'asc' } },
          aiPropSpecs: { orderBy: { sortOrder: 'asc' } },
          aiEffectSpecs: { orderBy: { sortOrder: 'asc' } },
          aiVoiceConfigs: { orderBy: { characterName: 'asc' } },
          characterImages: { orderBy: { sortOrder: 'asc' } },
          sceneImages: { orderBy: { sortOrder: 'asc' } },
          storyboardImages: { orderBy: { sortOrder: 'asc' } },
          propImages: { orderBy: { sortOrder: 'asc' } },
          // ⭐ SSOT（SHORTDRAMA-DATA-SSOT）: 阶段状态唯一事实源 = pipeline_stages 表
          pipelineStages: true,
        },
      })

      if (!project) {
        return reply.status(404).send({ success: false, error: '项目未找到' })
      }

      // ⭐ legacy key 兼容：旧项目可能用 character/scene/voice 初始化，映射到宪法 key
      const LEGACY_STAGE_MAP: Record<string, string> = {
        character: 'character-design',
        scene: 'scene-design',
        voice: 'voice-generation',
      }
      const normalizedStages = (project.pipelineStages || []).map((st: any) => {
        const mapped = LEGACY_STAGE_MAP[st.stageKey]
        return mapped ? { ...st, stageKey: mapped } : st
      })
      ;(project as any).pipelineStages = normalizedStages

      // ⭐ visualDesc 兼容（SHORTDRAMA-DISPLAY-FIX）: 旧项目 executionResults.segments 存的是 visualDesc（V2 派生字段）
      //    新前端统一读 visualDescription，返回前归一化，避免分镜卡片画面描述空白
      try {
        const er = (project as any).executionResults
        if (er && typeof er === 'object' && Array.isArray(er.segments)) {
          ;(project as any).executionResults = {
            ...er,
            segments: er.segments.map((s: any) => ({
              ...s,
              visualDescription: s.visualDescription || s.visualDesc || s.fullText || s.narrativePurpose || '',
            })),
          }
        }
      } catch { /* 归一化失败不影响主链路 */ }

      reply.send({ success: true, data: project })
    } catch (err: any) {
      console.error("[workbench-project] GET /:id 错误:", err.message, err.stack?.slice(0, 500));
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 更新项目 ───
  app.put('/api/v2/workbench/project/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const body = request.body as any

      // ⭐ Phase 6 安全隔离: 归属校验
      const ownerCheck = await verifyProjectOwner(id, (request as any).user?.id)
      if (!ownerCheck.ok) {
        return reply.status(ownerCheck.status).send({ success: false, error: ownerCheck.error })
      }

      const updateData: any = {}

      if (body.projectName !== undefined) updateData.name = body.projectName
      if (body.projectDesc !== undefined) updateData.description = body.projectDesc
      if (body.script !== undefined) updateData.script = body.script
      if (body.status !== undefined) updateData.status = body.status

      // ⭐ 合并 executionResults（前端 saveToServer 传来的分镜段/风格/流水线状态）
      if (body.executionResults && typeof body.executionResults === 'object') {
        const existing = await prisma.project.findUnique({ where: { id }, select: { executionResults: true } })
        const merged = {
          ...((existing?.executionResults as any) || {}),
          ...body.executionResults,
        }
        updateData.executionResults = merged
      }

      const project = await prisma.project.update({
        where: { id },
        data: updateData,
      })

      reply.send({ success: true, data: project })
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 保存已生成的图片到 COS ───
  // body: { sourceUrl: string, characterName?: string, sceneName?: string, segmentId?: string }
  app.post('/api/v2/workbench/project/:id/save-image', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const body = request.body as any
      const user = (request as any).user

      // ⭐ Phase 6 安全隔离: 归属校验
      const ownerCheck = await verifyProjectOwner(id, user?.id)
      if (!ownerCheck.ok) {
        return reply.status(ownerCheck.status).send({ success: false, error: ownerCheck.error })
      }

      console.log(`[save-image] project=${id} propName=${body.propName} sourceUrl=${body.sourceUrl?.slice(0,60)}`)

      if (!body.sourceUrl) {
        return reply.status(400).send({ success: false, error: 'sourceUrl 不能为空' })
      }

      // 下载到 COS（失败时降级使用 sourceUrl）
      let cosUrl = body.sourceUrl
      try {
        const result = await cosService.uploadFile(body.sourceUrl, 'image', user?.id || 'default')
        cosUrl = result.cosUrl
        console.log(`[save-image] COS OK: ${cosUrl.slice(0, 60)}`)
      } catch (cosErr: any) {
        console.warn(`[save-image] COS 上传失败，使用原 URL:`, cosErr.message)
      }

      // 根据类型写入对应的关联表
      if (body.characterName) {
        // 角色图片
        const existing = await prisma.characterImage.findUnique({
          where: {
            projectId_characterName_variant: {
              projectId: id,
              characterName: body.characterName,
              variant: body.variant || '',
            },
          },
        })
        if (existing) {
          await prisma.characterImage.update({
            where: { id: existing.id },
            data: { imageUrl: cosUrl },
          })
        } else {
          await prisma.characterImage.create({
            data: {
              projectId: id,
              characterName: body.characterName,
              variant: body.variant || '',
              imageUrl: cosUrl,
            },
          })
        }
      } else if (body.sceneName) {
        // 场景图片
        const existing = await prisma.sceneImage.findUnique({
          where: {
            projectId_sceneName: {
              projectId: id,
              sceneName: body.sceneName,
            },
          },
        })
        if (existing) {
          await prisma.sceneImage.update({
            where: { id: existing.id },
            data: { imageUrl: cosUrl },
          })
        } else {
          await prisma.sceneImage.create({
            data: {
              projectId: id,
              sceneName: body.sceneName,
              imageUrl: cosUrl,
            },
          })
        }
      } else if (body.segmentId) {
        // 分镜图
        const existing = await prisma.storyboardImage.findUnique({
          where: {
            projectId_segmentId: {
              projectId: id,
              segmentId: body.segmentId,
            },
          },
        })
        if (existing) {
          await prisma.storyboardImage.update({
            where: { id: existing.id },
            data: { imageUrl: cosUrl },
          })
        } else {
          await prisma.storyboardImage.create({
            data: {
              projectId: id,
              segmentId: body.segmentId,
              imageUrl: cosUrl,
            },
          })
        }
      } else if (body.propName) {
        // 道具图 —— 不再按 propName 去重覆盖，每条都是新记录
        await prisma.propImage.create({
          data: {
            projectId: id,
            propName: body.propName,
            category: body.category || '通用',
            description: body.description || '',
            imageUrl: cosUrl,
            imagePrompt: typeof body.imagePrompt === 'object' ? JSON.stringify(body.imagePrompt) : (body.imagePrompt || ''),
          },
        })
      }

      reply.send({ success: true, data: { cosUrl } })
    } catch (err: any) {
      console.error('[save-image] 失败:', err.message, err.stack?.slice(0, 300))
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 保存已生成的视频到 COS ───
  // body: { sourceUrl: string, segmentId: string }
  app.post('/api/v2/workbench/project/:id/save-video', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as any
      const body = request.body as any
      const user = (request as any).user

      // ⭐ Phase 6 安全隔离: 归属校验
      const ownerCheck = await verifyProjectOwner(id, user?.id)
      if (!ownerCheck.ok) {
        return reply.status(ownerCheck.status).send({ success: false, error: ownerCheck.error })
      }

      if (!body.sourceUrl || !body.segmentId) {
        return reply.status(400).send({ success: false, error: 'sourceUrl 和 segmentId 不能为空' })
      }

      const cosUrl = await cosService.uploadFile(body.sourceUrl, 'video', user?.id || 'default')

      // 写入 ai_video_segments
      await prisma.aiVideoSegment.updateMany({
        where: {
          projectId: id,
          segmentId: body.segmentId,
        },
        data: { videoUrl: cosUrl },
      })

      reply.send({ success: true, data: { cosUrl } })
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 删除项目（保留已生成的图片/视频，只清空剧本关联数据） ───
  app.delete('/api/v2/workbench/project/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const rawId = (request.params as any).id
      const id = rawId.split(':')[0]  // Strip Nuxt array index artifact

      // ⭐ Phase 6 安全隔离: 归属校验（防越权删除他人项目）
      const ownerCheck = await verifyProjectOwner(id, (request as any).user?.id)
      if (!ownerCheck.ok) {
        return reply.status(ownerCheck.status).send({ success: false, error: ownerCheck.error })
      }

      // 注意：characterImage/sceneImage 有 onDelete: Cascade，删除 project 时会自动级联删除
      // 但 COS 上的文件原封不动，只是数据库记录被清理
      await prisma.$transaction([
        prisma.aiCharacterSpec.deleteMany({ where: { projectId: id } }),
        prisma.aiSceneSpec.deleteMany({ where: { projectId: id } }),
        prisma.aiVoiceConfig.deleteMany({ where: { projectId: id } }),
        prisma.aiVideoSegment.deleteMany({ where: { projectId: id } }),
        prisma.aiFrameDesign.deleteMany({ where: { projectId: id } }),
        prisma.aiVideoProduction.deleteMany({ where: { projectId: id } }),
        prisma.aiEffectSpec.deleteMany({ where: { projectId: id } }),
        prisma.aiActionSpec.deleteMany({ where: { projectId: id } }),
        prisma.aiCameraSpec.deleteMany({ where: { projectId: id } }),
        prisma.aiEmotionSpec.deleteMany({ where: { projectId: id } }),
        // projectId 非空字段，直接删（COS 文件保留）
        prisma.characterImage.deleteMany({ where: { projectId: id } }),
        prisma.sceneImage.deleteMany({ where: { projectId: id } }),
      ])

      // 真的删除 project 记录
      await prisma.project.delete({
        where: { id },
      })

      reply.send({ success: true, message: '项目记录已删除，已生成的图片/视频已保留' })
    } catch (err: any) {
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 上传参考图（角色/场景参考图）到 COS ───
  // multipart/form-data: file (binary) + type ('character'|'scene') + name (角色名/场景名)
  app.post('/api/v2/workbench/upload-reference', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const user = (request as any).user
      console.log('[Upload] receiving file... content-type:', request.headers['content-type'])
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ success: false, error: '未找到上传文件' })
      }

      console.log('[Upload] got file:', data.filename, 'type:', data.mimetype)
      const buffer = await data.toBuffer()
      const fields: Record<string, string> = {}
      for (const [key, val] of Object.entries(data.fields || {})) {
        fields[key] = (val as any).value || ''
      }
      console.log('[Upload] fields:', fields)

      // 上传到 COS，失败时 fallback 到本地
      const originFilename = data.filename || 'reference.png'
      let cosUrl = ''
      try {
        const result = await cosService.uploadBuffer(buffer, originFilename, user?.id || 'default')
        cosUrl = result.cosUrl
      } catch (cosErr: any) {
        console.warn('[Upload] COS上传失败，回退到本地:', cosErr.message)
        // 存本地
        const localDir = '/root/shipin-cinematic-studio/backend/public/uploads'
        if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true })
        const localName = `${randomUUID()}.${originFilename.split('.').pop() || 'png'}`
        const localPath = path.join(localDir, localName)
        fs.writeFileSync(localPath, buffer)
        cosUrl = `/api/v2/workbench/local-file/${localName}`
        console.log('[Upload] 本地保存:', localPath)
      }
      console.log('[Upload] 最终URL:', cosUrl)

      reply.send({
        success: true,
        data: {
          url: cosUrl,
          type: fields.type || 'character',
          name: fields.name || '',
        },
      })
    } catch (err: any) {
      console.error('[Upload] error:', err)
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 清除 AI 分析缓存（点击"开始AI拆解"时调用） ───
  // 清除所有 agent 生成的 AI 数据，保留项目名称/剧本/图片
  app.post('/api/v2/workbench/project/:id/clear-analysis', { preHandler: [app.authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as any

      // ⭐ Phase 6 安全隔离: 归属校验
      const ownerCheck = await verifyProjectOwner(id, (request as any).user?.id)
      if (!ownerCheck.ok) {
        return reply.status(ownerCheck.status).send({ success: false, error: ownerCheck.error })
      }

      console.log(`[clear-analysis] 🧹 清除项目 ${id} 所有 AI 分析缓存`)

      // ⭐ Phase A: clear-analysis 不再依赖 executionResults
      // 清除所有 Agent 生成的 AI 数据表 + PipelineStage，保留图片资产
      // 保留剧本原文（script 字段）

      await prisma.$transaction([
        prisma.aiCharacterSpec.deleteMany({ where: { projectId: id } }),
        prisma.aiSceneSpec.deleteMany({ where: { projectId: id } }),
        prisma.aiVoiceConfig.deleteMany({ where: { projectId: id } }),
        prisma.aiVideoSegment.deleteMany({ where: { projectId: id } }),
        prisma.aiFrameDesign.deleteMany({ where: { projectId: id } }),
        prisma.aiVideoProduction.deleteMany({ where: { projectId: id } }),
        prisma.aiEffectSpec.deleteMany({ where: { projectId: id } }),
        prisma.aiActionSpec.deleteMany({ where: { projectId: id } }),
        prisma.aiCameraSpec.deleteMany({ where: { projectId: id } }),
        prisma.aiEmotionSpec.deleteMany({ where: { projectId: id } }),
        // 🛡️ 不清除用户已生成的图片资产
        // 🧹 重置 PipelineStage（回到 pending，清空 outputData）
        prisma.pipelineStage.updateMany({
          where: { projectId: id },
          data: {
            status: 'pending',
            outputData: {},
          },
        }),
      ])

      // 也清故事板/storyboard 缓存
            // 🛡️ 也不清除分镜图
      console.log(`[clear-analysis] ✅ 清除完成`)
      reply.send({ success: true, message: 'AI 分析缓存已清除' })
    } catch (err: any) {
      console.error('[clear-analysis] 失败:', err.message)
      reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 本地文件代理 ───
  // @deprecated — Reality Recovery Phase6 安全加固
  //   前端 studio-v2 生产链 0 直连引用（production reference = 0）
  //   仅作为 upload-reference 的 COS 上传失败 fallback 读取路径
  //   加固：authenticate + basename 校验 + UUID 白名单 + 固定目录 + 防穿越
  app.get('/api/v2/workbench/local-file/:filename', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { filename } = request.params as any

    // 1. basename 校验：拒绝任何路径分隔符（防 ../ 穿越）
    const safeName = path.basename(String(filename || ''))
    if (safeName !== filename) {
      return reply.status(400).send({ error: '非法文件名' })
    }

    // 2. 固定格式白名单：仅允许服务端 randomUUID 生成的文件名（upload-reference fallback）
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|gif|webp)$/i.test(safeName)) {
      return reply.status(400).send({ error: '非法文件名' })
    }

    // 3. 固定目录 + 双重防穿越（解析后必须仍在 uploadsDir 内）
    const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads')
    const filePath = path.join(uploadsDir, safeName)
    if (!filePath.startsWith(uploadsDir + path.sep)) {
      return reply.status(400).send({ error: '非法路径' })
    }

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: '文件不存在' })
    }
    const ext = safeName.split('.').pop()?.toLowerCase() || 'png'
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
    reply.type(mimeMap[ext] || 'application/octet-stream')
    return reply.send(fs.createReadStream(filePath))
  })
}
