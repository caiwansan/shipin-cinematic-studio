import type { ApiResponse } from '../contracts/api/base.js';
/**
 * 短视频创作 — Quick Creation API
 * 独立路由文件，避免与 narrative-llm 的路由注册冲突
 */

import { FastifyInstance } from 'fastify'
import { executionCutover } from '../core/control-plane/cutover/execution-cutover.js'
import { Capability } from '../core/runtime/capabilities.js'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const QUICK_PROMPTS: Record<string, string> = {
  characters: `你是一个专业的角色设计师。根据以下故事/文案，提取所有需要出镜的角色信息。
返回 JSON 格式（不要代码块标记）：
{
  "characters": [
    { "name": "角色名", "description": "外貌、服装、气质等详细特征描述（50-100字）" }
  ]
}`,
  scenes: `你是一个专业的场景设计师。根据以下故事/文案，提取所有需要的场景信息。
返回 JSON 格式（不要代码块标记）：
{
  "scenes": [
    { "description": "场景详细描述，包括环境、光线、氛围（30-50字）" }
  ]
}`,
  voice: `你是一个专业的配音导演。根据以下故事/文案，推荐配音风格。
返回 JSON 格式（不要代码块标记）：
{
  "voice": { "voice": "推荐音色（女声/男声/旁白/童声等）", "speed": "语速（正常/慢速/快速）", "text": "配音文本（取故事前200字或核心台词）" }
}`,
  videoPrompt: `你是一个顶级的视频提示词导演。根据以下故事、角色和场景信息，为每段剧情生成10秒逐秒时间轴描述。
返回纯 JSON 数组（不要代码块标记，不要 markdown）：
[
  {
    "segIndex": 0,
    "verse": ["0s画面描述: 含角色动作、表情","1s画面描述",...,"9s画面描述"],
    "fx": ["0s音效/对白","1s音效/对白",...,"9s音效/对白"],
    "camera": ["0s运镜","1s运镜",...,"9s运镜"]
  }
]

规则：
- 故事有多少段就生成多少段，segIndex 从0开始递增
- 每段正好10个元素（0-9秒）
- 画面描述20-40字，含角色动作和表情
- 音效：环境音/对白/特效音
- 运镜：固定/推/拉/摇/移/跟/手持/甩镜/特写推入/淡出等`,
}

