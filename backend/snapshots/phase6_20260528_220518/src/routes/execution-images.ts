import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function executionImageRoutes(fastify: FastifyInstance) {

  // ─── 角色图片生成入口（前端新版角色设计页调用） ───
  fastify.post('/execution-images/characters', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as any
    const { characterId, character, storyText } = body || {}
    if (!character || !character.name) {
      return reply.status(400).send({ error: 'character object with name required' })
    }

    const { randomUUID } = require('crypto')
    const imagePrompt = character.imagePrompt || ''
    const negativePrompt = character.negativePrompt || ''
    const authHeader = (request.headers as any).authorization || ''
    const pid = body.projectId
    if (!pid) return reply.status(400).send({ error: 'projectId required' })

    try {
      // 调用 SEEL 入口异步任务（入队 + 路由）
      const genRes = await fetch(`http://localhost:${process.env.PORT || 4002}/api/tasks/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: authHeader },
        body: JSON.stringify({
          projectId: pid,
          taskType: 'image',
          input: {
            prompt: imagePrompt,
            negativePrompt,
            source: 'character_execution',
            characterName: character.name,
            name: character.name,
          },
        }),
      })

      if (!genRes.ok) {
        const errText = await genRes.text().catch(() => '')
        throw new Error(`图片生成任务提交失败: ${genRes.status} ${errText}`)
      }

      const genData = await genRes.json()
      const taskId = genData?.task?.id
      if (!taskId) {
        throw new Error('未获取到任务 ID')
      }

      // 轮询等待任务完成（最多 60 秒，每 2 秒检查一次）
      let imageUrl = ''
      const baseUrl = `http://localhost:${process.env.PORT || 4002}`
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const statusRes = await fetch(`${baseUrl}/api/tasks/${taskId}/status`, {
          headers: { authorization: authHeader },
        })
        if (!statusRes.ok) continue
        const statusData = await statusRes.json()
        const task = statusData?.task
        if (!task) continue

        if (task.status === 'completed') {
          // 从 result 提取图片 URL
          const result = task.result || {}
          imageUrl = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || ''
          if (imageUrl) break
          // 如果 result 没有 URL，尝试从 error 字段提取
          try {
            const err = JSON.parse(task.error || '{}')
            imageUrl = err?.output?.imageUrl || err?.output?.url || ''
          } catch {}
          break
        }
        if (task.status === 'failed') {
          console.warn('[Execution-Images] 任务失败:', task.error)
          break
        }
      }

      if (!imageUrl) {
        throw new Error('图片生成超时或失败，请检查模型配置和 API Key')
      }

      // ⭐ 下载到本地 + 上传到 COS
      const { cosService } = await import('../services/cos-service.js')
      let cosUrl = imageUrl
      try {
        const userId = (request.user as any)?.id || 'anonymous'
        const result = await cosService.uploadFile(imageUrl, 'image', userId)
        cosUrl = result.cosUrl
        console.log(`[Execution-Images] COS uploaded: ${cosUrl}`)
      } catch (e: any) {
        console.warn('[Execution-Images] COS 上传失败，使用原 URL:', e.message)
        // 不阻塞，继续用原 URL
      }
      imageUrl = cosUrl

      // 存储到角色图片表
      const existing = await prisma.project.findUnique({ where: { id: pid } })
      if (!existing) {
        await prisma.project.create({
          data: { id: pid, name: character.name, userId: (request.user as any).id },
        }).catch(() => {})
      }

      const saved = await prisma.characterImage.upsert({
        where: {
          projectId_characterName_variant: {
            projectId: pid,
            characterName: character.name,
            variant: 'makeup',
          },
        },
        update: { imageUrl, sortOrder: 0 },
        create: { projectId: pid, imageUrl, characterName: character.name, variant: 'makeup', sortOrder: 0 },
      }).catch(() => { console.warn('[Execution-Images] 存储失败'); return null })

      return reply.send({ success: true, imageUrl, url: imageUrl, id: saved?.id || '' })
    } catch (err: any) {
      console.warn('[Execution-Images] POST 角色图失败:', err.message)
      return reply.status(500).send({ error: err.message || '角色图片生成失败' })
    }
  })

  // ─── 角色图片 ───
  fastify.put('/execution-images/characters', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, images } = request.body as any
    if (!projectId || !images) return reply.status(400).send({ error: 'projectId and images required' })

    // 确保 project 存在（前端可能自动生成了 UUID 但还没写入 DB）
    const existing = await prisma.project.findUnique({ where: { id: projectId } })
    if (!existing) {
      await prisma.project.create({
        data: { id: projectId, name: '临时项目', userId: (request.user as any).id },
      })
    }

    // 逐张 upsert，不整体删除（修复：刷新后只剩最后一张图的问题）
    await prisma.$transaction(
      (images || []).map((img: any, i: number) => {
        const charName = img.characterName || (img.characterName === undefined && img.variant ? '' : `char_${i}`)
        return prisma.characterImage.upsert({
          where: {
            projectId_characterName_variant: {
              projectId,
              characterName: charName,
              variant: img.variant || '',
            },
          },
          update: { imageUrl: img.url, sortOrder: i },
          create: { projectId, imageUrl: img.url, characterName: charName, variant: img.variant || '', sortOrder: i },
        })
      }),
    )
    return { success: true } satisfies ApiResponse<unknown>;

  })

  fastify.get('/execution-images/characters/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    // 非 UUID 格式的 projectId 返回空（如前端临时 ID）
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      return { success: true, data: [] } satisfies ApiResponse<unknown>;

    }
    const images = await prisma.characterImage.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' }
    })
    return { success: true, data: images } satisfies ApiResponse<unknown>;

  })

  // ─── 场景图片生成入口 ───
  fastify.post('/execution-images/scenes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as any
    const { sceneId, scene, projectId: pid } = body || {}
    if (!scene || !scene.name) {
      return reply.status(400).send({ error: 'scene object with name required' })
    }

    const imagePrompt = scene.imagePrompt || scene.description || ''
    const negativePrompt = scene.negativePrompt || ''
    const authHeader = (request.headers as any).authorization || ''
    const projId = pid
    if (!projId) return reply.status(400).send({ error: 'projectId required' })

    try {
      const genRes = await fetch(`http://localhost:${process.env.PORT || 4002}/api/tasks/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: authHeader },
        body: JSON.stringify({
          projectId: projId,
          taskType: 'image',
          input: {
            prompt: imagePrompt,
            negativePrompt,
            source: 'scene_execution',
            sceneName: scene.name,
            name: scene.name,
          },
        }),
      })

      if (!genRes.ok) {
        const errText = await genRes.text().catch(() => '')
        throw new Error(`图片生成任务提交失败: ${genRes.status} ${errText}`)
      }

      const genData = await genRes.json()
      const taskId = genData?.task?.id
      if (!taskId) throw new Error('未获取到任务 ID')

      // 轮询等待任务完成
      let imageUrl = ''
      const baseUrl = `http://localhost:${process.env.PORT || 4002}`
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const statusRes = await fetch(`${baseUrl}/api/tasks/${taskId}/status`, {
          headers: { authorization: authHeader },
        })
        if (!statusRes.ok) continue
        const statusData = await statusRes.json()
        const task = statusData?.task
        if (!task) continue
        if (task.status === 'completed') {
          const result = task.result || {}
          imageUrl = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || ''
          try {
            const err = JSON.parse(task.error || '{}')
            imageUrl = imageUrl || err?.output?.imageUrl || err?.output?.url || ''
          } catch {}
          break
        }
        if (task.status === 'failed') {
          console.warn('[Execution-Images] 场景图任务失败:', task.error)
          break
        }
      }

      if (!imageUrl) {
        throw new Error('图片生成超时或失败，请检查模型配置和 API Key')
      }

      // ⭐ 下载到本地 + 上传到 COS
      const { cosService } = await import('../services/cos-service.js')
      try {
        const userId = (request.user as any)?.id || 'anonymous'
        const result = await cosService.uploadFile(imageUrl, 'image', userId)
        imageUrl = result.cosUrl
        console.log(`[Execution-Images] 场景图 COS uploaded: ${imageUrl}`)
      } catch (e: any) {
        console.warn('[Execution-Images] 场景图 COS 上传失败，使用原 URL:', e.message)
      }

      // 存储到场景图片表
      const existing = await prisma.project.findUnique({ where: { id: projId } })
      if (!existing) {
        await prisma.project.create({
          data: { id: projId, name: scene.name, userId: (request.user as any).id },
        }).catch(() => {})
      }
      await prisma.sceneImage.upsert({
        where: {
          projectId_sceneName: {
            projectId: projId,
            sceneName: scene.name.trim() || `scene_${Date.now()}`,
          },
        },
        update: { imageUrl, sortOrder: 0 },
        create: { projectId: projId, imageUrl, sceneName: scene.name.trim() || `scene_${Date.now()}`, sortOrder: 0 },
      }).catch(() => { console.warn('[Execution-Images] 场景图存储失败') })

      return reply.send({ success: true, imageUrl, url: imageUrl })
    } catch (err: any) {
      console.warn('[Execution-Images] POST 场景图失败:', err.message)
      return reply.status(500).send({ error: err.message || '场景图片生成失败' })
    }
  })

  // ─── 场景图片 ───
  fastify.put('/execution-images/scenes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, images } = request.body as any
    if (!projectId || !images) return reply.status(400).send({ error: 'projectId and images required' })

    // 确保 project 存在
    const existing = await prisma.project.findUnique({ where: { id: projectId } })
    if (!existing) {
      await prisma.project.create({
        data: { id: projectId, name: '临时项目', userId: (request.user as any).id },
      })
    }

    // 逐张 upsert，不整体删除（修复：刷新后只剩最后一张图的问题）
    await prisma.$transaction(
      images.map((img: any, i: number) => {
        const sceneName = img.sceneName ? (img.sceneName.trim() || `scene_${i}`) : `scene_${i}`
        return prisma.sceneImage.upsert({
          where: {
            projectId_sceneName: {
              projectId,
              sceneName,
            },
          },
          update: { imageUrl: img.url, sortOrder: i },
          create: { projectId, imageUrl: img.url, sceneName, sortOrder: i },
        })
      }),
    )
    return { success: true } satisfies ApiResponse<unknown>;

  })

  fastify.get('/execution-images/scenes/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      return { success: true, data: [] } satisfies ApiResponse<unknown>;

    }
    const images = await prisma.sceneImage.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' }
    })
    return { success: true, data: images } satisfies ApiResponse<unknown>;

  })

  // ─── 分镜图片 ───
  fastify.put('/execution-images/storyboards', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { projectId, images } = request.body as any
    if (!projectId || !images) return reply.status(400).send({ error: 'projectId and images required' })

    // 逐张 upsert，不整体删除（修复：刷新后只剩最后一张图的问题）
    await prisma.$transaction(
      images.map((img: any, i: number) => {
        const segId = img.segmentId ? String(img.segmentId) : (img.segmentName ? String(img.segmentName) : `seg_${i}`)
        return prisma.storyboardImage.upsert({
          where: {
            projectId_segmentId: {
              projectId,
              segmentId: segId,
            },
          },
          update: { imageUrl: img.url, sortOrder: i },
          create: { projectId, imageUrl: img.url, segmentId: segId, sortOrder: i },
        })
      }),
    )
    return { success: true } satisfies ApiResponse<unknown>;

  })

  fastify.get('/execution-images/storyboards/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      return { success: true, data: [] } satisfies ApiResponse<unknown>;

    }
    const images = await prisma.storyboardImage.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' }
    })
    return { success: true, data: images } satisfies ApiResponse<unknown>;

  })

  // ─── 视频帧图片 ───
  fastify.put('/execution-images/frames', async (request, reply) => {
    const { projectId, images } = request.body as any
    if (!projectId || !images) return reply.status(400).send({ error: 'projectId and images required' })

    await prisma.$transaction([
      prisma.frameImage.deleteMany({ where: { projectId } }),
      ...images.map((img: any, i: number) =>
        prisma.frameImage.create({
          data: { projectId, imageUrl: img.url, segmentId: String(img.segmentId || `seg_${i}`), frameType: img.frameType || 'first' },
        })
      ),
    ])
    return { success: true } satisfies ApiResponse<unknown>;

  })

  fastify.get('/execution-images/frames/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      return { success: true, data: [] } satisfies ApiResponse<unknown>;

    }
    const images = await prisma.frameImage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' }
    })
    return { success: true, data: images } satisfies ApiResponse<unknown>;

  })

  // GET /execution-images/videos/:projectId — 获取已生成的各分镜视频 URL
  fastify.get('/execution-images/videos/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const segments = await prisma.aiVideoSegment.findMany({
      where: { projectId, videoUrl: { not: null } },
      select: { segmentId: true, videoUrl: true, duration: true },
    })
    return { success: true, data: segments } satisfies ApiResponse<unknown>;

  })

  // ⭐ POST /execution-images/migrate/:projectId — 从 executionResults / pipelineStage 迁移图片到独立表
  fastify.post('/execution-images/migrate/:projectId', async (request, reply) => {
    const { projectId } = request.params as any

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { executionResults: true },
    })
    if (!project) return reply.status(404).send({ error: '项目不存在' })

    const er = project.executionResults as Record<string, any> || {}
    const report: Record<string, number> = { characters: 0, scenes: 0, storyboards: 0, videos: 0, fromPipeline: false }

    // 0️⃣ 优先从 pipelineStage 表提取（最新的场景/角色数据在那里）
    const pipelineStages = await prisma.pipelineStage.findMany({
      where: { projectId, status: 'done' },
    })
    for (const ps of pipelineStages) {
      if (!ps.outputData) continue
      let od: any
      try {
        od = typeof ps.outputData === 'string' ? JSON.parse(ps.outputData) : ps.outputData
      } catch {
        od = {}
      }
      if (ps.stageKey === 'scene' && od.scenes) {
        const sceneImages = od.scenes
          .filter((s: any) => s.imageResult?.url)
          .map((s: any, i: number) => ({
            projectId, imageUrl: s.imageResult.url, sceneName: s.sceneName || `scene_${i}`, sortOrder: i,
          }))
        if (sceneImages.length > 0) {
          await prisma.$transaction([
            prisma.sceneImage.deleteMany({ where: { projectId } }),
            ...sceneImages.map((d: any) => prisma.sceneImage.create({ data: d })),
          ])
          report.scenes = sceneImages.length
          report.fromPipeline = true
        }
      }
      if (ps.stageKey === 'character' && od.characters) {
        const charImages = od.characters
          .filter((c: any) => c.imageUrl)
          .map((c: any, i: number) => ({
            projectId, imageUrl: c.imageUrl, characterName: c.name || c.characterName || `char_${i}`, sortOrder: i,
          }))
        if (charImages.length > 0) {
          await prisma.$transaction([
            prisma.characterImage.deleteMany({ where: { projectId } }),
            ...charImages.map((d: any) => prisma.characterImage.create({ data: d })),
          ])
          report.characters = charImages.length
          report.fromPipeline = true
        }
      }
      if (ps.stageKey === 'storyboard' && od.storyboards) {
        const sbImages = od.storyboards
          .filter((s: any) => s.imageResult?.url)
          .map((s: any, i: number) => ({
            projectId, imageUrl: s.imageResult.url, segmentId: String(s.segmentId || `seg_${i}`), sortOrder: i,
          }))
        if (sbImages.length > 0) {
          await prisma.$transaction([
            prisma.storyboardImage.deleteMany({ where: { projectId } }),
            ...sbImages.map((d: any) => prisma.storyboardImage.create({ data: d })),
          ])
          report.storyboards = sbImages.length
          report.fromPipeline = true
        }
      }
    }

    // 1. 迁移角色图片 — characterSpecs[].imageUrl
    const charSpecs = er.characterSpecs || []
    const charImages = charSpecs
      .filter((c: any) => c.imageUrl)
      .map((c: any, i: number) => ({
        projectId, imageUrl: c.imageUrl, characterName: c.characterName || `char_${i}`,
        variant: c.variant || '',
        sortOrder: i,
      }))
    if (charImages.length > 0) {
      await prisma.$transaction([
        prisma.characterImage.deleteMany({ where: { projectId } }),
        ...charImages.map((d: any) => prisma.characterImage.create({ data: d })),
      ])
      report.characters = charImages.length
    }

    // 2. 迁移场景图片 — sceneSpecs[].imageUrl
    const sceneSpecs = er.sceneSpecs || []
    const sceneImages = sceneSpecs
      .filter((s: any) => s.imageUrl)
      .map((s: any, i: number) => ({
        projectId, imageUrl: s.imageUrl, sceneName: s.sceneName || `scene_${i}`, sortOrder: i,
      }))
    if (sceneImages.length > 0) {
      await prisma.$transaction([
        prisma.sceneImage.deleteMany({ where: { projectId } }),
        ...sceneImages.map((d: any) => prisma.sceneImage.create({ data: d })),
      ])
      report.scenes = sceneImages.length
    }

    // 3. 迁移分镜图片 — frameDesign[].imageUrl / lastFrameImageUrl
    const fd = er.frameDesign || []
    const sbImages: Array<{ projectId: string; segmentId: string; imageUrl: string; sortOrder: number }> = []
    fd.forEach((f: any, i: number) => {
      if (f.imageUrl) sbImages.push({ projectId, segmentId: String(f.segmentId || `seg_${i}`), imageUrl: f.imageUrl, sortOrder: i * 2 })
      if (f.lastFrameImageUrl) sbImages.push({ projectId, segmentId: String(f.segmentId || `seg_${i}`), imageUrl: f.lastFrameImageUrl, sortOrder: i * 2 + 1 })
    })
    if (sbImages.length > 0) {
      await prisma.$transaction([
        prisma.storyboardImage.deleteMany({ where: { projectId } }),
        ...sbImages.map((d) => prisma.storyboardImage.create({ data: d })),
      ])
      report.storyboards = sbImages.length
    }

    // 4. 迁移视频 URL — videoSegments[].videoUrl
    const videoSegs = er.videoSegments || []
    let videoCount = 0
    for (const seg of videoSegs) {
      if (seg.videoUrl) {
        await prisma.aiVideoSegment.updateMany({
          where: { projectId, segmentId: String(seg.segmentId || '') },
          data: { videoUrl: seg.videoUrl },
        })
        videoCount++
      }
    }
    report.videos = videoCount

    return { success: true, message: '迁移完成', report } satisfies ApiResponse<unknown>;

  })

  // ─── POST /execution-images/refresh/:projectId — 下载过期的阿里云 OSS 图片到本地并更新 URL
  // 阿里云 dashscope 生成的图片 URL 带临时签名，24h 后过期
  fastify.post('/execution-images/refresh/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    const fs = await import('fs/promises')
    const path = await import('path')
    const https = await import('https')
    const http = await import('http')

    const uploadDir = path.resolve(process.cwd(), 'public/uploads')
    await fs.mkdir(uploadDir, { recursive: true })

    const report: Record<string, number> = { downloaded: 0, failed: 0 }
    const urlMap = new Map<string, string>()

    async function downloadUrl(url: string): Promise<string | null> {
      if (urlMap.has(url)) return urlMap.get(url)!
      if (!url.startsWith('http')) return url

      const ext = path.extname(url.split('?')[0]) || '.png'
      const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 8)}${ext}`
      const filepath = path.join(uploadDir, filename)

      try {
        const body = await new Promise<Buffer>((resolve, reject) => {
          const client = url.startsWith('https') ? https : http
          client.get(url, { timeout: 15000 }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              client.get(res.headers.location, { timeout: 15000 }, (res2) => {
                const chunks: Buffer[] = []
                res2.on('data', (c: Buffer) => chunks.push(c))
                res2.on('end', () => resolve(Buffer.concat(chunks)))
                res2.on('error', reject)
              }).on('error', reject)
            } else {
              const chunks: Buffer[] = []
              res.on('data', (c: Buffer) => chunks.push(c))
              res.on('end', () => resolve(Buffer.concat(chunks)))
              res.on('error', reject)
            }
          }).on('error', reject)
        })
        await fs.writeFile(filepath, body)
        const localUrl = `/uploads/${filename}`
        urlMap.set(url, localUrl)
        return localUrl
      } catch (e: any) {
        console.warn(`[refresh-images] 下载失败: ${url.slice(0, 60)}...`, e.message)
        urlMap.set(url, url)
        return url
      }
    }

    // 1. 从 pipelineStage 表下载
    const pipelineStages = await prisma.pipelineStage.findMany({
      where: { projectId, status: 'done' },
    })

    for (const ps of pipelineStages) {
      if (!ps.outputData) continue
      let od: any
      try {
        od = typeof ps.outputData === 'string' ? JSON.parse(ps.outputData) : ps.outputData
      } catch {
        od = {}
      }

      if (ps.stageKey === 'scene' && od.scenes) {
        for (const scene of od.scenes) {
          if (scene.imageResult?.url) {
            const localUrl = await downloadUrl(scene.imageResult.url)
            if (localUrl !== scene.imageResult.url) {
              scene.imageResult.url = localUrl
              report.downloaded++
            }
          }
        }
      }
      if (ps.stageKey === 'character' && od.characters) {
        for (const ch of od.characters) {
          if (ch.imageUrl) {
            const localUrl = await downloadUrl(ch.imageUrl)
            if (localUrl !== ch.imageUrl) {
              ch.imageUrl = localUrl
              report.downloaded++
            }
          }
        }
      }
      if (ps.stageKey === 'storyboard' && od.storyboards) {
        for (const sb of od.storyboards) {
          if (sb.imageResult?.url) {
            const localUrl = await downloadUrl(sb.imageResult.url)
            if (localUrl !== sb.imageResult.url) {
              sb.imageResult.url = localUrl
              report.downloaded++
            }
          }
        }
      }

      await prisma.pipelineStage.update({
        where: { id: ps.id },
        data: { outputData: od as any },
      })
    }

    // 2. 走一遍 migrate，提取 URL 到独立表 — 直接调用 migrate 逻辑
    // （不使用 fetch，避免端口冲突）
    try {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { executionResults: true } })
      if (project?.executionResults) {
        const er = project.executionResults as Record<string, any> || {}
        // 迁移角色图片
        const charSpecs = er.characterSpecs || []
        const ci = charSpecs.filter((c: any) => c.imageUrl).map((c: any, i: number) => ({
          projectId, imageUrl: c.imageUrl, characterName: c.characterName || `char_${i}`, sortOrder: i,
        }))
        if (ci.length > 0) {
          await prisma.$transaction([
            prisma.characterImage.deleteMany({ where: { projectId } }),
            ...ci.map((d: any) => prisma.characterImage.create({ data: d })),
          ])
          report.characters = (report.characters || 0) + ci.length
        }
        // 迁移场景图片
        const sceneSpecs = er.sceneSpecs || []
        const si = sceneSpecs.filter((s: any) => s.imageUrl).map((s: any, i: number) => ({
          projectId, imageUrl: s.imageUrl, sceneName: s.sceneName || `scene_${i}`, sortOrder: i,
        }))
        if (si.length > 0) {
          await prisma.$transaction([
            prisma.sceneImage.deleteMany({ where: { projectId } }),
            ...si.map((d: any) => prisma.sceneImage.create({ data: d })),
          ])
          report.scenes = (report.scenes || 0) + si.length
        }
      }
    } catch (e: any) {
      console.warn('[refresh-images] migrate failed:', e.message)
    }

    return { success: true, message: `下载 ${report.downloaded} 张图片完成`, report } satisfies ApiResponse<unknown>;

  })

  // GET /execution-images/proxy — 图片代理（解决 OSS 防盗链问题）
  fastify.get('/execution-images/proxy', async (request, reply) => {
    const { url } = request.query as any
    if (!url) return reply.status(400).send({ error: '缺少 url 参数' })

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; shipin-cinematic-studio/1.0)',
          'Referer': '',
        },
      })
      if (!response.ok) {
        // OSS 签名过期/防盗链 → redirect 到原 URL（让浏览器尝试）
        console.warn(`[Proxy] 上游返回 ${response.status}，fallback 到重定向: ${url.substring(0, 80)}`)
        return reply.redirect(url, 302)
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const buffer = await response.arrayBuffer()

      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'public, max-age=86400')
        .header('Access-Control-Allow-Origin', '*')
        .send(Buffer.from(buffer))
    } catch (err: any) {
      console.warn(`[Proxy] 代理请求异常，fallback 到重定向: ${err.message}`)
      return reply.redirect(url, 302)
    }
  })

  // ─── 删除角色图片（素材库用） ───
  fastify.delete('/execution-images/characters/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    if (!id) return reply.status(400).send({ error: 'id required' })
    try {
      await prisma.characterImage.delete({ where: { id } })
      return { success: true } satisfies ApiResponse<unknown>;

    } catch (e: any) {
      console.warn('[delete characterImage]', e.message)
      return reply.status(404).send({ error: 'not found' })
    }
  })

  // ─── 删除场景图片（素材库用） ───
  fastify.delete('/execution-images/scenes/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as any
    if (!id) return reply.status(400).send({ error: 'id required' })
    try {
      await prisma.sceneImage.delete({ where: { id } })
      return { success: true } satisfies ApiResponse<unknown>;

    } catch (e: any) {
      console.warn('[delete sceneImage]', e.message)
      return reply.status(404).send({ error: 'not found' })
    }
  })
}
