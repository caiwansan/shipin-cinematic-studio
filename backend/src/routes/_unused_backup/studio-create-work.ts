/**
 * routes/studio-create-work.ts — AI Director 创作入口
 *
 * 用户从 Launcher 创建新作品的完整流程：
 * 1. 创建 Project + StudioCreationIntent + CreativeBrief
 * 2. 调用 deep-analyze 进行 AI 分析
 * 3. 生成 ProductionPlan
 *
 * POST /api/v1/studio/create-work — 一键创建 + AI 分析
 * GET  /api/v1/studio/production-plan/:projectId — 获取制作方案
 */

import type { ApiResponse } from '../contracts/api/base.js'
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { narrativeGateway } from '../runtime/narrative-gateway.js'

export default async function studioCreateWorkRoutes(fastify: FastifyInstance) {

  // =====================================================
  // POST /api/v1/studio/create-work
  // 创建项目 → AI 分析 → 生成制作方案
  // =====================================================
  fastify.post('/api/v1/studio/create-work', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const body = request.body as any
    const { projectType, title, creativeInput, genre, visualStyle, aspectRatio, targetDuration } = body

    // ── 验证 ──
    if (!projectType || !['SHORT_DRAMA', 'SHORT_VIDEO', 'AD', 'MV', 'MUSIC'].includes(projectType)) {
      return reply.status(400).send({ success: false, error: '无效的创作类型' })
    }
    if (!creativeInput || creativeInput.trim().length < 5) {
      return reply.status(400).send({ success: false, error: '请输入你的创作想法（至少5个字符）' })
    }

    try {
      // ── Step 1: 创建 Project + CreationIntent + CreativeBrief ──
      const projectTypeLabel: Record<string, string> = {
        SHORT_DRAMA: '短剧',
        SHORT_VIDEO: '短视频',
        AD: '广告片',
        MV: 'MV',
        MUSIC: '音乐'
      }

      const project = await prisma.project.create({
        data: {
          name: title || `我的${projectTypeLabel[projectType]}`,
          description: creativeInput.slice(0, 200),
          userId: user.id,
          ownerId: user.id,
          type: projectType === 'SHORT_DRAMA' ? 'video' : 'video',
          status: 'draft',
        }
      })

      // 记录创建意图
      await prisma.studioCreationIntent.create({
        data: {
          userId: user.id,
          projectType,
        }
      })

      // 构建领域扩展参数 (JSON)
      const creativeParams = buildCreativeParams(projectType, body)

      // 创建 CreativeBrief
      const brief = await prisma.creativeBrief.create({
        data: {
          projectId: project.id,
          userId: user.id,
          rawInput: creativeInput,
          genre: genre || null,
          style: visualStyle || null,
          duration: targetDuration ? String(targetDuration) : null,
          creativeParams: creativeParams as any,
        }
      })

      // ── Step 2: AI 分析（复用 NarrativeGateway + deep-analyze 逻辑）──
      const analysisResult = await analyzeCreative({
        creativeInput,
        title: project.name,
        genre: genre || inferGenre(projectType),
        visualStyle: visualStyle || 'realistic',
        aspectRatio: aspectRatio || '9:16',
        targetDuration: targetDuration || inferDuration(projectType),
        userId: user.id,
      })

      // 更新 CreativeBrief with AI results
      await prisma.creativeBrief.update({
        where: { id: brief.id },
        data: {
          aiSummary: analysisResult.summary,
          aiRawOutput: analysisResult.rawOutput as any,
          genre: analysisResult.genre || genre,
          duration: analysisResult.duration || (targetDuration ? String(targetDuration) : null),
          style: analysisResult.style || visualStyle,
        }
      })

      // ── Step 3: 生成 ProductionPlan ──
      const planData = buildProductionPlan(analysisResult, projectType, body)

      const productionPlan = await prisma.productionPlan.create({
        data: {
          projectId: project.id,
          briefId: brief.id,
          planData: planData as any,
          episodeCount: planData.episodeCount,
          sceneCount: planData.sceneCount,
          shotCount: planData.shotCount,
          estimatedCost: planData.estimatedCost,
          projectName: project.name,
          projectType,
        }
      })

      return {
        success: true,
        data: {
          projectId: project.id,
          projectName: project.name,
          projectType,
          briefId: brief.id,
          planId: productionPlan.id,
          plan: planData,
        }
      } satisfies ApiResponse<unknown>

    } catch (err: any) {
      console.error('[studio/create-work] 失败:', err.message)
      return reply.status(500).send({
        success: false,
        error: '创建失败，请重试',
      })
    }
  })

  // =====================================================
  // GET /api/v1/studio/production-plan/:projectId
  // =====================================================
  fastify.get<{ Params: { projectId: string } }>(
    '/api/v1/studio/production-plan/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any
      const { projectId } = request.params

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return reply.status(404).send({ error: '项目不存在' })
      if (project.userId !== user.id && project.ownerId !== user.id) {
        return reply.status(403).send({ error: '无权访问' })
      }

      const plan = await prisma.productionPlan.findUnique({
        where: { projectId },
        include: { brief: true }
      })

      if (!plan) return reply.status(404).send({ error: '制作方案不存在' })

      return { success: true, data: plan } satisfies ApiResponse<unknown>
    }
  )

  // =====================================================
  // GET /api/v1/studio/director-progress/:projectId
  // AI 导演制作进度（用户语言，非工程术语）
  // =====================================================
  fastify.get<{ Params: { projectId: string } }>(
    '/api/v1/studio/director-progress/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any
      const { projectId } = request.params

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return reply.status(404).send({ error: '项目不存在' })
      if (project.userId !== user.id && project.ownerId !== user.id) {
        return reply.status(403).send({ error: '无权访问' })
      }

      // 加载 PipelineStage
      const stages = await prisma.pipelineStage.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      })

      // 导演语言映射
      const directorStages = mapToDirectorLanguage(stages)

      // 计算总进度
      const totalStages = directorStages.length
      const completedStages = directorStages.filter(s => s.status === 'done').length
      const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0

      // 当前进行中的阶段
      const currentStage = directorStages.find(s => s.status === 'running' || s.status === 'active')

      // 下一步
      const nextStage = directorStages.find(s => s.status === 'pending')

      return {
        success: true,
        data: {
          projectId: project.id,
          projectName: project.name,
          progressPercent,
          completedStages,
          totalStages,
          currentStage: currentStage ? {
            label: currentStage.label,
            icon: currentStage.icon,
            status: currentStage.status,
          } : null,
          nextStage: nextStage ? {
            label: nextStage.label,
            icon: nextStage.icon,
          } : null,
          stages: directorStages,
        }
      } satisfies ApiResponse<unknown>
    }
  )

  // =====================================================
  // GET /api/v1/studio/cost-summary/:projectId
  // AI 制作成本中心 — 产品语言，非财务报表
  // =====================================================
  fastify.get<{ Params: { projectId: string } }>(
    '/api/v1/studio/cost-summary/:projectId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as any
      const { projectId } = request.params

      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) return reply.status(404).send({ error: '项目不存在' })
      if (project.userId !== user.id && project.ownerId !== user.id) {
        return reply.status(403).send({ error: '无权访问' })
      }

      const costSummary = await calculateProjectCost(projectId)

      return { success: true, data: costSummary } satisfies ApiResponse<unknown>
    }
  )

  // =====================================================
  // GET /api/v1/studio/my-works
  // 获取当前用户的所有作品列表
  // =====================================================
  fastify.get('/api/v1/studio/my-works', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        productionPlan: true,
        creativeBrief: true,
      }
    })

    return {
      success: true,
      data: projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        type: p.type,
        projectType: p.productionPlan?.projectType,
        episodeCount: p.productionPlan?.episodeCount,
        sceneCount: p.productionPlan?.sceneCount,
        shotCount: p.productionPlan?.shotCount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))
    } satisfies ApiResponse<unknown>
  })
}

