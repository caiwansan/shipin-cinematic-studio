/**
 * optimize-video-agent.ts — Render Specification Compiler (Phase A)
 *
 * ═══════════════════════════════════════════════════════════════
 * Phase A 宪法：
 *   此 agent 无权 reinterpret narrative。
 *   它只做：shots → field extraction → VideoPromptSpec。
 *   禁止：LLM 自由生成拍摄方案、推断剧情、补全场景。
 * ═══════════════════════════════════════════════════════════════
 *
 * POST /api/ai/optimize-video-prompt
 *
 * 输入：{ promptIR, shots, characters, scenes, videoStyle }
 * 输出：{ spec, prompt, scores }
 *
 *   shots (Structured)
 *     ↓
 *   render-spec-builder prompt (仅字段映射)
 *     ↓
 *   VideoPromptSpec
 *     ↓
 *   Prompt Compiler (deterministic formatter, 无 LLM)
 *     ↓
 *   prompt string
 *
 * ⭐ System prompt 使用 render-spec-builder（原 video-prompt-designer 替换）
 */

import { FastifyInstance } from 'fastify'
import { narrativeGateway } from '../runtime/narrative-gateway.js'
import { prisma } from '../utils/index.js'
import { shadowCompile } from '../services/video-compiler-shadow.js'
import { checkDailyQuota, incrementDailyUsage } from '../services/usage-quota.service.js'
import { compileAndScore, type VideoPromptSpec, type VFXSpec } from '../production-loop/prompt-compiler.js'
import { buildShotGraph, scoreShotGraph, validateShotGraph } from '../director-v2/shot-graph/index.js'

async function getRenderSpecBuilderPrompt(): Promise<string> {
  const { getPrompt } = await import('../runtime/prompt/PromptRegistry.js')
  return getPrompt('render-spec-builder')
}

function extractUserId(request: any): string | null {
  try {
    const auth = request.headers.authorization as string
    if (!auth || !auth.startsWith('Bearer ')) return null
    const token = auth.slice(7).trim()
    const decoded: any = (request.server as any).jwt.verify(token)
    return decoded?.id || null
  } catch {
    return null
  }
}

export default async function aiOptimizeVideoPromptRoutes(app: FastifyInstance) {
  app.post('/api/ai/optimize-video-prompt', { preHandler: [app.authenticate] }, async (request, reply) => {
    // ═══════════════════════════════════════════════════════════════
    // Phase B: Legacy Collapse — 此端点已废弃
    //   所有视频优化流程统一走 POST /api/video-optimize
    // ═══════════════════════════════════════════════════════════════
    return reply.status(410).send({
      success: false,
      error: 'DEPRECATED',
      message: 'All video optimization flows moved to POST /api/video-optimize',
      code: 'PHASE_B_LEGACY_COLLAPSE',
    })

    // ═════════════════════════════════════════════════════════════
    // Phase A: 解析 shots——优先 promptIR
    // ═════════════════════════════════════════════════════════════
    const existingShots = promptIR?.breakdown?.shots
      || bodyShots
      || []

    if (!existingShots.length && !segmentNarrative) {
      return reply.status(400).send({
        success: false,
        error: '缺少 shots 输入——此 agent 无权从空输入生成拍摄方案',
        code: 'PHASE_A_NO_SHOTS',
      })
    }

    try {
      const styleGuide = (videoStyle || 'realistic')

      // ═════════════════════════════════════════════════════════
      // Phase A: 构建 LLM 输入——只有结构化 shots，无 narrative 文本
      // ═════════════════════════════════════════════════════════
      const shotsString = existingShots.length > 0
        ? JSON.stringify(existingShots, null, 2)
        : `[descriptive shot from narrative: ${(segmentNarrative || '').slice(0, 200)}]`

      // ⭐ Phase A: 从 PromptRegistry 读取新 user prompt 模板
      const { getPrompt } = await import('../runtime/prompt/PromptRegistry.js')
      const userPromptTemplateStr = await getPrompt('video-optimize-user-prompt')

      const userPrompt = userPromptTemplateStr
        .replace(/\{shots\}/g, shotsString)
        .replace(/\{style\}/g, videoStyle || 'realistic')
        .replace(/\{styleGuide\}/g, styleGuide)

      // ═════════════════════════════════════════════════════════
      // Phase A: 调用 render-spec-builder（不是 narrative interpreter）
      // ═════════════════════════════════════════════════════════
      const systemPrompt = await getRenderSpecBuilderPrompt()

      const gatewayResponse = await narrativeGateway.execute({
        systemPrompt,
        userMessage: userPrompt,
        userId: userId || 'anonymous',
        timeoutTier: 'normal',
        maxTokens: 2048,
        temperature: 0.2, // ⭐ Phase A: 降低创造力
      })

      let rawContent = gatewayResponse.content.trim()

      const codeBlockMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (codeBlockMatch) {
        rawContent = codeBlockMatch[1].trim()
      }

      // ═════════════════════════════════════════════════════════
      // Phase A: 解析 LLM 输出 → VideoPromptSpec
      // ═════════════════════════════════════════════════════════
      let spec: VideoPromptSpec
      let parsed: any
      try {
        parsed = JSON.parse(rawContent)
        spec = normalizeToSpec(parsed)
      } catch (parseErr: any) {
        console.error('[optimize-video-agent] ❌ JSON 解析失败:', parseErr.message || 'unknown')
        return reply.status(422).send({
          success: false,
          error: 'LLM 返回格式异常',
          rawResponse: rawContent.slice(0, 2000),
        })
      }

      // ═════════════════════════════════════════════════════════
      // Phase A: Prompt Compiler（deterministic formatter）
      // ═════════════════════════════════════════════════════════
      const { prompt, scores, guardWarnings } = compileAndScore(spec)

      // ═════════════════════════════════════════════════════════
      // Shot Graph 验证
      // ═════════════════════════════════════════════════════════
      const shotGraph = buildShotGraph(segmentNarrative || '')
      const graphScores = scoreShotGraph(shotGraph)
      const validationIssues = validateShotGraph(shotGraph)

      const latency = Date.now() - start
      console.log(`[optimize-video-agent] ✅ ${latency}ms, ` +
        `prompt=${prompt.length}chars, score=${scores.overall.toFixed(3)}`)

      incrementDailyUsage(userId, 'llm').catch(() => {})

      // ═════════════════════════════════════════════════════════
      // Phase A: 输出——不再 buildChineseNarrative
      //   optimizedNarrative 直接从 spec 提取纯描述，不做叙事重建
      // ═════════════════════════════════════════════════════════
      const narrativeFromLLM = (parsed as any).narrative || ''
      // 只使用 shot 级别的描述，不补充"氛围""情绪"等叙事内容
      const shotDescription = existingShots.length > 0
        ? existingShots.map((s: any) => s.action || s.camera || '').filter(Boolean).join('，')
        : narrativeFromLLM

      // ⭐ 输出兼容旧前端格式
      return {
        success: true,
        data: {
          // Phase A: 新格式
          spec,
          prompt,
          scores,
          guardWarnings,

          // Shot Graph
          director: {
            shotGraph,
            graphScores,
            validationIssues,
          },

          // ⭐ 旧格式兼容
          optimizedNarrative: shotDescription || narrativeFromLLM || segmentNarrative?.slice(0, 200) || '',
          optimizedDialogue: dialogue || '',
          optimizedEffects: (parsed as any).effects || effects || '',
          optimizedFirstFrame: existingShots[0]?.camera || '',
          optimizedMidFrame: '',
          optimizedLastFrame: existingShots[existingShots.length - 1]?.camera || '',
          optimizedShots: existingShots.length > 0
            ? existingShots
            : [{
                second: 0,
                camera: `${spec.camera.shot_type}, ${spec.camera.movement || 'static'}`,
                action: spec.action,
                fx: extractVFXString(spec.vfx),
                expression: '',
              }],
        },
        meta: {
          latencyMs: latency,
          totalTokens: gatewayResponse.totalTokens,
          qualityScore: scores.overall,
        },
      }
    } catch (err: any) {
      console.error('[optimize-video-agent] ❌ error:', err.message)
      return reply.status(500).send({
        success: false,
        error: err.message || '服务异常',
      })
    }
  })
}

