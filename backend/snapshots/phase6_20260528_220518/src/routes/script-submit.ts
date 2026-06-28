import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { aigcOrchestrator } from '../agents/aigc-orchestrator.js'
import { prisma } from '../utils/index.js'

export default async function scriptSubmitRoutes(app: FastifyInstance) {
  /**
   * 从请求中解析用户 ID：优先从 JWT token 解析，其次从 body 读
   */
  function resolveUserId(request: any, body: any): string {
    // 第1优先级：JWT token 解析后的 userId
    const fromToken = (request as any).userId || (request.user as any)?.id
    if (fromToken && fromToken !== 'anonymous') return fromToken
    // 第2优先级：尝试手动解析 JWT token（没有 preHandler authenticate 时）
    if (request.headers?.authorization) {
      try {
        const token = request.headers.authorization.replace('Bearer ', '')
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
          if (payload.id || payload.sub) {
            return payload.id || payload.sub
          }
        }
      } catch {}
    }
    // 第3优先级：从 body 取
    const fromBody = body?.userId
    if (fromBody && fromBody !== 'anonymous') return fromBody
    return 'anonymous'
  }

  async function saveProject(userId: string, body: any, resultData: any): Promise<string> {
    const projectName = body.title 
      || body.name 
      || `未命名剧本 ${new Date().toISOString().slice(0, 10)}`
    const description = (body.script || body.text || '').slice(0, 200)
    // 把完整剧本原文存入 executionResults.rawScript
    const fullScript = body.script || body.text || ''
    const execData = { ...(resultData || {}), rawScript: fullScript }

    if (body.projectId) {
      // 更新已有项目
      await prisma.project.update({
        where: { id: body.projectId },
        data: {
          name: projectName,
          description,
          script: fullScript,
          status: 'analyzed',
          executionResults: execData,
        },
      })
      return body.projectId
    } else {
      // 创建新项目
      const project = await prisma.project.create({
        data: {
          name: projectName,
          description,
          script: fullScript,
          status: 'analyzed',
          executionResults: execData,
          userId,
        },
      })
      return project.id
    }
  }

  // ─── 提交剧本，启动多 Agent 全流程 ───
  app.post('/api/script/submit', async (request, reply) => {
    const body = request.body as {
      text: string
      title?: string
      aspectRatio?: string
      genre?: string
      visualStyle?: string
    }

    if (!body.text?.trim()) {
      return reply.status(400).send({ success: false, error: '请输入剧本内容' })
    }

    try {
      const result = await aigcOrchestrator.generate({
        text: body.text.trim(),
        title: body.title,
        aspectRatio: body.aspectRatio || '16:9',
        genre: body.genre || '',
        visualStyle: body.visualStyle || '',
        userId: resolveUserId(request, body),
      })

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error || 'AI 分析失败',
          meta: result.meta,
        })
      }

      return {
        success: true,
        data: result.data,
        meta: result.meta,
      }
    } catch (err: any) {
      console.error('[ScriptSubmit] Error:', err)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── V1 兼容接口：/api/v1/script/parse → 同 submit ───
  app.post('/api/v1/script/parse', async (request, reply) => {
    const body = request.body as {
      title?: string
      script?: string
      text?: string
      aspectRatio?: string
      visualStyle?: string
      projectId?: string   // 可选，更新已有项目
    }

    if (!body.script?.trim() && !body.text?.trim()) {
      return reply.status(400).send({ success: false, error: '请输入剧本内容' })
    }

    try {
      const userId = resolveUserId(request, body)

      // 全量模式：跑剧情总指挥 + 所有 Designer Agent
      const result = await aigcOrchestrator.generate({
        text: body.script || body.text || '',
        title: body.title,
        aspectRatio: body.aspectRatio || '16:9',
        genre: '',
        visualStyle: body.visualStyle || '',
        userId,
      })

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error || 'AI 分析失败',
          meta: result.meta,
        })
      }

      // 保存到 Project 表
      let projectId: string | null = null
      try {
        projectId = await saveProject(userId, body, result.data)
      } catch (dbErr: any) {
        console.error('[ScriptParse] Failed to save project:', dbErr)
        // 不影响主流程返回
      }

      // ⭐ Artifact Layer v1: 同步写入 DB 独立表
      if (projectId && result.data) {
        try {
          const { syncArtifactsFromExecution } = await import('../services/artifact-sync.service.js')
          const syncResult = await syncArtifactsFromExecution(projectId, result.data)
          console.log('[ScriptParse] Artifact sync 完成:', syncResult)
        } catch (syncErr: any) {
          console.warn('[ScriptParse] Artifact sync 失败（不影响主流程）:', syncErr.message)
        }
      }

      // ⭐ Director Layer v3: 执行导演编排（确定式 shot graph 生成）
      if (projectId && result.data) {
        try {
          const { DirectorEngine } = await import('../engine/director/director-engine.js')
          const { syncDirectorPlan } = await import('../services/artifact-sync.service.js')
          const plotBP = result.data?.plotBlueprint || {}
          const sceneSpecs = result.data?.sceneSpecs || []
          if (sceneSpecs.length > 0) {
            const engine = new DirectorEngine()
            const directorPlan = engine.build(sceneSpecs, plotBP)
            await syncDirectorPlan(projectId, directorPlan)
            console.log('[ScriptParse] Director Layer v3 shot graph 生成完成:', {
              shots: directorPlan.shotGraph?.abstractShots?.length || 0,
              scenes: sceneSpecs.length,
            })
          } else {
            console.log('[ScriptParse] 无 sceneSpecs，跳过 DirectorEngine')
          }
        } catch (deErr: any) {
          console.warn('[ScriptParse] DirectorEngine 失败（不影响主流程）:', deErr.message)
        }
      }

      return {
        success: true,
        data: result.data,
        meta: result.meta,
        projectId,
      }
    } catch (err: any) {
      console.error('[ScriptParse] Error:', err)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })

  // ─── 重新生成单项（已有分项的精细化调整） ───
  app.post('/api/script/regenerate', async (request, reply) => {
    const body = request.body as {
      text: string
      section: 'character' | 'scene' | 'storyboard' | 'voice' | 'video' | 'props'
      title?: string
      aspectRatio?: string
      existingSpec?: any
      projectId?: string
    }

    if (!body.text?.trim()) {
      return reply.status(400).send({ success: false, error: '请输入剧本内容' })
    }

    try {
      const userId = resolveUserId(request, body)
      const result = await aigcOrchestrator.generate({
        text: body.text.trim(),
        title: body.title,
        aspectRatio: body.aspectRatio || '16:9',
        userId,
        section: body.section,
        existingSpec: body.existingSpec,
      })

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error || '重新生成失败',
          meta: result.meta,
        })
      }

      // ⭐ 自动持久化角色/场景 spec 到 execution_results
      if (body.projectId && result.data) {
        try {
          const project = await prisma.project.findUnique({
            where: { id: body.projectId },
            select: { executionResults: true },
          })
          const existing = (project?.executionResults as Record<string, any>) || {}
          const sectionKeyMap: Record<string, string> = {
            character: 'characterSpecs',
            scene: 'sceneSpecs',
            voice: 'voiceConfigs',
            storyboard: 'videoSegments',
            video: 'videoSegments',
            props: 'propSpecs',
          }
          const key = sectionKeyMap[body.section]
          let dataToSave: any[] | undefined

          if (key && result.data[key]) {
            dataToSave = result.data[key]
          } else if (key) {
            // fallback: 匹配 result.data 下包含 section 名的字段
            for (const maybeKey of Object.keys(result.data)) {
              if (maybeKey.toLowerCase().includes(body.section.replace(/s$/, ''))) {
                dataToSave = result.data[maybeKey]
                break
              }
            }
          }

          if (key && dataToSave) {
            const merged = { ...existing, [key]: dataToSave }
            await prisma.project.update({
              where: { id: body.projectId },
              data: { executionResults: merged },
            })
            console.log(`[ScriptRegen] ✅ 自动持久化 ${key} 到 project ${body.projectId}`)

            // ⭐ Execution Journal: log the event with type mapping
            const eventTypeMap: Record<string, any> = {
              character: { type: 'CHARACTER_GENERATED', stage: 'character' },
              scene: { type: 'SCENE_GENERATED', stage: 'scene' },
              voice: { type: 'VOICE_CONFIGURED', stage: 'voice' },
              storyboard: { type: 'STORYBOARD_GENERATED', stage: 'storyboard' },
            }
            const je = eventTypeMap[body.section]
            if (je) {
              const { appendEvent } = await import('../services/execution-journal.service.js')
              appendEvent({
                type: je.type,
                stage: je.stage,
                timestamp: Date.now(),
                executionId: body.projectId,
                trigger: 'ai',
                payload: { [key]: dataToSave },
              }).catch(() => {}) // fire-and-forget
            }
          }
        } catch (peErr: any) {
          console.warn('[ScriptRegen] 持久化失败（不影响主流程）:', peErr.message)
        }
      }

      return {
        success: true,
        data: result.data,
        meta: result.meta,
      }
    } catch (err: any) {
      console.error('[ScriptRegen] Error:', err)
      return reply.status(500).send({ success: false, error: err.message })
    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