// ═══════════════════════════════════════════════════════
// Helper: AI 分析创意（复用 NarrativeGateway 逻辑）
// ═══════════════════════════════════════════════════════

async function analyzeCreative(params: {
  creativeInput: string
  title: string
  genre: string
  visualStyle: string
  aspectRatio: string
  targetDuration: number
  userId: string
}): Promise<{
  summary: string
  genre?: string
  style?: string
  duration?: string
  rawOutput: any
}> {
  const { creativeInput, title, genre, visualStyle, aspectRatio, targetDuration, userId } = params

  // 构建分析 prompt（与 deep-analyze 一致，从 DB 读取；SSOT Phase 4：缺失即抛错，无 fallback）
  const aigcPrompt = await getDbPromptSafe('aigc-prompt')
  const specPrompt = `${aigcPrompt}\n\n` +
    `故事标题: ${title}\n` +
    `故事体裁: ${genre}\n` +
    `视觉风格: ${visualStyle}\n` +
    `画面比例: ${aspectRatio}\n` +
    `目标时长: ${targetDuration} 秒\n\n` +
    `创意内容:\n${creativeInput.slice(0, 8000)}`

  const gatewayResponse = await narrativeGateway.execute({
    systemPrompt: aigcPrompt,
    userMessage: specPrompt,
    userId,
    maxTokens: 8192,
    temperature: 0.1,
    timeoutTier: 'long',
  })

  // 解析 LLM 输出
  let rawOutput: any = null
  try {
    const jsonMatch = gatewayResponse.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) ||
      [null, gatewayResponse.content]
    const jsonStr = jsonMatch[1].trim()
    rawOutput = JSON.parse(jsonStr)
  } catch {
    // JSON 解析失败，使用原始文本
    rawOutput = { rawContent: gatewayResponse.content }
  }

  return {
    summary: creativeInput.slice(0, 100) + '...',
    genre,
    style: visualStyle,
    duration: `${targetDuration}s`,
    rawOutput,
  }
}