// ============================================================
// Helpers
// ============================================================

function normalizeToSpec(parsed: any): VideoPromptSpec {
  return {
    camera: {
      shot_type: String(parsed.camera?.shot_type || 'medium shot'),
      movement: parsed.camera?.movement ? String(parsed.camera.movement) : 'static',
      lens: parsed.camera?.lens ? String(parsed.camera.lens) : undefined,
    },
    subject: {
      main: typeof parsed.subject?.main === 'object' && parsed.subject?.main !== null
        ? (parsed.subject.main.name || parsed.subject.main.character || JSON.stringify(parsed.subject.main))
        : String(parsed.subject?.main || ''),
      secondary: Array.isArray(parsed.subject?.secondary)
        ? parsed.subject.secondary.map((s: any) => typeof s === 'object' ? (s.name || s.character || JSON.stringify(s)) : String(s))
        : undefined,
    },
    action: typeof parsed.action === 'object' && parsed.action !== null
      ? (parsed.action.description || parsed.action.action || parsed.action.name || JSON.stringify(parsed.action))
      : String(parsed.action || ''),
    environment: {
      location: typeof parsed.environment?.location === 'string' && parsed.environment.location !== 'a cinematic setting' ? parsed.environment.location : '',
      atmosphere: typeof parsed.environment?.atmosphere === 'string' && parsed.environment.atmosphere !== 'cinematic atmosphere' ? parsed.environment.atmosphere : '',
      time_of_day: parsed.environment?.time_of_day ? String(parsed.environment.time_of_day) : undefined,
    },
    vfx: {
      energy: Array.isArray(parsed.vfx?.energy) ? parsed.vfx.energy.map(String) : undefined,
      physics: Array.isArray(parsed.vfx?.physics) ? parsed.vfx.physics.map(String) : undefined,
      particles: Array.isArray(parsed.vfx?.particles) ? parsed.vfx.particles.map(String) : undefined,
    },
    style: {
      cinematic: parsed.style?.cinematic !== false,
      keywords: Array.isArray(parsed.style?.keywords)
        ? parsed.style.keywords.map(String)
        : ['cinematic', 'high quality', 'detailed'],
    },
  }
}

function extractVFXString(vfx: VFXSpec | undefined): string {
  if (!vfx) return ''
  const parts: string[] = []
  if (vfx.energy?.length) parts.push(vfx.energy.join('; '))
  if (vfx.physics?.length) parts.push(vfx.physics.join('; '))
  if (vfx.particles?.length) parts.push(vfx.particles.join('; '))
  return parts.join(' | ')
}
