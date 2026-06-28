/**
 * 混沌珠 — 项目 CRUD
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../../utils/index.js'
import { hdzCreateProjectSchema, hdzUpdateProjectSchema, validateOrReject } from '../../schemas/hdz.js'

export default async function hdzProjectRoutes(app: FastifyInstance) {
  // 用户身份验证装饰器
  app.addHook('preHandler', app.authenticate)

  // GET /api/hdz/projects — 获取用户的小说项目列表
  app.get('/api/hdz/projects', async (request) => {
    const user = request.user as any
    const projects = await prisma.hdzProject.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        genre: true,
        authorNickname: true,
        coverImgUrl: true,
        isPublished: true,
        wordTarget: true,
        chapterWordTarget: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { chapters: true, characters: true },
        },
      },
    })
    return { success: true, data: projects }
  })

  // POST /api/hdz/projects — 新建项目
  app.post('/api/hdz/projects', async (request, reply) => {
    const user = request.user as any
    const body = validateOrReject(request.body, hdzCreateProjectSchema, reply)
    if (!body) return
    const project = await prisma.hdzProject.create({
      data: {
        userId: user.id,
        title: body.title,
        genre: body.genre || null,
        wordTarget: body.wordTarget ?? null,
        chapterWordTarget: body.chapterWordTarget ?? null,
        styleDesc: body.styleDesc || null,
      },
    })
    return { success: true, data: project }
  })

  // GET /api/hdz/projects/:id — 获取项目详情
  app.get('/api/hdz/projects/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any

    // ⭐ 先鉴权：最小查询，拒绝未授权请求时不泄露任何业务数据
    const ownership = await prisma.hdzProject.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!ownership || ownership.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 鉴权通过后，查询完整详情
    const project = await prisma.hdzProject.findUnique({
      where: { id },
      include: {
        characters: { select: { id: true, name: true, role: true, properties: true, relations: true } },
        styleDna: true,
        _count: { select: { chapters: true, characters: true, memories: true } },
      },
    })
    // 分开查 chapters，避免 Prisma include 的 content 字段有时不返回的 bug
    const chaptersRaw = await prisma.$queryRawUnsafe<any[]>(
      `SELECT row_to_json(t.*)::text AS j FROM (
        SELECT id::text, "projectId"::text, "chapterNo", title, status, outline, content, "wordCount", summary, "reviewNotes"::text, "createdAt", "updatedAt"
        FROM hdz_chapters WHERE "projectId" = $1::uuid ORDER BY "chapterNo" ASC
      ) t`,
      id
    )
    const chapters = Array.isArray(chaptersRaw) ? chaptersRaw.map((r: any) => {
      try { return r?.j ? JSON.parse(r.j) : r } catch { return r }
    }) : []
    console.log(`[HDZ] project ${id}: ${chapters.length} chapters loaded (via row_to_json)`)
    return { success: true, data: { ...project, chapters } }
  })

  // PUT /api/hdz/projects/:id — 更新项目
  app.put('/api/hdz/projects/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const body = validateOrReject(request.body, hdzUpdateProjectSchema, reply)
    if (!body) return
    const project = await prisma.hdzProject.findUnique({ where: { id } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }
    const updated = await prisma.hdzProject.update({
      where: { id },
      data: {
        title: body.title ?? undefined,
        genre: body.genre ?? undefined,
        wordTarget: body.wordTarget ?? undefined,
        chapterWordTarget: body.chapterWordTarget ?? undefined,
        styleDesc: body.styleDesc ?? undefined,
        status: body.status ?? undefined,
        authorNickname: body.authorNickname ?? undefined,
        coverPrompt: body.coverPrompt ?? undefined,
        coverImgUrl: body.coverImgUrl ?? undefined,
        masterStyle: body.masterStyle ?? undefined,
      },
    })
    return { success: true, data: updated }
  })

  // DELETE /api/hdz/projects/:id — 删除项目（级联删除所有关联数据）
  app.delete('/api/hdz/projects/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as any
    const project = await prisma.hdzProject.findUnique({ where: { id } })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }
    await prisma.hdzProject.delete({ where: { id } })
    return { success: true }
  })

  // POST /api/hdz/generate-cover — 封面 Agent
  app.post('/api/hdz/generate-cover', async (request, reply) => {
    const user = request.user as any
    const { projectId, authorNickname } = request.body as any
    if (!projectId) {
      return reply.status(400).send({ success: false, error: '缺少 projectId' })
    }

    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, genre: true, styleDesc: true, coverPrompt: true, userId: true },
    })
    if (!project || project.userId !== user.id) {
      return reply.status(404).send({ success: false, error: '项目不存在' })
    }

    // 1. 用 LLM 生成封面 prompt
    const bookInfo = `书名：${project.title}${authorNickname ? `\n作者：${authorNickname}` : ''}${project.genre ? `\n类型：${project.genre}` : ''}${project.styleDesc ? `\n简介：${project.styleDesc}` : ''}`

    const systemPrompt = '你是一位专业的小说封面设计师。根据提供的书名、作者、类型和简介，生成一条用于 AI 图片模型（如 Midjourney/通义万相/种子月）的封面图提示词。\n\n要求：\n- 封面为小说风格，竖版比例 9:16\n- 包含核心视觉元素：人物/场景/氛围光效等\n- 描述画面构图、色调、风格（如"东方玄幻水彩风格"、"赛博朋克暗黑风格"等）\n- 保留标题文字的大致位置（居中或偏上/偏下）\n- 提示词用英文，简洁有力，不超过 200 字符\n- 仅输出提示词本身，不要任何解释'

    const { deepseekChat } = await import('../../services/hdz/llm.client.js')
    const coverPrompt = await deepseekChat(user.id, systemPrompt, bookInfo)

    // 2. 更新项目中的 coverPrompt 和 authorNickname
    await prisma.hdzProject.update({
      where: { id: projectId },
      data: { coverPrompt, authorNickname: authorNickname || undefined },
    })

    // 3. 调用平台图片模型生成封面
    let coverImgUrl = null
    try {
      const { apiRouter } = await import('../../services/api-router.service.js')
      const provider = await apiRouter.selectProvider(user.id, 'image', true)

      if (provider) {
        // 从 DB 直接读取用户图片模型配置
        const v2 = await prisma.userModelConfigV2.findUnique({ where: { userId: user.id } })
        const apiKey = v2?.imageApiKey ? (await import('../../services/crypto.service.js').then(m => m.decryptKey(v2!.imageApiKey!))) : ''
        const baseUrl = v2?.imageBaseUrl || v2?.baseUrl || provider.baseUrl || ''
        const modelName = provider.modelName || v2?.imageModel || 'wanx2.1-t2i-turbo'

        if (!apiKey) {
          return { success: true, data: { coverPrompt, coverImgUrl: null, message: '封面提示词已生成，但未配置图片 API Key。请先在模型配置中设置图片模型。' } }
        }

        const runtimePayload = {
          provider: provider.provider,
          model: modelName,
          userId: user.id,
          apiKey,
          baseURL: baseUrl,
          metadata: { baseUrlMap: {} },
        } as any

        const { modelAdapterRegistry } = await import('../../model-adapters/index.js')
        const imageResult = await modelAdapterRegistry.execute(runtimePayload as any, runtimePayload.model, {
          model: runtimePayload.model,
          prompt: coverPrompt,
          ratio: '9:16',
          n: 1,
          apiKey,
          baseUrl,
          perCapabilityBaseUrl: {},
        })

        let coverImgUrl = ''
        if (imageResult && typeof imageResult === 'object') {
          const ir = imageResult as any
          if (ir.images?.[0]?.url) coverImgUrl = ir.images[0].url
          else if (ir.url) coverImgUrl = ir.url
        }

        if (coverImgUrl) {
          try {
            const { cosService } = await import('../../services/cos-service.js')
            const cosResult = await cosService.uploadFile(coverImgUrl, 'image', user.id)
            coverImgUrl = cosResult.cosUrl
          } catch (_) {}
        }

        await prisma.hdzProject.update({
          where: { id: projectId },
          data: { coverImgUrl },
        })
      }
    } catch (e) {}

    return { success: true, data: { coverPrompt, coverImgUrl, message: coverImgUrl ? '封面已生成' : '封面提示词已生成，图片生成需检查模型配置' } }
  })
}