// ═══════════════════════════════════════════════════════
// Helper: 构建 ProductionPlan
// ═══════════════════════════════════════════════════════

function buildProductionPlan(analysisResult: any, projectType: string, body?: any) {
  const raw = analysisResult.rawOutput || {}

  // ── 按领域区分 ProductionPlan 字段 ──
  const isDrama = ['SHORT_DRAMA', 'SHORT_VIDEO'].includes(projectType)
  const isAd = projectType === 'AD'
  const isMusic = ['MUSIC', 'MV'].includes(projectType)

  // 从 LLM 输出中提取，或使用领域默认值
  const episodeCount = isDrama
    ? (raw.episodeCount || raw.episodes || inferEpisodes(projectType))
    : (isAd ? 1 : undefined)
  const sceneCount = raw.sceneCount || raw.scenes || (isDrama ? episodeCount! * 3 : 5)
  const shotCount = raw.shotCount || raw.shots || (sceneCount * 4)
  const totalTime = raw.totalTime || raw.duration || (isAd ? 30 : isMusic ? 180 : undefined)
  const estimatedCost = raw.estimatedCost || raw.cost || (shotCount * 0.5)

  // ── 按领域构建不同的 workflow ──
  const workflow = buildWorkflowForProject(projectType)

  // ── 构建 ProductionPlan —— 按领域区分字段 ──
  const plan: Record<string, unknown> = {
    shotCount,
    estimatedCost,
    workflow,
    characters: isDrama ? (raw.characters || raw.characterList || []) : [],
    scenes: raw.scenes || raw.sceneList || [],
    shots: isAd ? (raw.shots || raw.shotList || []) : [],
    rawContent: raw.rawContent || null,
  }

  // 短剧专属：episode/scene
  if (isDrama) {
    plan.episodeCount = episodeCount
    plan.sceneCount = sceneCount
  }

  // 广告专属：totalTime
  if (isAd || isMusic) {
    plan.totalTime = totalTime
  }

  // 音乐专属：lyrics + audioUrl + bpm + mood (v0.1 占位)
  if (isMusic) {
    plan.lyrics = raw.lyrics || ''
    plan.audioUrl = raw.audioUrl || null
    plan.bpm = raw.bpm || (body as any)?.bpm || null
    plan.mood = raw.mood || (body as any)?.mood || null
  }

  return plan
}

/** 根据 projectType 生成不同的 workflow 阶段 */
function buildWorkflowForProject(projectType: string): Array<{ id: string; label: string; status: string }> {
  switch (projectType) {
    case 'AD':
      return [
        { id: 'storyboard', label: '🎬 分镜脚本', status: 'done' },
        { id: 'video', label: '🎥 视频合成', status: 'pending' },
      ]
    case 'MUSIC':
    case 'MV':
      return [
        { id: 'music', label: '🎵 音乐创作', status: 'pending' },
      ]
    case 'SHORT_DRAMA':
    case 'SHORT_VIDEO':
    default:
      return [
        { id: 'script', label: '📝 剧本拆解', status: 'done' },
        { id: 'character', label: '🎭 角色设计', status: 'done' },
        { id: 'scene', label: '🏙 场景设计', status: 'done' },
        { id: 'storyboard', label: '🎬 分镜导演', status: 'pending' },
        { id: 'video', label: '🎥 视频合成', status: 'pending' },
      ]
  }
}

// ═══════════════════════════════════════════════════════
// Helper: PipelineStage → Director Language 映射
// ═══════════════════════════════════════════════════════

interface DirectorStage {
  stageKey: string
  label: string
  icon: string
  status: 'done' | 'running' | 'pending' | 'error' | 'blocked'
  order: number
}

