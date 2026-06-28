import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { StyleProfileService } from '../services/style-profile.service.js'
import { writeFile, mkdir } from 'fs/promises'
import { resolve } from 'path'
import { get as httpsGet } from 'https'
import { request as httpRequest } from 'http'

async function downloadAndUpload(imageUrl: string, userId: string, subDir: string = 'images'): Promise<{ cosUrl: string; localUrl: string }> {
  const fs = await import('fs/promises')
  const path = await import('path')
  const crypto = await import('crypto')
  
  const uploadDir = resolve(process.cwd(), 'public/uploads', subDir)
  await mkdir(uploadDir, { recursive: true })
  
  const ext = ((imageUrl.split('?')[0].match(/\.(\w+)$/) || [])[1] || 'png').toLowerCase()
  const filename = `img_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`
  const localPath = resolve(uploadDir, filename)
  
  // Download to local
  await new Promise<void>((resolvePromise, reject) => {
    const protocol = imageUrl.startsWith('https') ? httpsGet : httpRequest
    const req = protocol(imageUrl, (res: any) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadAndUploadSingle(res.headers.location, localPath).then(resolvePromise).catch(reject)
        return
      }
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`下载失败: HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        fs.writeFile(localPath, Buffer.concat(chunks)).then(resolvePromise).catch(reject)
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('下载超时')) })
    req.end()
  })

  const localUrl = `/uploads/${subDir}/${filename}`
  
  // Upload to COS
  let cosUrl = ''
  try {
    const { cosService } = await import('../services/cos-service.js')
    const result = await cosService.uploadFile(imageUrl, 'image', userId)
    cosUrl = result.cosUrl
    console.log(`[Images] COS uploaded: ${cosUrl}`)
  } catch (e: any) {
    console.warn('[Images] COS 上传失败，使用本地 URL:', e.message)
    cosUrl = localUrl
  }
  
  return { cosUrl, localUrl }
}

async function downloadAndUploadSingle(url: string, dest: string): Promise<void> {
  const fs = await import('fs/promises')
  const protocol = url.startsWith('https') ? httpsGet : httpRequest
  return new Promise((resolvePromise, reject) => {
    const req = protocol(url, (res: any) => {
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`下载失败: HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => fs.writeFile(dest, Buffer.concat(chunks)).then(resolvePromise).catch(reject))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('下载超时')) })
    req.end()
  })
}

