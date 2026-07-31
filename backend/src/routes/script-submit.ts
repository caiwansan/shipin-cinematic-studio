import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'
import { aigcOrchestrator } from '../agents/aigc-orchestrator.js'
import { prisma } from '../utils/index.js'
import { schemaGuard } from '../runtime/schema-validator/execution-results-guard.js'
import { verifyProjectOwner } from '../services/director/project-ownership.service.js'

export default async function scriptSubmitRoutes(app: FastifyInstance) {
  /**
   * 从请求中解析用户 ID
   * ⭐ Phase 6 安全隔离:
   *   - 只从 authenticate 后的可信身份 (request.user.id) 取
   *   - 禁止 base64 decode JWT（无签名验证）
   *   - 禁止 body.userId 覆盖认证身份
   *   - 禁止 projectId 反查 owner 充当身份（防跨项目冒充）
   */
  async function resolveUserId(request: any): Promise<string> {
    const fromAuth = (request.user as any)?.id
    if (!fromAuth || fromAuth === 'anonymous') {
      throw new Error('未认证：请登录后操作')
    }
    return fromAuth
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
      // ⭐ Phase 6 安全隔离: 更新已有项目前必须归属校验（防越权覆盖他人项目）
      const ownerCheck = await verifyProjectOwner(body.projectId, userId)
      if (!ownerCheck.ok) {
        throw new Error(ownerCheck.error)
      }
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
  app.post('/api/script/submit', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as {
      text: string
      title?: string
      aspectRatio?: string
      genre?: string
      visualStyle?: string
      videoStyle?: string
      projectId?: string
    }

    if (!body.text?.trim()) {
      return reply.status(400).send({ success: false, error: '请输入剧本内容' })
    }

    try {
      const userId = await resolveUserId(request)

      // ⭐ 第一步：全流程 AI 分析
      const result = await aigcOrchestrator.generate({
        text: body.text.trim(),
        title: body.title,
        aspectRatio: body.aspectRatio || '9:16',
        genre: body.genre || '',
        visualStyle: body.videoStyle || body.visualStyle || '',
        userId,
      })

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error || 'AI 分析失败',
          meta: result.meta,
        })
      }

      // ⭐ 第二步：如果有 projectId，自动持久化六维数据到 executionResults + artifact sync
      if (body.projectId && result.data) {
        try {
          // ⭐ Phase 6 安全隔离: 归属校验（防写他人项目 executionResults）
          const ownerCheck = await verifyProjectOwner(body.projectId, userId)
          if (!ownerCheck.ok) {
            return reply.status(ownerCheck.status).send({ success: false, error: ownerCheck.error })
          }
          const project = await prisma.project.findUnique({
            where: { id: body.projectId },
            select: { executionResults: true },
          })
          const existing = (project?.executionResults as Record<string, any>) || {}

          const preserved: Record<string, any> = {}
          for (const pk of ['targetDuration', 'durationInput', 'analyzeV2Data', 'rawScript']) {
            if (existing[pk] !== undefined) preserved[pk] = existing[pk]
          }

          const newData = result.data as Record<string, any>
          const merged: Record<string, any> = { ...existing, ...preserved, ...newData }

          if (existing.analyzeV2Data) {
            merged.analyzeV2Data = existing.analyzeV2Data
          }

          // ⭐ SSOT（SHORTDRAMA-DATA-SSOT）: 用户编辑事实 = executionResults.userEdits
          //    重新分析时保留用户编辑（不再 delete merged.segments 丢弃），
          //    只清空 AI 生成的 segments 快照，用户编辑层原样保留
          const userSegments = existing.userEdits?.segments
          if (Array.isArray(userSegments) && userSegments.length > 0) {
            // 保留用户编辑：AI 重分析不清除用户创作
            console.log(`[ScriptSubmit] ✅ 保留 ${userSegments.length} 段用户编辑（userEdits）`)
          } else {
            delete merged.segments
          }
          // ⭐ P4-2 P0: Schema Validation Guard
          // 在写入 executionResults 前验证 AigcSpecOutput 结构完整性
          const guardResult = schemaGuard(merged, 'script-submit', body.projectId)
          if (!guardResult.passed) {
            console.error(`[ScriptSubmit] ❌ Schema validation failed for project ${body.projectId}: ${guardResult.error}`)
            return reply.status(422).send({
              success: false,
              error: '剧本分析结果结构异常，请重试',
              detail: guardResult.error,
              report: guardResult.report,
            })
          }

          await prisma.project.update({
            where: { id: body.projectId },
            data: {
              script: body.text.trim(),
              executionResults: merged,
            },
          })
          console.log(`[ScriptSubmit] ✅ 持久化六维数据到 project ${body.projectId}`)

          try {
            const { syncArtifactsFromExecution } = await import('../services/artifact-sync.service')
            const syncResult = await syncArtifactsFromExecution(body.projectId, merged)
            console.log('[ScriptSubmit] Artifact sync 完成:', syncResult)
          } catch (syncErr: any) {
            console.warn('[ScriptSubmit] Artifact sync 失败（不影响主流程）:', syncErr.message)
          }
        } catch (peErr: any) {
          console.warn('[ScriptSubmit] 持久化失败（不影响主流程）:', peErr.message)
        }
      }

      // ⭐ P1.8 Activation Trigger: fire-and-forget dual-render
      //    script submit 成功后，自动触发一次双轨采样
      if (body.projectId && result.data) {
        try {
          handleDualRenderAfterSubmit(body.projectId, userId, body, result.data).catch((err: any) => {
            console.warn('[P18] ⚠️ dual-render 触发失败（不影响主流程）:', err.message)
          })
        } catch (err: any) {
          console.warn('[P18] ⚠️ dual-render 调度异常（不影响主流程）:', err.message)
        }
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
  // ⭐ Phase 6 安全隔离: 加认证，userId 禁止伪造
  app.post('/api/v1/script/parse', { preHandler: [app.authenticate] }, async (request, reply) => {
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
      const userId = await resolveUserId(request)

      // 全量模式：跑剧情总指挥 + 所有 Designer Agent
      const result = await aigcOrchestrator.generate({
        text: body.script || body.text || '',
        title: body.title,
        aspectRatio: body.aspectRatio || '9:16',
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
          const { syncArtifactsFromExecution } = await import('../services/artifact-sync.service')
          const syncResult = await syncArtifactsFromExecution(projectId, result.data)
          console.log('[ScriptParse] Artifact sync 完成:', syncResult)
        } catch (syncErr: any) {
          console.warn('[ScriptParse] Artifact sync 失败（不影响主流程）:', syncErr.message)
        }
      }

      // ⭐ Director Layer v3: 已移除（旧 DirectorEngine 不再使用）

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
  app.post('/api/script/regenerate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = request.body as {
      text: string
      section: 'character' | 'scene' | 'storyboard' | 'voice' | 'video' | 'props'
      title?: string
      aspectRatio?: string
      existingSpec?: any
      projectId?: string
      sceneDescription?: string
      sceneDescriptions?: { sceneName: string; description: string }[]
      instruction?: string
    }

    try {
      const userId = await resolveUserId(request)

      // ⭐ 如果前端没传 text，尝试从 projectId 反查已保存的剧本
      if (!body.text?.trim() && body.projectId) {
        // ⭐ Phase 6 安全隔离: 反查前必须归属校验（防越权读取他人剧本）
        const ownerCheck = await verifyProjectOwner(body.projectId, userId)
        if (!ownerCheck.ok) {
          return reply.status(ownerCheck.status).send({ success: false, error: ownerCheck.error })
        }
        try {
          const project = await prisma.project.findUnique({
            where: { id: body.projectId },
            select: { script: true, executionResults: true },
          })
          const scriptFromDb = project?.script || (project?.executionResults as any)?.rawScript || ''
          if (scriptFromDb.trim()) {
            body.text = scriptFromDb
            console.log(`[ScriptRegen] ⭐ 从 project ${body.projectId.substring(0, 8)} 反查剧本: ${scriptFromDb.length} chars`)
          }
        } catch {}
      }
      if (!body.text?.trim()) {
        return reply.status(400).send({ success: false, error: '请输入剧本内容' })
      }
      
      console.log(`[ScriptRegen] section=${body.section}, text.length=${body.text?.length||0}, hasSceneDesc=${!!body.sceneDescription}, sceneDescLen=${body.sceneDescription?.length||0}`)

      // ⭐ props section 特殊处理：直接走 narrativeGateway（不经过 agent 体系）
      if (body.section === 'props') {
        const { narrativeGateway } = await import('../runtime/narrative-gateway')
        
        // 从 PromptTemplate 表读取道具设计师 prompt（与 agent 体系一致的数据源）
        const dbTemplate = await prisma.promptTemplate.findUnique({
          where: { name: '道具设计师' },
        })
        if (!dbTemplate?.content || typeof dbTemplate.content !== 'object' || !('prompt' in (dbTemplate.content as any))) {
          throw new Error('[ScriptRegen] PromptTemplate.道具设计师 在数据库中不存在')
        }
        const systemPrompt = (dbTemplate.content as any).prompt as string
        
        const existingProps = body.existingSpec?.propSpecs || []
        const storyText = body.text.trim().slice(0, 4000) || '无故事文本'

        // ⭐ 从 project 反查角色、场景、分镜等完整上下文
        let projectContext = ''
        if (body.projectId) {
          try {
            const project = await prisma.project.findUnique({
              where: { id: body.projectId },
              select: { executionResults: true },
            })
            const er = (project?.executionResults as Record<string, any>) || {}
            const ctxParts: string[] = []
            if (er.characterSpecs?.length) ctxParts.push(`角色列表：${JSON.stringify(er.characterSpecs.map((c: any) => ({ name: c.name, category: c.category, description: c.description })))}`)
            if (er.sceneSpecs?.length) ctxParts.push(`场景列表：${JSON.stringify(er.sceneSpecs.map((s: any) => ({ name: s.name, category: s.category, description: s.description })))}`)
            if (er.videoSegments?.length) ctxParts.push(`分镜数量：${er.videoSegments.length} 段`)
            if (er.propSpecs?.length) {
              // 去重：existingProps 可能包含当前要优化的道具
              const dbPropNames = new Set(existingProps.map((p: any) => p.name))
              const extraProps = er.propSpecs.filter((p: any) => !dbPropNames.has(p.name))
              if (extraProps.length) ctxParts.push(`项目已有其他道具：${JSON.stringify(extraProps.map((p: any) => ({ name: p.name, category: p.category })))}`)
            }
            if (ctxParts.length) projectContext = `\n\n## 项目上下文\n${ctxParts.join('\n')}`
            console.log(`[ScriptRegen] ⭐ props 优化附带项目上下文: ${ctxParts.length} 个维度`)
          } catch {}
        }

        const userMsg = existingProps.length > 0
          ? `请优化以下道具的 imagePrompt 视觉描述词。现有道具：${JSON.stringify(existingProps.map((p: any) => ({ name: p.name, category: p.category, description: p.description })))}${projectContext}`
          : `请从以下故事中提取所有出现的道具：\n${storyText}${projectContext}`
        
        const gwRes = await narrativeGateway.execute({
          systemPrompt,
          userMessage: userMsg,
          userId: userId || 'anonymous',
          timeoutTier: 'batch',
          maxTokens: 4096,
        })
        
        const raw = gwRes.content
        let propSpecs: any[] = []
        try {
          const parsed = JSON.parse(raw.replace(/```json\s*|\s*```/g, ''))
          if (Array.isArray(parsed.propSpecs)) propSpecs = parsed.propSpecs
          else if (Array.isArray(parsed.props)) propSpecs = parsed.props
          else if (Array.isArray(parsed)) propSpecs = parsed
          // 如果 parsed.propSpecs 是对象包含 props，取 props
          else if (parsed.propSpecs?.props) propSpecs = parsed.propSpecs.props
        } catch {}
        
        // 保底：用已有数据
        if (propSpecs.length === 0 && existingProps.length > 0) propSpecs = existingProps
        
        return {
          success: true,
          data: { propSpecs },
          meta: { latencyMs: Date.now() - (request as any).__startTime || 0, agentStats: { '道具设计师': { success: true } } },
        }
      }
      
      // ⭐ 音色 section：验证 voiceProfileId 是否存在，禁止 LLM 猜测
      if (body.section === 'voice') {
        const characterSpecs = body.existingSpec?.characterSpecs || []
        const missingVoiceProfile = characterSpecs.filter((c: any) => !c.voiceProfileId)
        if (missingVoiceProfile.length > 0) {
          return reply.status(400).send({
            success: false,
            error: `以下角色缺少 voiceProfileId，无法生成音色：${missingVoiceProfile.map((c: any) => c.name || c.id).join('、')}。请先选择内置音色。`,
          })
        }
        // 已有 voiceProfileId，直接映射
        const voiceConfigs = characterSpecs.map((c: any) => ({
          characterId: c.id,
          characterName: c.name,
          voiceProfileId: c.voiceProfileId,
          voiceName: c.voiceProfileId,
          pitch: c.voicePitch || 1.0,
          speed: c.voiceSpeed || 1.0,
        }))
        console.log(`[RuntimeTrace] Voice section: ${characterSpecs.length} characters, voiceProfileIds: [${characterSpecs.map((c: any) => c.voiceProfileId).join(', ')}], llmBypassed=true`)
        return reply.send({
          success: true,
          data: { voiceConfigs },
          meta: { source: 'CharacterRuntime.voiceProfileId', llmBypassed: true },
        })
      }

      const result = await aigcOrchestrator.generate({
        text: body.text.trim(),
        title: body.title,
        aspectRatio: body.aspectRatio || '9:16',
        userId,
        section: body.section,
        existingSpec: body.existingSpec,
        sceneDescription: (body as any).sceneDescription,
        sceneDescriptions: (body as any).sceneDescriptions,
        instruction: (body as any).instruction,
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

          // ⭐ 持久化整个 result.data（不只是当前 section 的 key）
          // storyboard/video section → result.data 可能包含 videoSegments.frameDesign 等
          // 也可能包含 plotBlueprint（全量分析时）
          // 合并：保留旧 executionResults 中非冲突字段，用新数据覆盖 section 维
          const preservedKeys = ['targetDuration', 'durationInput', 'analyzeV2Data', 'rawScript']
          const preserved: Record<string, any> = {}
          for (const pk of preservedKeys) {
            if (existing[pk] !== undefined) preserved[pk] = existing[pk]
          }

          // 从 result.data 提取所有可用字段
          const newData = result.data as Record<string, any>
          const merged: Record<string, any> = { ...existing, ...preserved, ...newData }

          // ⚠️ GUARD: analyzeV2Data immutable
          if (existing.analyzeV2Data) {
            merged.analyzeV2Data = existing.analyzeV2Data
            console.log(`[ScriptRegen] 🔒 Preserved immutable analyzeV2Data snapshot`)
          }

          // ⭐ storyboard 优化：将 storyboardSpecs 的 imagePrompt 回填到 videoSegments
          if (body.section === 'storyboard') {
            console.log(`[ScriptRegen] 📋 storyboard check: section=${body.section}, storyboardSpecs=${merged.storyboardSpecs?.length}, videoSegments=${merged.videoSegments?.length}, newDataKeys=${Object.keys(newData).join(',')}`)
            if (merged.storyboardSpecs?.length && merged.videoSegments?.length) {
              const specs = merged.storyboardSpecs
              const vs = merged.videoSegments as any[]
              if (specs.length === vs.length) {
                // ✅ 数量完全匹配，逐段回填
                for (let i = 0; i < vs.length; i++) {
                  if (specs[i]?.imagePrompt) vs[i].imagePrompt = specs[i].imagePrompt
                  if (specs[i]?.negativePrompt) vs[i].negativePrompt = specs[i].negativePrompt
                }
                console.log(`[ScriptRegen] ✅ 回填 ${vs.length} 个 videoSegments imagePrompt`)
              } else if (specs.length > 0 && specs.length < vs.length) {
                // ⭐ LLM 输出数量 < 分镜数量，循环填充
                for (let i = 0; i < vs.length; i++) {
                  const spec = specs[i % specs.length]
                  if (spec?.imagePrompt) vs[i].imagePrompt = spec.imagePrompt
                  if (spec?.negativePrompt) vs[i].negativePrompt = spec.negativePrompt
                }
                console.log(`[ScriptRegen] 🔄 循环填充 ${specs.length}→${vs.length} 个 videoSegments imagePrompt`)
              }
            }
          }

          // 清理旧 segments/storyboardSpecs 缓存，确保前端从最新 videoSegments 重建
          delete merged.segments;
          delete merged.storyboardSpecs;

          await prisma.project.update({
            where: { id: body.projectId },
            data: { executionResults: merged },
          })
          console.log(`[ScriptRegen] ✅ 持久化 ${Object.keys(newData).length} 个字段到 project ${body.projectId}`)

          // ⭐ Artifact Layer v1: 无条件同步写入 DB 独立表
          try {
            const { syncArtifactsFromExecution } = await import('../services/artifact-sync.service')
            const syncResult = await syncArtifactsFromExecution(body.projectId, merged)
            console.log('[ScriptRegen] Artifact sync 完成:', syncResult)
          } catch (syncErr: any) {
            console.warn('[ScriptRegen] Artifact sync 失败（不影响主流程）:', syncErr.message)
          }

          // ⭐ Execution Journal
          if (body.section) {
            const eventTypeMap: Record<string, any> = {
              character: { type: 'CHARACTER_GENERATED', stage: 'character' },
              scene: { type: 'SCENE_GENERATED', stage: 'scene' },
              voice: { type: 'VOICE_CONFIGURED', stage: 'voice' },
              storyboard: { type: 'STORYBOARD_GENERATED', stage: 'storyboard' },
              props: { type: 'PROPS_GENERATED', stage: 'props' },
            }
            const je = eventTypeMap[body.section]
            if (je) {
              const { appendEvent } = await import('../services/execution-journal.service')
              appendEvent({
                type: je.type,
                stage: je.stage,
                timestamp: Date.now(),
                executionId: body.projectId,
                trigger: 'ai',
                payload: { resultKeys: Object.keys(newData) },
              }).catch(() => {})
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

/**
 * 六维数据生成（同步调用）
 * storyboard regenerate 完成后自动触发，返回 snapshot 让主流程合并写入
 */
async function runAnalyzeV2Snapshot(projectId: string, script: string, title: string, targetDuration: number): Promise<any | null> {
  const { narrativeGateway } = await import('../runtime/narrative-gateway')
  const { normalizeNarrativeSpec } = await import('../services/narrative/normalize-narrative-spec')

  // ⭐ 从 DB PromptTemplate 读取六维拆解 prompt（禁止硬编码文本文件）
  const dbTemplate = await prisma.promptTemplate.findUnique({
    where: { name: '六维数据拆解分析' },
  })
  if (!dbTemplate?.content || typeof dbTemplate.content !== 'object' || !('prompt' in (dbTemplate.content as any))) {
    throw new Error('[ScriptRegen] PromptTemplate.六维数据拆解分析 在数据库中不存在或内容为空')
  }
  const promptRaw = (dbTemplate.content as any).prompt as string

  const analyzePrompt = `剧本名称：${title || ''}

剧本全文：
${script.slice(0, 8000)}

视频总时长：${targetDuration || 60} 秒`

  let analysis: any

  try {
    const gwResponse = await narrativeGateway.execute({
      systemPrompt: promptRaw,
      userMessage: analyzePrompt,
      userId: '__system_anonymous__',
      maxTokens: 8192,
      temperature: 0.1,
      timeoutTier: 'long',
    })

    console.log(`[AnalyzeV2Snapshot] ✅ LLM 响应成功, contentLength=${gwResponse.content.length}`)

    const jsonMatch = gwResponse.content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || [null, gwResponse.content]
    analysis = JSON.parse(jsonMatch[1].trim())

    console.log(`[AnalyzeV2Snapshot] ✅ JSON 解析成功: ${analysis.characters?.length || 0} chars, ${analysis.scenes?.length || 0} scenes, ${analysis.videoSegments?.length || 0} segments`)
  } catch (err: any) {
    console.warn(`[AnalyzeV2Snapshot] ⚠️ AI 调用/解析失败: ${err.message}，使用 heuristic fallback`)
    // heuristic fallback — 从剧本中启发式提取角色名和场景信息
    const lines = script.split('\n').filter(l => l.trim().length > 0)

    // 尝试从"角色名：台词"格式或"【角色名】"格式提取角色
    const heurChars: any[] = []
    const charNameSet = new Set<string>()
    const charPattern = /^([\u4e00-\u9fa5]{2,4})[：:]/  // 行首中文名+冒号
    for (const line of lines) {
      const m = line.match(charPattern)
      if (m && !charNameSet.has(m[1])) {
        charNameSet.add(m[1])
        heurChars.push({
          id: `ch_heur_${heurChars.length}`,
          name: m[1],
          description: `${m[1]}（启发式提取）`,
          gender: '',
          age: '',
          role: '未知',
        })
      }
    }

    analysis = {
      characters: heurChars,
      scenes: [{ name: '全篇', description: script.slice(0, 200) }],
      videoSegments: lines.slice(0, 20).map((l, i) => ({
        segmentId: `seg_${i}`,
        sortOrder: i,
        title: `段落 ${i + 1}`,
        duration: Math.ceil((targetDuration || 60) / Math.min(lines.length, 20)),
        content: l.slice(0, 100),
        emotionArc: 'neutral',
      })),
      props: [],
      beats: lines.slice(0, 20).map((l, i) => ({
        sortOrder: i,
        title: `段落 ${i + 1}`,
        duration: Math.ceil((targetDuration || 60) / Math.min(lines.length, 20)),
        emotion: 'neutral',
      })),
      emotionCurve: [],
    }
  }

  const { normalized: normalizedSpec, repaired, heuristicFallbackUsed } = await normalizeNarrativeSpec(analysis, script)

  console.log(`[ScriptRegen] ✅ 六维 snapshot 就绪: ${normalizedSpec.characters?.length || 0} chars, ${normalizedSpec.scenes?.length || 0} scenes, ${normalizedSpec.props?.length || 0} props`)

  return {
    version: 'v2',
    createdAt: new Date().toISOString(),
    rawAiResponse: analysis,
    normalized: normalizedSpec,
    parserMeta: { parserVersion: '1.0.0', repaired, heuristicFallbackUsed },
    executionMeta: { model: 'regenerate-auto', latency: 0, tokens: 0 },
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

/**
 * ⭐ P1.8 Activation Trigger
 *
 * script submit 成功后，fire-and-forget 触发一次双轨渲染。
 * 从 V3 AigcSpecOutput 构建 PromptIR，同时构建 V2 兼容的 input。
 *
 * 原则：
 *   - 不阻塞主流程（用户不感知）
 *   - 失败不影响 submission
 *   - 仅当有 projectId 时才触发（有完整上下文）
 */
async function handleDualRenderAfterSubmit(
  projectId: string,
  userId: string,
  body: any,
  data: any,
): Promise<void> {
  // 从 V3 输出构建 PromptIR
  const v3Output = data as Record<string, any>
  const videoSegments = v3Output.videoSegments || []
  const scenes = v3Output.scenes || []
  const characters = v3Output.characters || v3Output.characterSpecs || []

  // 构建 V3 PromptIR
  const v3PromptIR: Record<string, any> = {
    script: {
      narrative: videoSegments.map((s: any) => s.narrative || s.visualDesc || '').join('\n'),
      dialogue: videoSegments.map((s: any) => s.dialogue || '').join('\n'),
      effects: '',
      emotion: '',
      negativePrompt: '',
    },
    breakdown: {
      shots: videoSegments.map((s: any, i: number) => ({
        second: i + 1,
        camera: s.cameraShot || s.camera?.shot || '',
        movement: s.cameraMovement || s.camera?.movement || '',
        action: s.action || '',
        subject: (s.characterPresence || []).map((cp: any) => cp.name || cp.characterId || '').filter(Boolean).join(','),
        environment: s.sceneName || '',
        effect: '',
        dialogue: s.dialogue || '',
        expression: '',
      })),
      characters: characters.map((c: any) => ({
        name: c.name || '',
        appearance: c.appearance || c.description || '',
        imageUrl: '',
      })),
      scenes: scenes.map((s: any) => ({
        name: s.name || s.sceneName || '',
        environment: s.environment || '',
        lighting: s.lighting || '',
      })),
    },
  }

  // 构建 V2 兼容输入（与原前端 /api/tasks/ai-generate 一致）
  const v2Input: Record<string, any> = {
    narrative: videoSegments.map((s: any) => s.narrative || s.visualDesc || '').join('\n'),
    dialogue: videoSegments.map((s: any) => s.dialogue || '').join('\n'),
    effects: '',
    duration: videoSegments[0]?.duration || 8,
  }

  // 调用 dual-render 调度器
  const { resolveProviderFromUserConfig } = await import('../runtime-provider-resolver.js')
  const { scheduleDualRender } = await import('../services/p18/dual-render-orchestrator.js')

  let runtime: any
  try {
    const resolved = await resolveProviderFromUserConfig(userId, '', 'video')
    runtime = {
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      model: resolved.model,
      baseURL: resolved.baseURL,
      userId,
      taskType: resolved.taskType,
    }
  } catch {
    console.log('[P18] ⚠️ dual-render: 用户未配置视频 Key，跳过双轨采样')
    return
  }

  await scheduleDualRender(
    {
      projectId,
      userId,
      scriptContent: body.text || '',
      v2Input,
      v3PromptIR,
      enableV3Polish: true,
    },
    runtime,
  )

  console.log(`[P18] ✅ dual-render 触发: project=${projectId}, user=${userId.substring(0, 8)}`)
}