const STAGE_DIRECTOR_MAP: Record<string, { label: string; icon: string; order: number }> = {
  'script-analysis':  { label: '故事分析',   icon: '📝', order: 1 },
  'character':        { label: '角色设计',   icon: '🎭', order: 2 },
  'scene':            { label: '场景设计',   icon: '🏙',  order: 3 },
  'props-design':     { label: '道具设计',   icon: '🎨', order: 4 },
  'storyboard':       { label: '分镜导演',   icon: '🎬', order: 5 },
  'voice':            { label: '语音设计',   icon: '🔊', order: 6 },
  'dubbing-render':   { label: '配音制作',   icon: '🎙', order: 7 },
  'video-generation': { label: '视频合成',   icon: '🎥', order: 8 },
  'music-generation': { label: '音乐制作',   icon: '🎵', order: 9 },
  'final-render':     { label: '最终渲染',   icon: '🎬', order: 10 },
}

function mapToDirectorLanguage(stages: any[]): DirectorStage[] {
  // 获取所有已存在的 stage keys
  const existingKeys = new Set(stages.map(s => s.stageKey))

  // 如果有 stage 数据，按实际存在的数据映射
  if (existingKeys.size > 0) {
    return stages.map(s => {
      const mapping = STAGE_DIRECTOR_MAP[s.stageKey] || {
        label: s.stageKey,
        icon: '⚙️',
        order: 99,
      }
      return {
        stageKey: s.stageKey,
        label: mapping.label,
        icon: mapping.icon,
        status: s.status,
        order: mapping.order,
      }
    }).sort((a, b) => a.order - b.order)
  }

  // 如果没有 stage 数据，显示默认的导演流程
  return Object.entries(STAGE_DIRECTOR_MAP)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, val]) => ({
      stageKey: key,
      label: val.label,
      icon: val.icon,
      status: 'pending' as const,
      order: val.order,
    }))
}

// ═══════════════════════════════════════════════════════
// Helper: AI Production Cost Calculator
// ═══════════════════════════════════════════════════════

/** USD → CNY 汇率（简化处理，未来可接实时汇率 API） */
const USD_TO_CNY = 7.25

interface CostBreakdown {
  type: string
  label: string
  icon: string
  count: number
  unitCostUsd: number
  totalCostUsd: number
  totalCostCny: number
}

interface CostSummary {
  projectId: string
  projectName: string
  currency: string
  totalCostUsd: number
  totalCostCny: number
  breakdown: CostBreakdown[]
  budgetLimit: number | null
  budgetUsedPercent: number | null
  estimateRemainingCny: number
  shotCount: number
}

