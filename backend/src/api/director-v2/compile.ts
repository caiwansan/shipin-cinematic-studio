/**
 * api/director-v2/compile.ts — Director V2 编译 API 路由
 *
 * Phase 0.4 — 后端 API 暴露（工作台可用关键）
 *
 * POST /api/director/compile-v2
 *
 * 输入: { shotGraph: any }
 * 处理: normalizeShot → toDirectorIR → compileCinematicPrompt
 * 输出: { success: true, data: { prompt, ir, trace } }
 *
 * 宪法:
 *   1. 不调 LLM — 纯 deterministic
 *   2. 不修改 legacy prompt endpoints
 *   3. 不碰 shot graph schema
 *   4. error 永远结构化返回，不抛原始异常
 *   5. latency < 50ms（无 LLM 调用）
 */

import { FastifyInstance } from 'fastify'
import { normalizeShot } from '../../director-v2/prompt/shot-normalizer.js'
import { toDirectorIR } from '../../director-v2/prompt/director-ir.js'
import { compileCinematicPrompt } from '../../director-v2/prompt/cinematic-compiler.js'
import { validateDirectorIR, inspectIREvolution, attachIRMeta } from '../../director-v2/prompt/ir-stability.js'
import { compileSceneTimeline } from '../../director-v2/timeline/scene-timeline.js'
import { compileStory } from '../../director-v2/story/story-compiler.js'
import { compileExecutionPlan } from '../../director-v2/execution/story-scheduler.js'
import type { StoryGraph } from '../../director-v2/story/scene-graph.js'

// ─── 类型 ─────────────────────────────────────────────────────

interface CompileV2Input {
  shotGraph: unknown
  options?: {
    includeTrace?: boolean
    structuredTags?: boolean
  }
}

interface CompileV2Output {
  prompt: string
  ir: import('../../director-v2/prompt/director-ir.js').DirectorIR
  timeline: import('../../director-v2/timeline/scene-timeline.js').SceneTimeline
  trace: import('../../director-v2/prompt/director-ir.js').IRTrace
  meta: {
    inputFingerprint: string
    normalizationSummary: {
      subjectCount: number
      hasCamera: boolean
      hasEnvironment: boolean
      hasAction: boolean
    }
    elapsedMs: number
    version: string
    irStability: import('../../director-v2/prompt/ir-stability.js').IRStabilityMeta
  }
}

interface ErrorStage {
  stage: 'normalize' | 'ir' | 'compile' | 'input'
  message: string
}

// ─── 输入指纹（纯确定性） ──────────────────────────────────

function computeFingerprint(input: unknown): string {
  try {
    const str = JSON.stringify(input)
    // 取前 64 字符作为轻量指纹（不依赖 crypto hash，保持低 latency）
    return str.slice(0, 64)
  } catch {
    return 'unhashable_input'
  }
}

// ─── 输入校验 ──────────────────────────────────────────────

function validateInput(body: unknown): CompileV2Input | ErrorStage {
  if (!body || typeof body !== 'object') {
    return { stage: 'input', message: '请求体必须为对象' }
  }

  const obj = body as Record<string, unknown>

  if (obj.shotGraph === undefined || obj.shotGraph === null) {
    return { stage: 'input', message: 'shotGraph 字段缺失' }
  }

  return {
    shotGraph: obj.shotGraph,
    options: (obj.options && typeof obj.options === 'object')
      ? obj.options as CompileV2Input['options']
      : undefined,
  }
}

// ─── 路由注册 ─────────────────────────────────────────────

export default async function directorV2Routes(fastify: FastifyInstance) {

  // POST /api/director/compile-v2 — 核心编译 API
  fastify.post('/api/director/compile-v2', async (request, reply) => {
    const start = Date.now()

    // 1. 输入校验
    const validated = validateInput(request.body)
    if ('stage' in validated) {
      return reply.status(400).send({
        success: false,
        error: validated,
      })
    }

    try {
      // 2. normalizeShot — 数据清洗
      let normalized: ReturnType<typeof normalizeShot>
      try {
        normalized = normalizeShot(validated.shotGraph)
      } catch (e: unknown) {
        return reply.status(422).send({
          success: false,
          error: {
            stage: 'normalize',
            message: e instanceof Error ? e.message : 'normalizeShot 异常',
          },
        })
      }

      // 3. toDirectorIR — 语义解释
      let ir: ReturnType<typeof toDirectorIR>
      try {
        ir = toDirectorIR(normalized)
      } catch (e: unknown) {
        return reply.status(422).send({
          success: false,
          error: {
            stage: 'ir',
            message: e instanceof Error ? e.message : 'toDirectorIR 异常',
          },
        })
      }

      // 4. IR 稳定性检测（Phase 0.45 — 纯观测，不修改 IR）
      const irValidation = validateDirectorIR(ir)
      const irEvolution = inspectIREvolution(ir)
      const irStability = attachIRMeta(irValidation, irEvolution)

      // 5. compileCinematicPrompt — 输出编译
      let prompt: string
      try {
        prompt = compileCinematicPrompt(ir)
      } catch (e: unknown) {
        return reply.status(422).send({
          success: false,
          error: {
            stage: 'compile',
            message: e instanceof Error ? e.message : 'compileCinematicPrompt 异常',
          },
        })
      }

      const elapsedMs = Date.now() - start

      // 7. SceneTimeline — 时间投影（Phase 1，独立顶层字段）
      const timeline = compileSceneTimeline(ir)

      // 8. 构建响应
      const output: CompileV2Output = {
        prompt,
        ir,
        timeline,
        trace: ir.trace,
        meta: {
          inputFingerprint: computeFingerprint(validated.shotGraph),
          normalizationSummary: {
            subjectCount: normalized.subject.length,
            hasCamera: !!normalized.camera && Object.keys(normalized.camera).length > 0,
            hasEnvironment: !!normalized.environment && Object.keys(normalized.environment).length > 0,
            hasAction: normalized.action.length > 0,
          },
          elapsedMs,
          version: 'director-v2.0',
          irStability,
        },
      }

      return reply.send({
        success: true,
        data: output,
      })

    } catch (e: unknown) {
      // 兜底异常保护
      return reply.status(500).send({
        success: false,
        error: {
          stage: 'unknown' as const,
          message: e instanceof Error ? e.message : '未知编译异常',
        },
      })
    }
  })

  // GET /api/director/health — 健康检查
  fastify.get('/api/director/health', async () => {
    return {
      success: true,
      data: {
        status: 'ok',
        modules: ['shot-normalizer', 'director-ir', 'cinematic-compiler', 'scene-timeline', 'story-compiler'],
        version: '2.0.0',
      },
    }
  })

  // POST /api/director/compile-story — 故事级编译（Phase 2）
  fastify.post('/api/director/compile-story', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown> | undefined
      if (!body || !body.storyGraph) {
        return reply.status(400).send({
          success: false,
          error: { stage: 'input', message: 'storyGraph 字段缺失' },
        })
      }

      const storyGraph = body.storyGraph as StoryGraph
      if (!Array.isArray(storyGraph.scenes) || storyGraph.scenes.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { stage: 'input', message: 'storyGraph.scenes 必须为非空数组' },
        })
      }

      const bundle = compileStory(storyGraph)
      const executionPlan = compileExecutionPlan(bundle)

      return reply.send({
        success: true,
        data: {
          ...bundle,
          executionPlan,
        },
      })
    } catch (e: unknown) {
      return reply.status(500).send({
        success: false,
        error: {
          stage: 'unknown',
          message: e instanceof Error ? e.message : '故事编译异常',
        },
      })
    }
  })
}
