// ============================================================
// Ecom Image Route — 电商图片工作台后端 API
// ============================================================

import path from 'path'
import { prisma } from '../../utils/index.js'
import { runAnalysis, runGeneration } from '../../services/ecom-image/ecom-bridge.service.js'
import { credentialResolver } from '../services/credential/credential-resolver.js'
import { resolveAICredential } from '../services/credential/credential-adapter.js'

interface LLMConfig {
  apiKey: string
  baseUrl?: string
  modelName?: string
}

/**
 * 读取用户的 LLM + Vision 配置（来自 UserModelConfigV2）
 */
async function getUserLLMConfig(userId: string): Promise<{ llm: LLMConfig | null; vision: LLMConfig | null }> {
  const fallback = { llm: null, vision: null }
  try {
    const { credentialResolver } = await import('../../services/credential/credential-resolver.js')
    const { vaultService } = await import('../../services/credential/vault-service.js')
    const resolved = await credentialResolver.resolve({ ownerType: 'user', ownerId: userId, capability: 'text-generation' })
    if (!resolved) return fallback

    // ── 文本 LLM（通过 Credential Resolver）──
    let llm: LLMConfig | null = null
    try {
      const decrypted = await vaultService.getDecryptedCredential(resolved.credentialId)
      if (decrypted?.apiKey) {
        llm = {
          apiKey: decrypted.apiKey,
          baseUrl: decrypted.provider?.baseUrl || '',
          modelName: decrypted.provider?.model || '',
        }
      }
    } catch { /* ignore */ }

    // ── 视觉模型（通过 Credential Resolver）──
    let vision: LLMConfig | null = null
    try {
      const visionResolved = await credentialResolver.resolve({ ownerType: 'user', ownerId: userId, capability: 'image-generation' })
      if (visionResolved) {
        const visionDecrypted = await vaultService.getDecryptedCredential(visionResolved.credentialId)
        if (visionDecrypted?.apiKey) {
          vision = {
            apiKey: visionDecrypted.apiKey,
            baseUrl: visionDecrypted.provider?.baseUrl || '',
            modelName: visionDecrypted.provider?.model || '',
          }
        }
      }
    } catch { /* ignore */ }

    console.log('[Ecom] config resolved:', { llm: !!llm, vision: !!vision })
    return { llm, vision }
  } catch (e: any) {
    console.error('[Ecom] getUserLLMConfig error:', e.message)
    return fallback
  }
}

/** 按 provider 推算默认 baseUrl */
function resolveProviderBaseUrl(customUrl: string | null | undefined, provider: string | null | undefined): string | null {
  if (customUrl) return customUrl.replace(/\/+$/, '')
  const defaults: Record<string, string> = {
    deepseek: 'https://api.deepseek.com',
    volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
    aliyun: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    openai: 'https://api.openai.com/v1',
  }
  return defaults[provider || ''] || null
}