export default async function executionImageRoutes(fastify: FastifyInstance) {

  // ─── 角色图片生成入口（前端新版角色设计页调用） ───
  // ─── 辅助函数：提交图片生成任务并轮询等待 ───
  async function submitImageTask(
    prompt: string,
    negativePrompt: string,
    pid: string,
    authHeader: string,
    characterName: string,
    baseUrl: string,
    fixedSeed?: number,       // 三视图多图间固定 seed 保持角色一致性
    referenceImage?: string,  // ⭐ 参考图 URL（用于图生图，确保服装一致）
  ): Promise<string> {
    const taskInput: any = {
      prompt,
      negativePrompt,
      source: 'character_execution',
      characterName,
      name: characterName,
    }
    if (fixedSeed !== undefined) taskInput.seed = fixedSeed
    if (referenceImage) {
      taskInput.referenceImage = referenceImage
      taskInput.referenceImages = [referenceImage]
    }
    const genRes = await fetch(`${baseUrl}/api/tasks/ai-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: authHeader },
      body: JSON.stringify({ projectId: pid, taskType: 'image', input: taskInput }),
    })
    if (!genRes.ok) {
      const errText = await genRes.text().catch(() => '')
      throw new Error(`图片生成任务提交失败: ${genRes.status} ${errText}`)
    }
    const genData = await genRes.json()
    const taskId = genData?.task?.id
    if (!taskId) throw new Error('未获取到任务 ID')

    // 轮询等待（最多 60 秒，每 2 秒检查一次）
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
        let url = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || ''
        if (url) return url
        try {
          const err = JSON.parse(task.error || '{}')
          url = err?.output?.imageUrl || err?.output?.url || ''
        } catch {}
        return url
      }
      if (task.status === 'failed') {
        console.warn('[Execution-Images] 子任务失败:', task.error)
        return ''
      }
    }
    return ''
  }

  /** 将图片 URL 转为可下载的完整 URL */
  function resolveImageUrl(url: string, baseUrl: string, authHeader: string): string {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    if (url.startsWith('/uploads/')) return `${baseUrl}${url}`
    if (url.startsWith('/')) return `${baseUrl}${url}`
    return url
  }

  // ─── 角色图片生成入口（新版：支持三视图模式） ───
  fastify.post('/execution-images/characters', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as any
    const { characterId, character, storyText } = body || {}
    if (!character || !character.name) {
      console.warn('[Execution-Images] 400: character.name 缺失', JSON.stringify({ hasCharacter: !!character, hasName: character?.name }))
      return reply.status(400).send({ error: 'character object with name required' })
    }

    const imagePrompt = character.imagePrompt || ''
    const negativePrompt = character.negativePrompt || ''
    const authHeader = (request.headers as any).authorization || ''
    const userId = (request.user as any)?.id || 'anonymous'
    let pid = body.projectId
    if (!pid) {
      const lastProject = await prisma.project.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      if (lastProject) {
        pid = lastProject.id
      } else {
        const newProject = await prisma.project.create({
          data: { id: crypto.randomUUID(), name: character.name, userId },
        })
        pid = newProject.id
      }
      console.log('[Execution-Images] projectId 自动兜底:', pid)
    }

    try {
      // ⭐ 风格后缀从 StyleProfile 动态读取
      const vs: string = body.videoStyle || 'realistic'
      const profile = await StyleProfileService.getByName(vs)
      const styleTokens = profile?.styleTokens || '写实真人，电影级画质'
      const negativeTokens = profile?.negativeTokens || ''
      const baseNegative = (negativePrompt + '\n' + negativeTokens + ', multiple persons, group, crowd, 2 persons, 3 persons, deformed, extra limbs, extra fingers, multi-panel, grid, collage, multiple views, split view, comparison, 多图, 九宫格, 拼图, 对比图, 网格').trim()
      const basePrompt = (imagePrompt + '\n' + styleTokens).trim()

      const baseUrl = `http://localhost:${process.env.PORT || 4002}`

      // ⭐ 三视图模式判断
      const tripleView = body.tripleView === true || character.tripleView === true

      let imageUrl = ''
      let viewUrls: string[] = []

      if (tripleView) {
        // ── 三视图模式：生成三张视角图 ──
        // 用角色核心描述（不含视角/姿势约束），避免"正面定妆照"覆盖视角修饰词
        const charDesc = character.imagePrompt || character.description || character.name || ''
        const baseDesc = (charDesc + '\n' + styleTokens).trim()

        // 从 profile 读取三视图视角修饰词
        const viewModifiers = profile?.promptOverrides?.tripleViewModifiers || {
          front: '全身照，正对镜头，居中构图',
          side: '全身照，侧面视角，身体微侧',
          back: '全身照，背对镜头，背影展示',
        }

        // 如果 character 有 tripleViewPrompts 就用预设的，否则在基础 prompt 上追加视角
        const getViewPrompt = (viewKey: string, modifier: string) => {
          if (character.tripleViewPrompts?.[viewKey]) {
            return character.tripleViewPrompts[viewKey]
          }
          return `${baseDesc}，${modifier}，全身站立正面视角，纯色背景，角色设计`.trim()
        }

        // ⭐ 补全为完整 URL（AI adapter 可能返回相对路径）
        const resolveUrl = (u: string) => resolveImageUrl(u, baseUrl, authHeader)
        const frontPrompt = getViewPrompt('front', viewModifiers.front)

        // ⭐ 三视图优化逻辑：先生成正脸，再用正脸图作为参考图生成侧脸和背脸
        // 保证服装颜色和结构一致
        const tripleSeed = Math.floor(Math.random() * 2147483647)

        // 第一步：生成正脸图
        const frontUrl = await submitImageTask(frontPrompt, baseNegative, pid, authHeader, character.name, baseUrl, tripleSeed)
        const resolvedFront = resolveUrl(frontUrl)

        // 第二步：以正脸图为参考图，生成侧脸和背脸（图生图确保服装一致）
        // 侧脸/背脸 prompt 保留角色名+核心特征，明确是同一角色的不同视角
        const charNameForPrompt = character.name || ''
        const charDescBrief = (character.imagePrompt || character.description || '').slice(0, 60)
        const sideRefPrompt = character.tripleViewPrompts?.side
          ? character.tripleViewPrompts.side
          : `角色「${charNameForPrompt}」侧身视角，全身照，身体微侧至45度，${charDescBrief}，完整露出侧身体型和服装，${styleTokens}，侧面全身视角，角色侧身展示`
        const backRefPrompt = character.tripleViewPrompts?.back
          ? character.tripleViewPrompts.back
          : `角色「${charNameForPrompt}」背对视角，全身照，背对镜头展示背面轮廓，${charDescBrief}，完整露出背面服装和身形轮廓，${styleTokens}，背面全身视角，角色背影展示`

        const [sideUrl, backUrl] = await Promise.all([
          submitImageTask(sideRefPrompt, baseNegative, pid, authHeader, character.name, baseUrl, tripleSeed, resolvedFront),
          submitImageTask(backRefPrompt, baseNegative, pid, authHeader, character.name, baseUrl, tripleSeed, resolvedFront),
        ])

        let resolvedSide = resolveUrl(sideUrl)
        let resolvedBack = resolveUrl(backUrl)

        // ⭐ 侧脸或背脸生成失败时，不用参考图重试一次（可能图生图模式不稳）
        if (!resolvedSide && resolvedFront) {
          console.warn('[Execution-Images] 侧脸生成失败，无参考图重试...')
          const retrySide = await submitImageTask(sideRefPrompt, baseNegative, pid, authHeader, character.name, baseUrl, tripleSeed)
          resolvedSide = resolveUrl(retrySide)
        }
        if (!resolvedBack && resolvedFront) {
          console.warn('[Execution-Images] 背脸生成失败，无参考图重试...')
          const retryBack = await submitImageTask(backRefPrompt, baseNegative, pid, authHeader, character.name, baseUrl, tripleSeed)
          resolvedBack = resolveUrl(retryBack)
        }
        // ⭐ 如果还是有缺失，用正脸图代替缺失的视角
        if (!resolvedSide) {
          console.warn('[Execution-Images] 侧脸仍生成失败，用正脸代替')
          resolvedSide = resolvedFront
        }
        if (!resolvedBack) {
          console.warn('[Execution-Images] 背脸仍生成失败，用正脸代替')
          resolvedBack = resolvedFront
        }

        viewUrls = [resolvedFront, resolvedSide, resolvedBack].filter(Boolean)

        if (viewUrls.length < 2) {
          // 只生成了不到2张，回退到单张
          console.warn('[Execution-Images] 三视图生成不足，回退到单张')
          if (viewUrls.length === 1) {
            imageUrl = viewUrls[0]
          } else {
            // 全失败，重新用单张方式重试
            const fallbackUrl = await submitImageTask(basePrompt, baseNegative, pid, authHeader, character.name, baseUrl)
            imageUrl = resolveUrl(fallbackUrl)
          }
        } else {
          // ⭐ 至少有 2 张以上 → 合并为三视定妆图
          let faceCropUrl = ''
          try {
            const { generateTripleViewCharacterSheet } = await import('../services/triple-view-merger.js')
            const result = await generateTripleViewCharacterSheet({
              frontImageUrl: resolvedFront,
              sideImageUrl: resolvedSide,
              backImageUrl: resolvedBack,   // 如果背面图缺失，用侧面图占位
              characterName: character.name,
            })
            imageUrl = result.mergedImageUrl
            // ⭐ 保存正脸裁剪图 URL 供后续引用
            faceCropUrl = result.faceCropUrl || ''
            console.log(`[Execution-Images] 三视定妆图合并完成: ${imageUrl} (${result.width}x${result.height})`)
            if (faceCropUrl) {
              console.log(`[Execution-Images] 正脸参考图已裁剪: ${faceCropUrl}`)
            }
            // ⭐ 持久化正脸裁剪图
            try {
              const faceRef = await downloadAndUpload(faceCropUrl, userId, 'characters')
              const faceUrlFinal = faceRef.cosUrl?.startsWith('/uploads') ? faceCropUrl : (faceRef.cosUrl || faceCropUrl)
              await prisma.characterImage.upsert({
                where: {
                  projectId_characterName_variant: {
                    projectId: pid,
                    characterName: character.name,
                    variant: 'face_ref',
                  },
                },
                update: { imageUrl: faceUrlFinal, sortOrder: 1 },
                create: { projectId: pid, imageUrl: faceUrlFinal, characterName: character.name, variant: 'face_ref', sortOrder: 1 },
              }).catch(() => null)
            } catch {}
            // ⭐ 持久化正面全身图（供分镜卡片引用，variant='front'）
            try {
              const frontRef = await downloadAndUpload(resolvedFront, userId, 'characters')
              const frontUrlFinal = frontRef.cosUrl?.startsWith('/uploads') ? resolvedFront : (frontRef.cosUrl || resolvedFront)
              await prisma.characterImage.upsert({
                where: {
                  projectId_characterName_variant: {
                    projectId: pid,
                    characterName: character.name,
                    variant: 'front',
                  },
                },
                update: { imageUrl: frontUrlFinal, sortOrder: 2 },
                create: { projectId: pid, imageUrl: frontUrlFinal, characterName: character.name, variant: 'front', sortOrder: 2 },
              }).catch(() => null)
            } catch {}
          } catch (e: any) {
            console.warn('[Execution-Images] 三视定妆图合并失败，使用第一张:', e.message)
            imageUrl = viewUrls[0]
          }
        }
      } else {
        // ── 单视图模式（原有逻辑） ──
        const genRes = await fetch(`${baseUrl}/api/tasks/ai-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: authHeader },
          body: JSON.stringify({
            projectId: pid,
            taskType: 'image',
            input: {
              prompt: basePrompt,
              negativePrompt: baseNegative,
              source: 'character_execution',
              characterName: character.name,
              name: character.name,
              ...(body.referenceImage ? { imageUrl: body.referenceImage, mode: body.mode || 'img2img' } : {}),
            },
          }),
        })
        if (!genRes.ok) throw new Error(`图片生成任务提交失败: ${genRes.status}`)
        const genData = await genRes.json()
        const taskId = genData?.task?.id
        if (!taskId) throw new Error('未获取到任务 ID')

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
            if (imageUrl) break
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
        if (!imageUrl) throw new Error('图片生成超时或失败')
      }

      // ⭐ 持久化：下载到本地
      if (imageUrl) {
        const originalUrl = imageUrl
        try {
          const result = await downloadAndUpload(imageUrl, userId, 'characters')
          imageUrl = result.cosUrl?.startsWith('/uploads') ? originalUrl : (result.cosUrl || originalUrl)
          console.log(`[Execution-Images] 角色图持久化完成: ${imageUrl}`)
        } catch (e: any) {
          console.warn('[Execution-Images] 图片持久化失败，使用原 URL:', e.message)
          imageUrl = originalUrl
        }

        // 存储到角色图片表
        const existing = await prisma.project.findUnique({ where: { id: pid } })
        if (!existing) {
          await prisma.project.create({
            data: { id: pid, name: character.name, userId: (request.user as any).id },
          }).catch(() => {})
        }

        // 主角色图：三视定妆图（或单张图）
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

        return reply.send({
          success: true,
          imageUrl,
          url: imageUrl,
          id: saved?.id || '',
          tripleView: tripleView ? true : undefined,
          viewUrls: tripleView ? viewUrls : undefined,
          faceCropUrl: (tripleView && typeof faceCropUrl !== 'undefined') ? faceCropUrl : undefined,
        })
      }

      return reply.status(500).send({ error: '图片生成失败' })
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
    console.log('[Scene] POST body:', JSON.stringify(body).slice(0, 500))
    const { sceneId, scene, projectId: pid } = body || {}
    if (!scene || !scene.name) {
      return reply.status(400).send({ error: 'scene object with name required' })
    }

    const imagePrompt = scene.imagePrompt || scene.description || ''
    const negativePrompt = scene.negativePrompt || ''
    const authHeader = (request.headers as any).authorization || ''
    const projId = pid
    if (!projId) return reply.status(400).send({ error: 'projectId required' })

    // ⭐ 场景风格约束从 StyleProfile 动态读取（禁止硬编码）
    const vsScene: string = body.videoStyle || 'realistic'
    const sceneProfile = await StyleProfileService.getByName(vsScene)
    const sceneTokens = sceneProfile?.styleTokens || '空场景，无人物'
    try {
      const engineScenePrompt = (imagePrompt + '\n' + sceneTokens).trim()
      const taskInput: any = {
        prompt: engineScenePrompt,
        negativePrompt,
        source: 'scene_execution',
        sceneName: scene.name,
        name: scene.name,
      }
      // 传递图生图参数
      const body2 = body as any
      if (body2.referenceImage) {
        taskInput.imageUrl = body2.referenceImage
        taskInput.mode = body2.mode || 'img2img'
      }
      const genRes = await fetch(`http://localhost:${process.env.PORT || 4002}/api/tasks/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: authHeader },
        body: JSON.stringify({
          projectId: projId,
          taskType: 'image',
          input: taskInput,
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

      // ⭐ 下载到本地 + 上传到 COS（强制保存，不阻塞生成流程）
      const userId = (request.user as any)?.id || 'anonymous'
      const originalUrl = imageUrl
      try {
        const result = await downloadAndUpload(imageUrl, userId, 'scenes')
        imageUrl = result.cosUrl.startsWith('/uploads') ? originalUrl : result.cosUrl
        console.log(`[Execution-Images] 场景图持久化完成: ${imageUrl}`)
      } catch (e: any) {
        console.warn('[Execution-Images] 场景图持久化失败，使用原 URL:', e.message)
        imageUrl = originalUrl
      }

      // 存储到场景图片表
      const existing = await prisma.project.findUnique({ where: { id: projId } })
      if (!existing) {
        await prisma.project.create({
          data: { id: projId, name: scene.name, userId: (request.user as any).id },
        }).catch(() => {})
      }
      const savedScene = await prisma.sceneImage.upsert({
        where: {
          projectId_sceneName: {
            projectId: projId,
            sceneName: scene.name.trim() || `scene_${Date.now()}`,
          },
        },
        update: { imageUrl, sortOrder: 0 },
        create: { projectId: projId, imageUrl, sceneName: scene.name.trim() || `scene_${Date.now()}`, sortOrder: 0 },
      })
      console.log(`[Execution-Images] 场景图已持久化: sceneName=${savedScene.sceneName}, imageUrl=${imageUrl?.substring(0, 60)}`)

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

  // GET /execution-images/storyboards/all — 返回所有有故事板图片的项目（给前端兜底用）
  fastify.get('/execution-images/storyboards/all', async (request, reply) => {
    const userId = (request.user as any)?.id
    const images = await prisma.storyboardImage.findMany({
      where: userId ? { project: { userId } } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return { success: true, data: images } satisfies ApiResponse<unknown>;
  })

  // ─── 全量素材图（含道具图）─ 一次性返回所有素材 ───
  fastify.get('/execution-images/all/:projectId', async (request, reply) => {
    const { projectId } = request.params as any
    if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
      return { success: true, data: [] } satisfies ApiResponse<unknown>;
    }
    const [characters, scenes, storyboards, frames, props] = await Promise.all([
      prisma.characterImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.sceneImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.storyboardImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.frameImage.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
      prisma.propImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
    ])
    return {
      success: true,
      data: { characters, scenes, storyboards, frames, props }
    } satisfies ApiResponse<unknown>;
  })

  // ─── 道具图片获取 ⭐ ───
  fastify.get('/execution-images/prop-images/:projectId', async (request, reply) => {
    try {
      const { projectId } = request.params as any
      if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
        return { success: true, data: [] } satisfies ApiResponse<unknown>;
      }
      const images = await prisma.propImage.findMany({
        where: { projectId },
        orderBy: { sortOrder: 'asc' }
      })
      return { success: true, data: images } satisfies ApiResponse<unknown>;
    } catch (e: any) {
      return { success: false, error: e.message } satisfies ApiResponse<unknown>;
    }
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

    // 4. 迁移视频 URL — videoSegments[].videoUrl（批量 upsert 替代逐条 updateMany）
    const videoSegs = er.videoSegments || []
    let videoCount = 0
    const videoUpdates = videoSegs
      .filter((seg: any) => seg.videoUrl)
      .map((seg: any) => ({
        where: { projectId, segmentId: String(seg.segmentId || '') },
        data: { videoUrl: seg.videoUrl },
      }))
    if (videoUpdates.length > 0) {
      await Promise.all(videoUpdates.map((u: any) =>
        prisma.aiVideoSegment.updateMany({ where: u.where, data: u.data })
      ))
      videoCount = videoUpdates.length
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

  // ─── 道具图片生成 ───
  // 前端 PropsWorkspace.vue → POST /api/v1/aigc-spec/generate-prop-image
  // 兼容旧路径（studio-v2 工作台调用）和新路径（execution-images 统一入口）
  fastify.post('/v1/aigc-spec/generate-prop-image', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as any
    const { prompt, negativePrompt, projectId, propKey } = body || {}
    // 从前端 prompt 第一行提取道具名（格式：[商品]: xxx）
    const nameFromPrompt = prompt ? prompt.match(/\[商品\]:\s*(.+?)(\n|$)/)?.[1]?.trim() : ''
    const propName = body.propName || body.name || nameFromPrompt || '道具'
    if (!prompt && !propName) {
      return reply.status(400).send({ error: 'prompt or propName required' })
    }

    const authHeader = (request.headers as any).authorization || ''
    const pid = projectId || body.projectId
    if (!pid) return reply.status(400).send({ error: 'projectId required' })

    try {
      // 构造白底道具图 prompt
      const fullPrompt = prompt || `[商品]: ${propName}\n[描述]: 电商白底图，产品摄影，4K高清`

      // 默认的电商白底图负面 prompt
      const fullNegative = negativePrompt || '人物, 模特, 手, 人体部位, 文字以外文字, 水印, 任何人, 阴影, 复杂背景, 多件物品, 重复, 变形, 模糊, 低质量'

      // 调用 SEEL 入口异步任务
      const taskInput: any = {
        prompt: fullPrompt,
        negativePrompt: fullNegative,
        source: 'prop_execution',
        propName,
        name: propName,
      }
      // 传递参考图参数（如果有）
      if (body.referenceImage) {
        taskInput.imageUrl = body.referenceImage
        taskInput.mode = body.mode || 'img2img'
      }

      const genRes = await fetch(`http://localhost:${process.env.PORT || 4002}/api/tasks/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: authHeader },
        body: JSON.stringify({
          projectId: pid,
          taskType: 'image',
          input: taskInput,
        }),
      })

      if (!genRes.ok) {
        const errText = await genRes.text().catch(() => '')
        throw new Error(`图片生成任务提交失败: ${genRes.status} ${errText}`)
      }

      const genData = await genRes.json()
      const taskId = genData?.task?.id
      if (!taskId) throw new Error('未获取到任务 ID')

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
          const result = task.result || {}
          imageUrl = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || ''
          if (imageUrl) break
          try {
            const err = JSON.parse(task.error || '{}')
            imageUrl = err?.output?.imageUrl || err?.output?.url || ''
          } catch {}
          break
        }
        if (task.status === 'failed') {
          console.warn('[Execution-Images] 道具图任务失败:', task.error)
          break
        }
      }

      if (!imageUrl) {
        throw new Error('图片生成超时或失败，请检查模型配置和 API Key')
      }

      // Download to local + upload to COS (force save)
      const userId = (request.user as any)?.id || 'anonymous'
      const originalUrl = imageUrl
      try {
        const result = await downloadAndUpload(imageUrl, userId, 'props')
        imageUrl = result.cosUrl.startsWith('/uploads') ? originalUrl : result.cosUrl
        console.log(`[Execution-Images] 道具图持久化完成: ${imageUrl}`)
      } catch (e: any) {
        console.warn('[Execution-Images] 道具图持久化失败，使用原 URL:', e.message)
        imageUrl = originalUrl
      }

      // 确保 project 存在
      const existing = await prisma.project.findUnique({ where: { id: pid } })
      if (!existing) {
        await prisma.project.create({
          data: { id: pid, name: propName, userId: (request.user as any).id || 'anonymous' },
        }).catch(() => {})
      }

      // 存储到 propImage 表（没有唯一约束，用 findFirst + create/update）
      const existingProp = await prisma.propImage.findFirst({
        where: { projectId: pid, propName },
      })
      if (existingProp) {
        await prisma.propImage.update({
          where: { id: existingProp.id },
          data: {
            imageUrl,
            imagePrompt: body.imagePrompt || body.description || '',
            negativePrompt: fullNegative,
            category: body.category || '通用',
            description: body.description || '',
            sortOrder: body.sortOrder ?? 0,
          },
        })
      } else {
        await prisma.propImage.create({
          data: {
            projectId: pid,
            propName,
            imageUrl,
            imagePrompt: body.imagePrompt || body.description || '',
            negativePrompt: fullNegative,
            category: body.category || '通用',
            description: body.description || '',
            sortOrder: body.sortOrder ?? 0,
          },
        })
      }

      return reply.send({
        success: true,
        data: { imageUrl, url: imageUrl },
        imageUrl,
        url: imageUrl,
      })
    } catch (err: any) {
      console.warn('[Execution-Images] POST 道具图失败:', err.message)
      return reply.status(500).send({ error: err.message || '道具图片生成失败' })
    }
  })
}
