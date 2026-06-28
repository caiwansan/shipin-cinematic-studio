import type { ApiResponse } from '../contracts/api/base.js';
/**
 * Director Intelligence Layer — API Routes
 *
 * 暴露导演智能层的核心能力：
 * - analyze — 导演理解分析
 * - shot-design — 镜头设计
 * - character-bible — 角色圣经
 * - atmosphere — 场景氛围
 * - rhythm — 节奏设计
 * - compile-prompt — Prompt 编译
 * - review — 审片
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { analyzeScript } from '../director/director-brain.agent.js'
import { generateShotDesign } from '../director/cinematic-shot.agent.js'
import { generateCharacterBible } from '../director/character-director.agent.js'
import { generateAtmosphereDesign } from '../director/scene-atmosphere.agent.js'
import { generateRhythmDesign } from '../director/story-rhythm.agent.js'
import { directorPromptCompiler } from '../director/prompt-compiler.js'
import { continuityEngine } from '../director/continuity.engine.js'
import { directorReviewEngine } from '../director/review.engine.js'

export default async function directorRoutes(fastify: FastifyInstance) {
  /**
   * 注入"故事宪法"到 directorUnderstanding
   * 确保下游 agent 在各自专业领域工作时，不脱离剧本主线需求
   */
  function enrichWithStoryConstitution(directorUnderstanding: any, designSpec?: any): any {
    if (!designSpec) return directorUnderstanding
    return {
      ...directorUnderstanding,
      _storyConstitution: {
        // 从 aigc-spec 10 表规格中提取关键约束
        characterSpecs: designSpec.characterSpecs || [],
        sceneSpecs: designSpec.sceneSpecs || [],
        visualSpecs: designSpec.visualSpecs || null,
        narrativeSpec: designSpec.narrativeSpec || null,
        emotionSpecs: designSpec.emotionSpecs || [],
        productionSpecs: designSpec.productionSpecs || null,
        rhythmSpec: designSpec.rhythmSpec || null,
        styleSpec: designSpec.styleSpec || null,
        transitionSpec: designSpec.transitionSpec || null,
        dialogSpec: designSpec.dialogSpec || null,
      },
    }
  }
  // ============================================================
  // POST /api/v1/director/analyze — 导演理解分析
  // ============================================================
  fastify.post('/api/v1/director/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    const { script, title } = request.body as any
    if (!script) {
      return reply.status(400).send({ success: false, error: '缺少剧本内容' })
    }

    const start = Date.now()
    const userId = (request.user as any)?.id || 'director-brain'
    const understanding = await analyzeScript(script, undefined, userId)
    const latency = Date.now() - start

    return {
      success: true,
      data: understanding,
      meta: { latency, textLength: script.length },
    }
  })

  // ============================================================
  // POST /api/v1/director/shot-design — 生成镜头设计方案
  // ============================================================
  fastify.post('/api/v1/director/shot-design', async (request: FastifyRequest, reply: FastifyReply) => {
    const { script, directorUnderstanding, designSpec } = request.body as any
    if (!script) {
      return reply.status(400).send({ success: false, error: '缺少剧本内容' })
    }

    const start = Date.now()
    const enriched = enrichWithStoryConstitution(directorUnderstanding || {}, designSpec)
    const shotDesign = await generateShotDesign(script, enriched)
    const latency = Date.now() - start

    return {
      success: true,
      data: shotDesign,
      meta: { latency },
    }
  })

  // ============================================================
  // POST /api/v1/director/character-bible — 生成角色圣经
  // ============================================================
  fastify.post('/api/v1/director/character-bible', async (request: FastifyRequest, reply: FastifyReply) => {
    const { script, directorUnderstanding, designSpec } = request.body as any
    if (!script) {
      return reply.status(400).send({ success: false, error: '缺少剧本内容' })
    }

    const start = Date.now()
    const enriched = enrichWithStoryConstitution(directorUnderstanding || {}, designSpec)
    const bible = await generateCharacterBible(script, enriched)
    const latency = Date.now() - start

    // 注册到 continuity engine
    continuityEngine.registerCharacterBible(bible)

    return {
      success: true,
      data: bible,
      meta: { latency },
    }
  })

  // ============================================================
  // POST /api/v1/director/atmosphere — 生成场景氛围设计
  // ============================================================
  fastify.post('/api/v1/director/atmosphere', async (request: FastifyRequest, reply: FastifyReply) => {
    const { script, directorUnderstanding, designSpec } = request.body as any
    if (!script) {
      return reply.status(400).send({ success: false, error: '缺少剧本内容' })
    }

    const start = Date.now()
    const enriched = enrichWithStoryConstitution(directorUnderstanding || {}, designSpec)
    const atmosphere = await generateAtmosphereDesign(script, enriched)
    const latency = Date.now() - start

    // 注册到 continuity engine
    continuityEngine.registerSceneAtmosphere(atmosphere)

    return {
      success: true,
      data: atmosphere,
      meta: { latency },
    }
  })

  // ============================================================
  // POST /api/v1/director/rhythm — 生成节奏方案
  // ============================================================
  fastify.post('/api/v1/director/rhythm', async (request: FastifyRequest, reply: FastifyReply) => {
    const { script, directorUnderstanding, designSpec } = request.body as any
    if (!script) {
      return reply.status(400).send({ success: false, error: '缺少剧本内容' })
    }

    const start = Date.now()
    const enriched = enrichWithStoryConstitution(directorUnderstanding || {}, designSpec)
    const rhythm = await generateRhythmDesign(script, enriched)
    const latency = Date.now() - start

    return {
      success: true,
      data: rhythm,
      meta: { latency },
    }
  })

  // ============================================================
  // POST /api/v1/director/compile-prompt — 编译 Prompt
  // ============================================================
  fastify.post('/api/v1/director/compile-prompt', async (request: FastifyRequest, reply: FastifyReply) => {
    const { shot, visualStyle, modelId } = request.body as any
    if (!shot) {
      return reply.status(400).send({ success: false, error: '缺少镜头描述' })
    }

    const compiled = directorPromptCompiler.compile(shot, visualStyle || {}, modelId || 'kling')

    return {
      success: true,
      data: compiled,
    }
  })

  // ============================================================
  // POST /api/v1/director/review — 审片
  // ============================================================
  fastify.post('/api/v1/director/review', async (request: FastifyRequest, reply: FastifyReply) => {
    const { shots, rhythmDesign, continuityInfo } = request.body as any
    if (!shots) {
      return reply.status(400).send({ success: false, error: '缺少镜头数据' })
    }

    const start = Date.now()
    const review = await directorReviewEngine.reviewShotPlan(
      shots,
      rhythmDesign || { beats: [], hooks: [] },
      continuityInfo || { warnings: [] },
    )
    const latency = Date.now() - start

    return {
      success: true,
      data: review,
      meta: { latency },
    }
  })

  // ============================================================
  // POST /api/v1/director/full-pipeline — 全流程一次调用(一站式)
  // ============================================================
  fastify.post('/api/v1/director/full-pipeline', async (request: FastifyRequest, reply: FastifyReply) => {
    const { script, title, modelId, designSpec } = request.body as any
    if (!script) {
      return reply.status(400).send({ success: false, error: '缺少剧本内容' })
    }

    const start = Date.now()

    // Step 1: 导演理解
    const userId = (request.user as any)?.id || 'director-brain'
    const understanding = await analyzeScript(script, 'full-pipeline', userId)

    // 注入故事宪法
    const enriched = enrichWithStoryConstitution(understanding, designSpec)

    // Step 2: 角色圣经
    const bible = await generateCharacterBible(script, enriched)
    continuityEngine.registerCharacterBible(bible)

    // Step 3: 场景氛围
    const atmosphere = await generateAtmosphereDesign(script, enriched)
    continuityEngine.registerSceneAtmosphere(atmosphere)

    // Step 4: 节奏设计
    const rhythm = await generateRhythmDesign(script, enriched)

    // Step 5: 镜头设计
    const shotDesign = await generateShotDesign(script, enriched)

    // Step 6: 编译 Prompt（每个镜头）
    const compiledShots = shotDesign.scenes.flatMap((scene: any) =>
      scene.shots.map((shot: any) => ({
        sceneId: scene.sceneId,
        sceneName: scene.sceneName,
        compiledPrompt: directorPromptCompiler.compile(shot, understanding.visualStyle, modelId || 'kling'),
      }))
    )

    // Step 7: 审片
    const allShots = shotDesign.scenes.flatMap((s: any) => s.shots)
    const review = await directorReviewEngine.reviewShotPlan(allShots, rhythm, continuityEngine.getStatus())

    const latency = Date.now() - start

    return {
      success: true,
      degraded: !understanding.theme || understanding.theme === '解析中',
      data: {
        directorUnderstanding: understanding,
        characterBible: bible,
        atmosphere,
        rhythmDesign: rhythm,
        shotDesign,
        compiledPrompts: compiledShots,
        review,
      },
      meta: { latency },
    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-v1",
  "mode": "LEGACY"
};