export default async function ecomImageRoutes(fastify: any) {
  // ─── 列表：用户的所有电商项目 ───
  fastify.get('/api/ecom/projects', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const projects = await prisma.ecomProject.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: projects }
  })

  // ─── 创建新项目 ───
  fastify.post('/api/ecom/projects', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id: userId } = request.user
    const { skuName, category, style, language, modelAttrs, modelScene, shootingStyle, faceVisible } = request.body as any
    const project = await prisma.ecomProject.create({
      data: {
        userId,
        skuName: skuName || '',
        category: category || '',
        style: style || '',
        language: language || '',
        modelAttrs: modelAttrs || '',
        modelScene: modelScene || '',
        shootingStyle: shootingStyle || '',
        faceVisible: faceVisible || 'show',
        status: 'draft',
      },
    })
    return { success: true, data: project }
  })

  // ─── 获取单项目 ───
  fastify.get('/api/ecom/projects/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { id: userId } = request.user
    const project = await prisma.ecomProject.findFirst({ where: { id, userId } })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    return { success: true, data: project }
  })

  // ─── 更新项目（保存字段 / 编辑 prompt 等） ───
  fastify.patch('/api/ecom/projects/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { id: userId } = request.user
    const existing = await prisma.ecomProject.findFirst({ where: { id, userId } })
    if (!existing) return reply.status(404).send({ success: false, error: '项目不存在' })

    const { skuName, category, style, language, modelAttrs, modelScene, shootingStyle, faceVisible, status, promptJson } = request.body as any
    const data: any = {}
    if (skuName !== undefined) data.skuName = skuName
    if (category !== undefined) data.category = category
    if (style !== undefined) data.style = style
    if (language !== undefined) data.language = language
    if (modelAttrs !== undefined) data.modelAttrs = modelAttrs
    if (modelScene !== undefined) data.modelScene = modelScene
    if (shootingStyle !== undefined) data.shootingStyle = shootingStyle
    if (faceVisible !== undefined) data.faceVisible = faceVisible
    if (status !== undefined) data.status = status
    if (promptJson !== undefined) data.promptJson = promptJson

    const updated = await prisma.ecomProject.update({ where: { id }, data })
    return { success: true, data: updated }
  })

  // ─── 删除项目 ───
  fastify.delete('/api/ecom/projects/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { id: userId } = request.user
    const existing = await prisma.ecomProject.findFirst({ where: { id, userId } })
    if (!existing) return reply.status(404).send({ success: false, error: '项目不存在' })
    await prisma.ecomProject.delete({ where: { id } })
    return { success: true, message: '删除成功' }
  })

  // ─── 上传产品图（保存到用户资产） ───
  fastify.post('/api/ecom/projects/:id/upload', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { id: userId } = request.user
    const { imageUrl } = request.body as any
    if (!imageUrl) return reply.status(400).send({ success: false, error: 'imageUrl 必填' })
    const asset = await prisma.userAsset.create({
      data: { userId, title: `电商图-${id}`, type: 'ecom', url: imageUrl, source: `ecom:${id}` },
    })
    return { success: true, data: asset }
  })

  // ─── 获取项目的产品图列表 ───
  fastify.get('/api/ecom/projects/:id/images', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { id: userId } = request.user
    const images = await prisma.userAsset.findMany({
      where: { userId, source: `ecom:${id}`, type: 'ecom' },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: images }
  })

  // ─── 保存生成图片到用户图库 ───
  fastify.post('/api/ecom/projects/:id/save-image', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { id: userId } = request.user
    const { url, title, prompt, thumbnail } = request.body as any
    if (!url) return reply.status(400).send({ success: false, error: 'url 必填' })
    const asset = await prisma.userAsset.create({
      data: {
        userId,
        title: title || `电商图-${id}`,
        type: 'ecom', url,
        thumbnail: thumbnail || url,
        prompt: prompt || '',
        source: `ecom:${id}`,
      },
    })
    return { success: true, data: asset }
  })

  // ─── 上传产品图片（multipart） ───
  fastify.post('/api/ecom/projects/:id/upload-image', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { id: userId } = request.user
    const project = await prisma.ecomProject.findFirst({ where: { id, userId } })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    try {
      const data = await request.file()
      if (!data) return reply.status(400).send({ success: false, error: '请选择文件' })
      const ext = data.filename?.split('.').pop()?.toLowerCase() || 'png'
      const allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif']
      if (!allowed.includes(ext)) return reply.status(400).send({ success: false, error: '不支持的文件格式' })
      const uploadDir = path.resolve(process.cwd(), 'public', 'uploads', 'ecom', userId, id)
      const fs = await import('fs')
      const thePath = await import('path')
      fs.mkdirSync(uploadDir, { recursive: true })
      const fileName = `product_${Date.now()}.${ext}`
      const filePath = thePath.join(uploadDir, fileName)
      const writeStream = fs.createWriteStream(filePath)
      await data.file.pipe(writeStream)
      const imageUrl = `/uploads/ecom/${userId}/${id}/${fileName}`
      await prisma.userAsset.create({
        data: { userId, title: `产品图-${project.skuName || id}`, type: 'ecom', url: imageUrl, thumbnail: imageUrl, source: `ecom:${id}` },
      })
      return { success: true, data: { url: imageUrl } }
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: `上传失败: ${err.message}` })
    }
  })

  // ─── ★ 核心：AI 分析产品（Stage1 + Stage2 + Stage3） ───
  fastify.post('/api/ecom/projects/:id/analyze', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { id: userId } = request.user

    const project = await prisma.ecomProject.findFirst({ where: { id, userId } })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })

    // 找到最近的产品图
    const latestAsset = await prisma.userAsset.findFirst({
      where: { userId, source: `ecom:${id}`, type: 'ecom' },
      orderBy: { createdAt: 'desc' },
    })
    const imageUrl = latestAsset?.url || ''
    if (!imageUrl) return reply.status(400).send({ success: false, error: '请先上传产品图' })

    // 更新状态为分析中
    await prisma.ecomProject.update({ where: { id }, data: { status: 'analyzing' } })

    // 图片实际存储在 backend/public/ 下，拼本地绝对路径
    const localImagePath = imageUrl.startsWith('/')
      ? path.resolve(process.cwd(), 'public', imageUrl.replace(/^\//, ''))
      : imageUrl
    try {
      // 获取用户自配的 LLM + Vision 配置
      const { llm, vision } = await getUserLLMConfig(userId)

      const result = await runAnalysis({
        imageUrl: localImagePath,
        category: project.category || '',
        style: project.style || '',
        language: project.language || '',
        modelAttrs: project.modelAttrs || '',
        modelScene: project.modelScene || '',
        shootingStyle: project.shootingStyle || '',
        faceVisible: project.faceVisible || 'show',
        skuName: project.skuName || '',
        llmConfig: llm || undefined,
        visionConfig: vision || undefined,
      })

      // 保存 promptJson 到项目，更新状态
      await prisma.ecomProject.update({
        where: { id },
        data: {
          status: 'prompts',
          promptJson: result as any,
        },
      })

      return { success: true, data: result }
    } catch (err: any) {
      await prisma.ecomProject.update({ where: { id }, data: { status: 'error' } })
      return reply.status(500).send({ success: false, error: `分析失败: ${err.message}` })
    }
  })

  // ─── ★ 核心：生成图片（基于 promptJson 调 images.edit API） ───
  fastify.post('/api/ecom/projects/:id/generate', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { id: userId } = request.user

    const project = await prisma.ecomProject.findFirst({ where: { id, userId } })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })
    if (!project.promptJson) return reply.status(400).send({ success: false, error: '请先完成产品分析' })

    // 找到产品图
    const latestAsset = await prisma.userAsset.findFirst({
      where: { userId, source: `ecom:${id}`, type: 'ecom' },
      orderBy: { createdAt: 'desc' },
    })
    const imageUrl = latestAsset?.url || ''
    if (!imageUrl) return reply.status(400).send({ success: false, error: '请先上传产品图' })

    // 更新状态
    await prisma.ecomProject.update({ where: { id }, data: { status: 'generating' } })

    try {
      // 获取用户自配的 LLM 配置
      const { llm, vision } = await getUserLLMConfig(userId)

      const result = await runGeneration({
        projectId: id,
        imageUrl: imageUrl.startsWith('/')
          ? path.resolve(process.cwd(), 'public', imageUrl.replace(/^\//, ''))
          : imageUrl,
        prompts: project.promptJson as any,
        category: project.category || '',
        language: project.language || '',
        modelAttrs: project.modelAttrs || '',
        modelScene: project.modelScene || '',
        shootingStyle: project.shootingStyle || '',
        faceVisible: project.faceVisible || 'show',
        llmConfig: llm || undefined,
        visionConfig: vision || undefined,
      })

      // 保存生成的图片到用户资产
      if (result.images?.length) {
        await prisma.userAsset.createMany({
          data: result.images.map((imgPath: string) => ({
            userId,
            title: `电商图-生成`,
            type: 'ecom',
            url: imgPath,
            thumbnail: imgPath,
            source: `ecom:${id}`,
          })),
        })
      }

      await prisma.ecomProject.update({ where: { id }, data: { status: 'done' } })

      return { success: true, data: result }
    } catch (err: any) {
      await prisma.ecomProject.update({ where: { id }, data: { status: 'error' } })
      return reply.status(500).send({ success: false, error: `生成失败: ${err.message}` })
    }
  })

  // ─── 获取生成图片列表（从生成目录读取） ───
  fastify.get('/api/ecom/projects/:id/generated-images', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const { id } = request.params as any
    const { id: userId } = request.user
    const project = await prisma.ecomProject.findFirst({ where: { id, userId } })
    if (!project) return reply.status(404).send({ success: false, error: '项目不存在' })

    // 从用户资产中按 source 查
    const images = await prisma.userAsset.findMany({
      where: { userId, source: `ecom:${id}`, type: 'ecom' },
      orderBy: { createdAt: 'desc' },
    })

    // 加上项目状态
    return {
      success: true,
      data: {
        images,
        status: project.status,
        promptJson: project.promptJson,
      },
    }
  })
}