export default async function quickCreationRoutes(app: FastifyInstance) {
  // 全量分析（角色+场景+配音一次生成）
  app.post('/api/narrative/quick-analyze', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { story } = request.body as any
    if (!story) return reply.status(400).send({ success: false, error: '缺少 story' })
    const user = request.user as any
    const results: any = { characters: [], scenes: [], voice: null }

    const [charRes, sceneRes, voiceRes] = await Promise.allSettled([
      executionCutover.execute({ capability: Capability.SCRIPT_ANALYSIS, userId: user.id, payload: { systemPrompt: QUICK_PROMPTS.characters, userMessage: `故事：\n${story.slice(0, 1000)}`, maxTokens: 2048 } }),
      executionCutover.execute({ capability: Capability.SCRIPT_ANALYSIS, userId: user.id, payload: { systemPrompt: QUICK_PROMPTS.scenes, userMessage: `故事：\n${story.slice(0, 1000)}`, maxTokens: 2048 } }),
      executionCutover.execute({ capability: Capability.SCRIPT_ANALYSIS, userId: user.id, payload: { systemPrompt: QUICK_PROMPTS.voice, userMessage: `故事：\n${story.slice(0, 1000)}`, maxTokens: 1024 } }),
    ])

    // 日志：记录每个 LLM 调用结果
    console.log(`[QuickCreation] user=${user.id} char=${charRes.status} scene=${sceneRes.status} voice=${voiceRes.status}`)
    if (charRes.status === 'rejected') console.warn(`[QuickCreation] char error:`, (charRes as any).reason?.message || (charRes as any).reason)
    if (sceneRes.status === 'rejected') console.warn(`[QuickCreation] scene error:`, (sceneRes as any).reason?.message || (sceneRes as any).reason)
    if (voiceRes.status === 'rejected') console.warn(`[QuickCreation] voice error:`, (voiceRes as any).reason?.message || (voiceRes as any).reason)

    if (charRes.status === 'fulfilled') {
      try { const d = JSON.parse(charRes.value.content); if (d.characters) results.characters = d.characters } catch {}
    }
    if (sceneRes.status === 'fulfilled') {
      try { const d = JSON.parse(sceneRes.value.content); if (d.scenes) results.scenes = d.scenes } catch {}
    }
    if (voiceRes.status === 'fulfilled') {
      try { const d = JSON.parse(voiceRes.value.content); if (d.voice) results.voice = d.voice } catch {}
    }

    return { success: true, data: results } satisfies ApiResponse<unknown>;

  })

  // 单独角色优化
  app.post('/api/narrative/quick-characters', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { story } = request.body as any
    if (!story) return reply.status(400).send({ success: false, error: '缺少 story' })
    const user = request.user as any
    const result = await executionCutover.execute({ capability: Capability.SCRIPT_ANALYSIS, userId: user.id, payload: { systemPrompt: QUICK_PROMPTS.characters, userMessage: `故事：\n${story.slice(0, 1000)}`, maxTokens: 2048 } })
    try { return { success: true, data: JSON.parse(result.content) } } catch { return { success: true, data: { characters: [] } } }
  })

  // 单独场景优化
  app.post('/api/narrative/quick-scenes', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { story } = request.body as any
    if (!story) return reply.status(400).send({ success: false, error: '缺少 story' })
    const user = request.user as any
    const result = await executionCutover.execute({ capability: Capability.SCRIPT_ANALYSIS, userId: user.id, payload: { systemPrompt: QUICK_PROMPTS.scenes, userMessage: `故事：\n${story.slice(0, 1000)}`, maxTokens: 2048 } })
    try { return { success: true, data: JSON.parse(result.content) } } catch { return { success: true, data: { scenes: [] } } }
  })

  // 单独配音优化
  app.post('/api/narrative/quick-voice', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { story } = request.body as any
    if (!story) return reply.status(400).send({ success: false, error: '缺少 story' })
    const user = request.user as any
    const result = await executionCutover.execute({ capability: Capability.SCRIPT_ANALYSIS, userId: user.id, payload: { systemPrompt: QUICK_PROMPTS.voice, userMessage: `故事：\n${story.slice(0, 1000)}`, maxTokens: 1024 } })
    try { return { success: true, data: JSON.parse(result.content) } } catch { return { success: true, data: { voice: null } } }
  })

  // 单独视频提示词优化
  app.post('/api/narrative/quick-video-prompt', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { story, characters, scenes } = request.body as any
    if (!story) return reply.status(400).send({ success: false, error: '缺少 story' })
    const user = request.user as any
    const context = `故事：\n${story.slice(0, 1000)}\n\n角色：${JSON.stringify(characters || [])}\n\n场景：${JSON.stringify(scenes || [])}`
    const result = await executionCutover.execute({ capability: Capability.CINEMATIC_PROMPT, userId: user.id, payload: { systemPrompt: QUICK_PROMPTS.videoPrompt, userMessage: context, maxTokens: 4096 } })
    try { return { success: true, data: JSON.parse(result.content) } } catch { return { success: true, data: { prompt: result.content } } }
  })

  // ─── 保存项目快照 ───
  app.post('/api/narrative/quick-save', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId, snapshot } = request.body as any
    if (!projectId) return reply.status(400).send({ success: false, error: '缺少 projectId' })

    // upsert project + 写入 executionResults
    await prisma.project.upsert({
      where: { id: projectId },
      update: { executionResults: snapshot, name: snapshot?.storyText?.slice(0, 80) || '短视频创作' },
      create: { id: projectId, userId: user.id, name: snapshot?.storyText?.slice(0, 80) || '短视频创作', executionResults: snapshot },
    })

    return { success: true } satisfies ApiResponse<unknown>;

  })

  // ─── 加载项目快照 ───
  app.get('/api/narrative/quick-load', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const { projectId } = request.query as any
    if (!projectId) return reply.status(400).send({ success: false, error: '缺少 projectId' })

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return { success: true, data: null }

    return { success: true, data: project.executionResults } satisfies ApiResponse<unknown>;

  })

  // ─── 列出用户所有项目 ───
  app.get('/api/narrative/quick-projects', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as any
    let projects = await prisma.project.findMany({
      where: { userId: user.id, executionResults: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, name: true, updatedAt: true, createdAt: true, executionResults: true },
    })

    // 过滤：只返回 quick-creation 类型（id 含 00000000- 前缀或 executionResults 含 quickCreation 字段）
    projects = projects.filter(p =>
      p.id.startsWith('00000000-') || (p.executionResults as any)?.quickCreation
    )

    // 提取摘要
    const list = projects.map(p => {
      const data = p.executionResults as any
      return {
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt,
        summary: data?.storyText?.slice(0, 60) || p.name,
        hasCharImages: (data?.characters || []).some((c: any) => c.imgUrl),
        hasSceneImages: (data?.scenes || []).some((s: any) => s.imgUrl),
        hasVideo: !!data?.videoResult?.url,
      }
    })

    return { success: true, data: list } satisfies ApiResponse<unknown>;

  })
}