async function calculateProjectCost(projectId: string): Promise<CostSummary> {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('项目不存在')

  // ── 获取真实产量 ──
  // 图片资产数量
  const imageAssets = await prisma.asset.count({
    where: { projectId, mimeType: { startsWith: 'image/' } },
  })
  // 视频任务数量
  const videoTasks = await prisma.videoTask.count({ where: { projectId } })
  // Pipeline stages 完成数（每个阶段至少一次 LLM 调用）
  const completedStages = await prisma.pipelineStage.count({
    where: { projectId, status: 'done' },
  })

  // ── 获取 AiModel 真实定价 ──
  const imageModels = await prisma.aiModel.findMany({ where: { modelType: 'image', status: 'active' } })
  const videoModels = await prisma.aiModel.findMany({ where: { modelType: 'video', status: 'active' } })
  const llmModels = await prisma.aiModel.findMany({ where: { modelType: 'llm', status: 'active' } })

  const avgImageCost = imageModels.length > 0
    ? imageModels.reduce((s, m) => s + (m.costPerRequest || 0), 0) / imageModels.length
    : 0.01 // fallback
  const avgVideoCost = videoModels.length > 0
    ? videoModels.reduce((s, m) => s + (m.costPerRequest || 0), 0) / videoModels.length
    : 0.05 // fallback
  const avgLlmCost = llmModels.length > 0
    ? llmModels.reduce((s, m) => s + (m.costPerRequest || 0), 0) / llmModels.length
    : 0.005 // fallback

  // ── 计算成本 ──
  const breakdown: CostBreakdown[] = []

  if (imageAssets > 0) {
    const totalUsd = imageAssets * avgImageCost
    breakdown.push({
      type: 'image',
      label: '图片生成',
      icon: '🖼',
      count: imageAssets,
      unitCostUsd: avgImageCost,
      totalCostUsd: totalUsd,
      totalCostCny: totalUsd * USD_TO_CNY,
    })
  }

  if (videoTasks > 0) {
    const totalUsd = videoTasks * avgVideoCost
    breakdown.push({
      type: 'video',
      label: '视频生成',
      icon: '🎥',
      count: videoTasks,
      unitCostUsd: avgVideoCost,
      totalCostUsd: totalUsd,
      totalCostCny: totalUsd * USD_TO_CNY,
    })
  }

  if (completedStages > 0) {
    const totalUsd = completedStages * avgLlmCost
    breakdown.push({
      type: 'llm',
      label: 'AI 分析',
      icon: '🧠',
      count: completedStages,
      unitCostUsd: avgLlmCost,
      totalCostUsd: totalUsd,
      totalCostCny: totalUsd * USD_TO_CNY,
    })
  }

  // 如果没有生产数据，显示零
  if (breakdown.length === 0) {
    breakdown.push({
      type: 'none',
      label: '暂无生产记录',
      icon: '○',
      count: 0,
      unitCostUsd: 0,
      totalCostUsd: 0,
      totalCostCny: 0,
    })
  }

  const totalCostUsd = breakdown.reduce((s, b) => s + b.totalCostUsd, 0)
  const totalCostCny = totalCostUsd * USD_TO_CNY

  // 预算计算
  const budgetLimit = project.budgetLimit as number | null
  const budgetUsedPercent = budgetLimit && budgetLimit > 0
    ? Math.round((totalCostCny / budgetLimit) * 100)
    : null

  // 预估剩余成本（基于 ProductionPlan 的 shotCount）
  const productionPlan = await prisma.productionPlan.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })
  const shotCount = productionPlan?.shotCount || 0
  const estimatedTotalCny = shotCount > 0
    ? shotCount * avgImageCost * USD_TO_CNY
    : totalCostCny
  const estimateRemainingCny = Math.max(0, estimatedTotalCny - totalCostCny)

  return {
    projectId: project.id,
    projectName: project.name,
    currency: 'CNY',
    totalCostUsd: Math.round(totalCostUsd * 100) / 100,
    totalCostCny: Math.round(totalCostCny * 100) / 100,
    breakdown,
    budgetLimit,
    budgetUsedPercent,
    estimateRemainingCny: Math.round(estimateRemainingCny * 100) / 100,
    shotCount,
  }
}

// ── 推断默认值 ──
function buildCreativeParams(projectType: string, body: any): Record<string, unknown> | null {
  const params: Record<string, unknown> = {}
  switch (projectType) {
    case 'MUSIC':
    case 'MV':
      if (body.mood) params.mood = body.mood
      if (body.bpm) params.bpm = body.bpm
      if (body.instruments) params.instruments = body.instruments
      break
    case 'AD':
      if (body.aspectRatio) params.aspectRatio = body.aspectRatio
      if (body.shotCount) params.shotCount = body.shotCount
      break
    case 'SHORT_DRAMA':
    case 'SHORT_VIDEO':
      if (body.episodeCount) params.episodeCount = body.episodeCount
      if (body.sceneCount) params.sceneCount = body.sceneCount
      break
  }
  return Object.keys(params).length > 0 ? params : null
}

function inferGenre(projectType: string): string {
  const map: Record<string, string> = {
    SHORT_DRAMA: '都市情感',
    SHORT_VIDEO: '生活记录',
    AD: '品牌营销',
    MV: '音乐视觉',
    MUSIC: '音乐创作',
  }
  return map[projectType] || '通用'
}

function inferDuration(projectType: string): number {
  const map: Record<string, number> = {
    SHORT_DRAMA: 180,
    SHORT_VIDEO: 60,
    AD: 30,
    MV: 240,
    MUSIC: 180,
  }
  return map[projectType] || 60
}

function inferEpisodes(projectType: string): number {
  const map: Record<string, number> = {
    SHORT_DRAMA: 10,
    SHORT_VIDEO: 1,
    AD: 1,
    MV: 1,
  }
  return map[projectType] || 1
}

async function getDbPromptSafe(name: string): Promise<string> {
  // ⭐ SSOT（Phase 4）: 禁止 fallback 随机 prompt。DB 缺失必须抛错，迫使 seed 补齐。
  const dbTemplate = await prisma.promptTemplate.findUnique({ where: { name } })
  if (dbTemplate?.content && typeof dbTemplate.content === 'object' && 'prompt' in (dbTemplate.content as any)) {
    return (dbTemplate.content as any).prompt as string
  }
  throw new Error(`[StudioCreateWork] PromptTemplate.${name} 在数据库中不存在或内容为空`)
}
